import { Router } from 'express';
import { utils, write } from 'xlsx';
import db from '../db';
import { requireAuth, authorize, AuthRequest } from '../auth';

const router = Router();

router.use(requireAuth);

const monthRegex = /^\d{4}-\d{2}$/;

const plannedMinutesForDate = (userId: number, dateKey: string) => {
  const versions = db
    .prepare('SELECT * FROM work_schedule_versions WHERE user_id = ? ORDER BY date(valid_from) DESC, id DESC')
    .all(userId) as any[];
  const target = versions.find((v) => v.valid_from <= dateKey) || versions[versions.length - 1];
  if (!target) return 0;
  const minutesByWeekday = [
    target?.mon_minutes ?? 0,
    target?.tue_minutes ?? 0,
    target?.wed_minutes ?? 0,
    target?.thu_minutes ?? 0,
    target?.fri_minutes ?? 0,
    target?.sat_minutes ?? 0,
    target?.sun_minutes ?? 0,
  ];
  const weekday = (new Date(`${dateKey}T00:00:00Z`).getUTCDay() + 6) % 7;
  return minutesByWeekday[weekday] ?? 0;
};

const getHolidayProfileId = (userId: number, dateKey: string) => {
  const versionRow = db
    .prepare(
      'SELECT holiday_profile_id FROM holiday_profile_versions WHERE user_id = ? AND date(valid_from) <= date(?) ORDER BY date(valid_from) DESC, id DESC LIMIT 1'
    )
    .get(userId, dateKey) as { holiday_profile_id?: number | null } | undefined;
  if (versionRow?.holiday_profile_id) return versionRow.holiday_profile_id;
  const profile = db
    .prepare('SELECT holiday_profile_id FROM user_profiles WHERE user_id = ?')
    .get(userId) as { holiday_profile_id?: number | null } | undefined;
  return profile?.holiday_profile_id ?? null;
};

const holidayDatesBetween = (userId: number, start: string, end: string) => {
  const reference = end || start;
  const profileId = getHolidayProfileId(userId, reference);
  if (!profileId) return new Set<string>();
  const rows = db
    .prepare('SELECT date FROM holidays WHERE profile_id = ? AND date BETWEEN ? AND ?')
    .all(profileId, start, end) as { date: string }[];
  return new Set(rows.map((r) => r.date));
};

const parseDate = (value: string) => {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return new Date(Date.UTC(year, month - 1, day));
};

const weekdayFromDate = (date: Date) => (date.getUTCDay() + 6) % 7;

const workingDatesBetween = (userId: number, start: string, end: string, holidaySet: Set<string>) => {
  const results: string[] = [];
  let cursor = parseDate(start);
  const endDate = parseDate(end);
  while (cursor.getTime() <= endDate.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    const minutes = plannedMinutesForDate(userId, key);
    if (minutes > 0 && !holidaySet.has(key)) {
      results.push(key);
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return results;
};

const clampRange = (start: string, end: string, min: string, max: string) => {
  const boundedStart = start < min ? min : start;
  const boundedEnd = end > max ? max : end;
  if (boundedStart > boundedEnd) return null;
  return { start: boundedStart, end: boundedEnd };
};

const buildVacationPortions = (
  userId: number,
  absences: {
    start_date: string;
    end_date: string;
    duration: 'full' | 'half';
    minutes_override?: number | null;
    start_time?: string | null;
    end_time?: string | null;
  }[],
  rangeStart: string,
  rangeEnd: string,
  todayCutoff: string
) => {
  const usedByDay = new Map<string, number>();
  const plannedByDay = new Map<string, number>();
  absences.forEach((row) => {
    const range = clampRange(row.start_date, row.end_date, rangeStart, rangeEnd);
    if (!range) return;
    const holidaySetForRange = holidayDatesBetween(userId, range.start, range.end);
    const workingDays = workingDatesBetween(userId, range.start, range.end, holidaySetForRange);
    const perDaySeen = new Set<string>();
    workingDays.forEach((key) => {
      const plannedMinutes = plannedMinutesForDate(userId, key);
      if (plannedMinutes <= 0 || holidaySetForRange.has(key)) return;
      const dedupeKey = `${key}|${row.start_date}|${row.end_date}|${row.duration}|${row.minutes_override ?? ''}|${row.start_time ?? ''}|${row.end_time ?? ''}`;
      if (perDaySeen.has(dedupeKey)) return;
      perDaySeen.add(dedupeKey);
      let minutes = row.minutes_override ?? null;
      if (minutes === null) {
        minutes = row.duration === 'half' ? Math.round(plannedMinutes / 2) : plannedMinutes;
      }
      const effective = minutes ?? plannedMinutes;
      const portion = plannedMinutes ? Math.min(effective / plannedMinutes, 1) : 0;
      if (key <= todayCutoff) {
        const current = usedByDay.get(key) ?? 0;
        usedByDay.set(key, Math.min(current + portion, 1));
      } else {
        const current = plannedByDay.get(key) ?? 0;
        plannedByDay.set(key, Math.min(current + portion, 1));
      }
    });
  });
  return { usedByDay, plannedByDay };
};

const buildAttendance = (monthParam?: string) => {
  const today = new Date();
  const fallbackMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const month = monthParam ?? fallbackMonth;
  const monthStart = `${month}-01`;
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  const monthEndDate = new Date(Date.UTC(year, monthIndex, 0));
  const monthEnd = monthEndDate.toISOString().slice(0, 10);

  const bookings = db
    .prepare(
      `SELECT user_id, DATE(clock_in) as work_day FROM bookings
       WHERE strftime('%Y-%m', clock_in) = ?
       GROUP BY user_id, work_day`
    )
    .all(month) as { user_id: number; work_day: string }[];

  const absences = db
    .prepare(
      'SELECT user_id, start_date, end_date, type, duration FROM absences WHERE NOT (end_date < ? OR start_date > ?)'
    )
    .all(monthStart, monthEnd) as {
      user_id: number;
      start_date: string;
      end_date: string;
      type: string;
      duration: 'full' | 'half';
    }[];

  const absenceKinds = db
    .prepare('SELECT code, label, counts_as_work FROM absence_kinds ORDER BY label ASC')
    .all() as { code: string; label: string; counts_as_work: number }[];

  const settings = db
    .prepare('SELECT user_id, vacation_allowance FROM user_settings')
    .all() as { user_id: number; vacation_allowance: number }[];

  const users = db
    .prepare('SELECT id, name, email FROM users ORDER BY name ASC')
    .all() as { id: number; name: string; email: string }[];

  const allowanceMap = new Map(settings.map((item) => [item.user_id, item.vacation_allowance]));
  const presenceMap = new Map<number, Set<string>>();

  const absenceUsage = new Map<number, Map<string, Map<string, number>>>();
  const holidayCache = new Map<number, Set<string>>();

  const addAbsence = (userId: number, type: string, duration: 'full' | 'half', start: string, end: string) => {
    if (!absenceUsage.has(userId)) {
      absenceUsage.set(userId, new Map());
    }
    if (!holidayCache.has(userId)) {
      holidayCache.set(userId, holidayDatesBetween(userId, monthStart, monthEnd));
    }
    const holidays = holidayCache.get(userId)!;
    const days = workingDatesBetween(userId, start, end, holidays);
    const dayValue = duration === 'half' ? 0.5 : 1;
    const perUser = absenceUsage.get(userId)!;
    if (!perUser.has(type)) perUser.set(type, new Map());
    const dayMap = perUser.get(type)!;
    days.forEach((day) => {
      const current = dayMap.get(day) ?? 0;
      dayMap.set(day, Math.max(current, dayValue));
    });
  };

  absences.forEach((row) => addAbsence(row.user_id, row.type, row.duration, row.start_date, row.end_date));

  bookings.forEach((row) => {
    if (!presenceMap.has(row.user_id)) {
      presenceMap.set(row.user_id, new Set());
    }
    presenceMap.get(row.user_id)!.add(row.work_day);
  });

  const rows = users.map((user) => {
    const presenceDays = presenceMap.get(user.id)?.size ?? 0;
    const allowance = allowanceMap.get(user.id) ?? 0;
    const usage = absenceUsage.get(user.id) ?? new Map<string, Map<string, number>>();
    const totals: Record<string, number> = {};
    absenceKinds.forEach((kind) => {
      const dayMap = usage.get(kind.code);
      let total = 0;
      dayMap?.forEach((value) => {
        total += value;
      });
      totals[kind.code] = total;
    });
    const usedVacation = totals['vacation'] ?? 0;
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      presenceDays,
      absences: totals,
      remainingVacation: Math.max(allowance - usedVacation, 0),
    };
  });

  return { month, kinds: absenceKinds, rows };
};

const buildVacationOverview = (userIds: number[], today: string) => {
  const currentYear = Number(today.slice(0, 4));
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear}-12-31`;
  const prevYearStart = `${currentYear - 1}-01-01`;
  const prevYearEnd = `${currentYear - 1}-12-31`;
  const users = db
    .prepare('SELECT id, name, email FROM users WHERE id IN (' + userIds.map(() => '?').join(',') + ')')
    .all(...userIds) as { id: number; name: string; email: string }[];
  const settings = db
    .prepare(
      'SELECT user_id, vacation_allowance, vacation_adjust_days FROM user_settings WHERE user_id IN (' +
        userIds.map(() => '?').join(',') +
        ')'
    )
    .all(...userIds) as { user_id: number; vacation_allowance: number; vacation_adjust_days?: number }[];
  const allowanceMap = new Map(settings.map((s) => [s.user_id, s.vacation_allowance]));
  const adjustmentMap = new Map(settings.map((s) => [s.user_id, s.vacation_adjust_days ?? 0]));
  const profileRows = db
    .prepare(
      'SELECT user_id, tracking_start_date, start_date FROM user_profiles WHERE user_id IN (' +
        userIds.map(() => '?').join(',') +
        ')'
    )
    .all(...userIds) as { user_id: number; tracking_start_date?: string | null; start_date?: string | null }[];
  const profileMap = new Map(profileRows.map((row) => [row.user_id, row]));

  const results = users.map((user) => {
    const baseAllowance = allowanceMap.get(user.id) ?? 30;
    const adjustmentDays = adjustmentMap.get(user.id) ?? 0;
    const profile = profileMap.get(user.id);
    const trackingStartValue = profile?.tracking_start_date || profile?.start_date || null;
    const trackingStartDate = trackingStartValue ? new Date(`${trackingStartValue}T00:00:00Z`) : null;
    const absences = db
      .prepare(
        "SELECT start_date, end_date, duration, minutes_override, start_time, end_time FROM absences WHERE user_id = ? AND type = 'vacation' AND canceled != 1"
      )
      .all(user.id) as {
        start_date: string;
        end_date: string;
        duration: 'full' | 'half';
        minutes_override?: number | null;
        start_time?: string | null;
        end_time?: string | null;
      }[];
    const previous = buildVacationPortions(user.id, absences, prevYearStart, prevYearEnd, prevYearEnd);
    const prevUsed = Array.from(previous.usedByDay.values()).reduce((sum, value) => sum + value, 0);
    const prevYearEndDate = new Date(`${prevYearEnd}T00:00:00Z`);
    const currentYearEndDate = new Date(`${yearEnd}T00:00:00Z`);
    const isActiveForYear = !trackingStartDate || trackingStartDate.getTime() <= currentYearEndDate.getTime();
    const baseAllowanceForYear = isActiveForYear ? baseAllowance : 0;
    const allowCarryOver = !trackingStartDate || trackingStartDate.getTime() <= prevYearEndDate.getTime();
    const carryOver = allowCarryOver ? Math.max(baseAllowanceForYear - prevUsed, 0) : 0;
    const allowance = baseAllowanceForYear + carryOver;
    const current = buildVacationPortions(user.id, absences, yearStart, yearEnd, today);
    const used = Array.from(current.usedByDay.values()).reduce((sum, value) => sum + value, 0);
    const planned = Array.from(current.plannedByDay.values()).reduce((sum, value) => sum + value, 0);
    const remaining = allowance - used - planned + adjustmentDays;
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      allowance,
      used,
      planned,
      remaining,
    };
  });
  return results;
};

router.get('/vacation-overview', (req: AuthRequest, res) => {
  const today = new Date().toISOString().slice(0, 10);
  let targetIds: number[] = [];
  if (req.user?.role === 'admin' || req.user?.role === 'hr' || req.user?.role === 'lead') {
    const rows = db.prepare('SELECT id FROM users WHERE active = 1').all() as { id: number }[];
    targetIds = rows.map((r) => r.id);
  } else if (req.user) {
    targetIds = [req.user.id];
  }
  if (targetIds.length === 0) return res.json([]);
  res.json({ items: buildVacationOverview(targetIds, today) });
});

router.use(authorize(['admin', 'hr']));

router.get('/attendance', (req, res) => {
  const data = buildAttendance(typeof req.query.month === 'string' ? req.query.month : undefined);
  res.json(data);
});

router.get('/attendance.csv', (req, res) => {
  const data = buildAttendance(typeof req.query.month === 'string' ? req.query.month : undefined);
  const dynamicHeaders = data.kinds.map((k) => k.label);
  const header = ['Name', 'Email', 'Präsenz', ...dynamicHeaders, 'Resturlaub'];
  const lines = data.rows.map((row) => {
    const absenceValues = data.kinds.map((k) => row.absences[k.code] ?? 0);
    return [row.name, row.email, row.presenceDays, ...absenceValues, row.remainingVacation].join(';');
  });
  const csv = [header.join(';'), ...lines].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=attendance-${data.month}.csv`);
  res.send(csv);
});

router.get('/attendance.xlsx', (req, res) => {
  const data = buildAttendance(typeof req.query.month === 'string' ? req.query.month : undefined);
  const rows = data.rows.map((row) => {
    const base: Record<string, string | number> = {
      Name: row.name,
      Email: row.email,
      Präsenz: row.presenceDays,
      Resturlaub: row.remainingVacation,
    };
    data.kinds.forEach((k) => {
      base[k.label] = row.absences[k.code] ?? 0;
    });
    return base;
  });
  const sheet = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, 'Report');
  const buffer = write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=attendance-${data.month}.xlsx`);
  res.send(buffer);
});

export default router;
