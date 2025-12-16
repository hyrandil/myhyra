import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { requireAuth, AuthRequest, authorize } from '../auth';
import { Absence, TimeEntry, WorkScheduleEntry } from '../types';
import { Holiday } from '../utils/holidays';
import { computeDayWorkMinutes, computeDayWorkStats, computeDelta } from '../services/timeService';
import { canManageUser, managedDepartments } from '../utils/permissions';
import { logAction } from '../utils/logger';

const router = Router();

const locationSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

const sourceEnum = z.enum(['WEB', 'APP', 'TERMINAL']).default('WEB');

function getSchedule(userId: number): WorkScheduleEntry[] {
  const entries = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
  if (entries.length === 7) return entries;
  const defaults = [480, 480, 480, 480, 480, 0, 0];
  const insert = db.prepare('INSERT OR IGNORE INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
  defaults.forEach((minutes, weekday) => insert.run(userId, weekday, minutes));
  return db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
}

function seedScheduleVersion(userId: number) {
  const exists = db
    .prepare('SELECT COUNT(1) as count FROM work_schedule_versions WHERE user_id = ?')
    .get(userId) as { count: number };
  if (exists?.count && exists.count > 0) return;
  const schedule = getSchedule(userId);
  const minutes = new Map(schedule.map((s) => [s.weekday, s.minutes]));
  const startRow = db
    .prepare('SELECT tracking_start_date FROM user_profiles WHERE user_id = ?')
    .get(userId) as { tracking_start_date?: string | null } | undefined;
  const validFrom = startRow?.tracking_start_date || '1970-01-01';
  db.prepare(
    `INSERT OR IGNORE INTO work_schedule_versions
      (user_id, valid_from, mon_minutes, tue_minutes, wed_minutes, thu_minutes, fri_minutes, sat_minutes, sun_minutes)
      VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    userId,
    validFrom,
    minutes.get(0) ?? 0,
    minutes.get(1) ?? 0,
    minutes.get(2) ?? 0,
    minutes.get(3) ?? 0,
    minutes.get(4) ?? 0,
    minutes.get(5) ?? 0,
    minutes.get(6) ?? 0
  );
}

function plannedMinutesForDate(userId: number, dateKey: string) {
  seedScheduleVersion(userId);
  const versions = db
    .prepare('SELECT * FROM work_schedule_versions WHERE user_id = ? ORDER BY date(valid_from) DESC, id DESC')
    .all(userId) as any[];
  const target = versions.find((v) => v.valid_from <= dateKey) || versions[versions.length - 1];
  const minutesByWeekday = [
    target?.mon_minutes ?? 0,
    target?.tue_minutes ?? 0,
    target?.wed_minutes ?? 0,
    target?.thu_minutes ?? 0,
    target?.fri_minutes ?? 0,
    target?.sat_minutes ?? 0,
    target?.sun_minutes ?? 0,
  ];
  const dateObj = new Date(`${dateKey}T00:00:00Z`);
  const weekday = (dateObj.getUTCDay() + 6) % 7;
  return minutesByWeekday[weekday] ?? 0;
}

function getHolidayProfileId(userId: number, dateKey?: string): number | null {
  try {
    const targetDate = dateKey ?? new Date().toISOString().slice(0, 10);
    const versionRow = db
      .prepare(
        'SELECT holiday_profile_id FROM holiday_profile_versions WHERE user_id = ? AND date(valid_from) <= date(?) ORDER BY date(valid_from) DESC, id DESC LIMIT 1'
      )
      .get(userId, targetDate) as { holiday_profile_id?: number | null } | undefined;
    if (versionRow?.holiday_profile_id) return versionRow.holiday_profile_id;
    const row = db
      .prepare('SELECT holiday_profile_id FROM user_profiles WHERE user_id = ?')
      .get(userId) as { holiday_profile_id?: number | null } | undefined;
    return row?.holiday_profile_id ?? null;
  } catch (err) {
    console.error('Holiday profile column missing, fallback without Feiertage', err);
    return null;
  }
}

function getHolidays(userId: number, startDate: string, endDate: string): Holiday[] {
  const profileId = getHolidayProfileId(userId, startDate);
  if (!profileId) return [];
  return db
    .prepare('SELECT date, name, duration FROM holidays WHERE profile_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC')
    .all(profileId, startDate, endDate) as Holiday[];
}

function lastEntry(userId: number): TimeEntry | undefined {
  return db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1')
    .get(userId) as TimeEntry | undefined;
}

function formatBerlinTimestamp(date: Date) {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function insertEntry(
  userId: number,
  type: TimeEntry['type'],
  source: TimeEntry['source'],
  location?: { lat?: number | null; lng?: number | null }
) {
  const now = formatBerlinTimestamp(new Date());
  const stmt = db.prepare(
    'INSERT INTO time_entries (user_id, timestamp, type, source, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(userId, now, type, source, location?.lat ?? null, location?.lng ?? null);
  logAction(userId, `time.${type.toLowerCase()}`, userId, { source, location });
  return result;
}

function buildMonthlyReport(userId: number, monthValue?: string) {
  const today = new Date();
  const baseMonth = monthValue || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const baseDate = new Date(`${baseMonth}-01T00:00:00Z`);
  const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 0));

  const absenceKinds = db
    .prepare('SELECT code, label, counts_as_work FROM absence_kinds ORDER BY label ASC')
    .all() as { code: string; label: string; counts_as_work: number }[];
  const kindMap = new Map(absenceKinds.map((k) => [k.code, k]));

  const entries = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND date(timestamp) BETWEEN ? AND ? ORDER BY timestamp ASC')
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as TimeEntry[];

  const grouped = new Map<string, TimeEntry[]>();
  entries.forEach((entry) => {
    const key = entry.timestamp.slice(0, 10);
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  });

  const manualAbsences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? AND NOT (end_date < ? OR start_date > ?)')
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as Absence[];
  const approvedRequests = db
    .prepare(
      "SELECT user_id, start_date, end_date, type, CASE WHEN duration = 'half' THEN 'half' ELSE 'full' END as duration, NULL as note, start_time, end_time, minutes_override, created_at, id FROM absence_requests WHERE user_id = ? AND status = 'approved' AND canceled = 0 AND NOT (end_date < ? OR start_date > ?)"
    )
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as Absence[];
  const absenceKey = new Set(
    manualAbsences.map((a) => `${a.start_date}|${a.end_date}|${a.type}|${a.duration ?? 'full'}|${a.minutes_override ?? ''}`)
  );
  const absences = [
    ...manualAbsences,
    ...approvedRequests.filter(
      (a) => !absenceKey.has(`${a.start_date}|${a.end_date}|${a.type}|${a.duration ?? 'full'}|${a.minutes_override ?? ''}`)
    ),
  ];
  const pendingRequests = db
    .prepare(
      "SELECT * FROM absence_requests WHERE user_id = ? AND status = 'pending' AND canceled = 0 AND NOT (end_date < ? OR start_date > ?)"
    )
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as any[];

  const absenceMap = new Map<string, Absence[]>();
  const holidays = getHolidays(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  const holidayDurationMap = new Map<string, string>();
  const enrichedHolidays = holidays.map((holiday) => ({
    id: -1,
    user_id: userId,
    start_date: holiday.date,
    end_date: holiday.date,
    type: 'holiday',
    duration: holiday.duration,
    note: holiday.name,
    created_at: holiday.date,
  })) as (Absence & { type: Absence['type'] | 'holiday' })[];
  enrichedHolidays.forEach((h) => holidayDurationMap.set(h.start_date, h.duration ?? 'full'));
  const holidayDays = new Set(enrichedHolidays.map((h) => h.start_date));
  [...absences, ...enrichedHolidays].forEach((absence) => {
    const results: string[] = [];
    let cursor = new Date(`${absence.start_date}T00:00:00Z`);
    const endDate = new Date(`${absence.end_date}T00:00:00Z`);
    while (cursor.getTime() <= endDate.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      const planned = plannedMinutesForDate(userId, key);
      if (planned > 0) {
        const isHoliday = holidayDays.has(key);
        const isVacation = (absence as any).type === 'vacation';
        const holidayDuration = holidayDurationMap.get(key);
        if (!(isHoliday && isVacation && holidayDuration !== 'half')) {
          results.push(key);
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    results.forEach((day) => {
      const list = absenceMap.get(day) ?? [];
      list.push(absence as Absence);
      absenceMap.set(day, list);
    });
  });

  const days: any[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    const planned = plannedMinutesForDate(userId, key);
    const dayEntries = grouped.get(key) ?? [];
    const workStats = computeDayWorkStats(dayEntries);
    const absencesForDay = absenceMap.get(key) ?? [];
    let creditVacation = 0;
    let creditHoliday = 0;
    let topUpOther = 0;
    absencesForDay.forEach((absence) => {
      const factor = absence.duration === 'half' ? 0.5 : 1;
      const target = Math.round(absence.minutes_override ?? planned * factor);
      const kind = kindMap.get(absence.type);
      if ((absence as any).type === 'holiday') {
        creditHoliday += target;
      } else if (absence.type === 'vacation') {
        creditVacation += target;
      } else if (kind?.counts_as_work) {
        const covered = workStats.workedMinutes + creditVacation + creditHoliday + topUpOther;
        const topUp = Math.max(target - covered, 0);
        topUpOther += topUp;
      }
    });
    const hasPending = pendingRequests.some((item) => item.start_date <= key && item.end_date >= key);
    const worked = workStats.workedMinutes + creditVacation + creditHoliday + topUpOther;
    const delta = worked - planned;
    const absenceLabels = absencesForDay.map((a) => {
      if ((a as any).type === 'holiday') return a.note ?? 'Feiertag';
      const kind = kindMap.get(a.type);
      return kind?.label ?? a.type;
    });
    if (hasPending) absenceLabels.push('pending');
    days.push({
      date: key,
      planned,
      worked,
      delta,
      entries: dayEntries,
      absences: absencesForDay,
      absenceDetails: absencesForDay.map((a) => ({
        type: a.type,
        duration: a.duration ?? 'full',
        source: (a as any).source ?? 'manual',
      })),
      absenceLabels,
      autoBreakMinutes: workStats.autoDeduction,
      recordedBreakMinutes: workStats.recordedBreakMinutes,
      pending: hasPending,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const userRow = db
    .prepare(
      `SELECT u.first_name, u.last_name, u.name, u.email, up.personnel_number, us.vacation_allowance
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as
    | {
        first_name?: string | null;
        last_name?: string | null;
        name?: string | null;
        email?: string | null;
        personnel_number?: string | null;
        vacation_allowance?: number | null;
      }
    | undefined;
  const displayName = [userRow?.first_name, userRow?.last_name].filter(Boolean).join(' ') || userRow?.name || '';
  let usedVacationDays = 0;
  days.forEach((day) => {
    const planned = day.planned || 0;
    if (!planned) return;
    day.absences.forEach((absence: Absence) => {
      if (absence.type !== 'vacation') return;
      let minutes = absence.minutes_override ?? null;
      if (minutes === null && absence.start_time && absence.end_time) {
        const startTs = new Date(`${day.date}T${absence.start_time}:00Z`).getTime();
        const endTs = new Date(`${day.date}T${absence.end_time}:00Z`).getTime();
        minutes = Math.max(Math.round((endTs - startTs) / 60000), 0);
      }
      if (minutes === null) {
        minutes = absence.duration === 'half' ? Math.round(planned / 2) : planned;
      }
      minutes = minutes ?? 0;
      usedVacationDays += Math.min(minutes / planned, 1);
    });
  });
  const allowance = userRow?.vacation_allowance ?? 0;
  const remaining = Math.max(allowance - usedVacationDays, 0);
  const dailySnapshot = buildDailySummary(userId, baseMonth);

  return {
    month: baseMonth,
    days,
    meta: {
      name: displayName,
      personnelNumber: userRow?.personnel_number || '',
      vacation: { allowance, used: usedVacationDays, remaining },
      flexBalance: dailySnapshot.flexBalance ?? 0,
    },
  };
}

const manualEntrySchema = z.object({
  timestamp: z
    .string()
    .min(16)
    .transform((value) => {
      const [datePart, timePart] = value.replace('Z', '').split('T');
      if (!datePart || !timePart) throw new Error('Ungültiger Zeitstempel');
      const [hour, minute] = timePart.split(':');
      const formatted = `${datePart} ${hour}:${minute}:00`;
      return formatted;
    }),
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
  source: sourceEnum.optional(),
  location: locationSchema.optional(),
});

function ensureManageable(req: AuthRequest, res: any, targetUserId: number) {
  if (!req.user) return false;
  if (req.user.role === 'admin' || req.user.role === 'hr') return true;
  if (canManageUser(req.user.id, req.user.role, targetUserId)) return true;
  res.status(403).json({ message: 'Keine Berechtigung für diesen Mitarbeitenden' });
  return false;
}

function ensureEntryManageable(req: AuthRequest, res: any, entryId: number) {
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry | undefined;
  if (!entry) {
    res.status(404).json({ message: 'Buchung nicht gefunden' });
    return null;
  }
  if (!req.user) return null;
  if (req.user.role === 'admin' || req.user.role === 'hr') return entry;
  if (canManageUser(req.user.id, req.user.role, entry.user_id)) return entry;
  res.status(403).json({ message: 'Keine Berechtigung für diese Buchung' });
  return null;
}

function buildDailySummary(userId: number, month?: string, maskAbsences = false) {
  const now = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const profile = db
    .prepare('SELECT tracking_start_date, start_date FROM user_profiles WHERE user_id = ?')
    .get(userId) as { tracking_start_date?: string | null; start_date?: string | null } | undefined;
  const trackingStartValue = profile?.tracking_start_date || profile?.start_date;
  const trackingStartDate = trackingStartValue ? new Date(`${trackingStartValue}T00:00:00Z`) : undefined;
  const absenceKinds = db
    .prepare('SELECT code, label, counts_as_work FROM absence_kinds ORDER BY label ASC')
    .all() as { code: string; label: string; counts_as_work: number }[];
  const absenceKindMap = new Map(absenceKinds.map((k) => [k.code, k]));

  const entryRows = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND date(timestamp) <= ?')
    .all(userId, end.toISOString().slice(0, 10)) as TimeEntry[];

  const manualAbsences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? AND NOT (end_date < ? )')
    .all(userId, start.toISOString().slice(0, 10)) as Absence[];

  const approvedRequests = db
    .prepare(
      "SELECT user_id, start_date, end_date, type, 'full' as duration, NULL as note, created_at, id FROM absence_requests WHERE user_id = ? AND status = 'approved' AND canceled = 0 AND end_date >= ?"
    )
    .all(userId, start.toISOString().slice(0, 10)) as Absence[];

  const absenceKey = new Set(
    manualAbsences.map((a) => `${a.start_date}|${a.end_date}|${a.type}|${a.duration ?? 'full'}`)
  );
  const absences = [
    ...manualAbsences,
    ...approvedRequests.filter((a) => !absenceKey.has(`${a.start_date}|${a.end_date}|${a.type}|${a.duration ?? 'full'}`)),
  ];

  const pendingRequests = db
    .prepare(
      "SELECT * FROM absence_requests WHERE user_id = ? AND status = 'pending' AND canceled = 0 AND NOT (end_date < ? OR start_date > ?)"
    )
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as {
      start_date: string;
      end_date: string;
      type: string;
    }[];

  const grouped = new Map<string, TimeEntry[]>();
  entryRows.forEach((row) => {
    const key = row.timestamp.slice(0, 10);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  });

  const absenceMap = new Map<string, Absence[]>();
  const holidayRows = getHolidays(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
  const holidays = holidayRows.map((holiday) => ({
    id: -1,
    user_id: userId,
    start_date: holiday.date,
    end_date: holiday.date,
    type: 'holiday',
    duration: holiday.duration,
    note: holiday.name,
    created_at: holiday.date,
  })) as (Absence & { type: Absence['type'] | 'holiday' })[];
  const holidayDays = new Set(holidays.map((h) => h.start_date));
  [...absences, ...holidays].forEach((absence) => {
    const days: string[] = [];
    let cursor = new Date(`${absence.start_date}T00:00:00Z`);
    const endDate = new Date(`${absence.end_date}T00:00:00Z`);
    while (cursor.getTime() <= endDate.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      const planned = plannedMinutesForDate(userId, key);
      if (planned > 0) {
        const isHoliday = holidayDays.has(key);
        const isVacation = (absence as any).type === 'vacation';
        if (!(isHoliday && isVacation)) {
          days.push(key);
        }
      }
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    }
    days.forEach((day) => {
      const list = absenceMap.get(day) ?? [];
      list.push(absence);
      absenceMap.set(day, list);
    });
  });

  const hasInconsistent = (entries: TimeEntry[]) => {
    const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (sorted.length > 0 && sorted[0]!.type === 'CLOCK_OUT') {
      return true;
    }
    let clockInCount = 0;
    let clockOutCount = 0;
    for (let i = 0; i < sorted.length; i += 1) {
      const curr = sorted[i]!;
      if (curr.type === 'CLOCK_IN') clockInCount += 1;
      if (curr.type === 'CLOCK_OUT') clockOutCount += 1;
      if (i > 0) {
        const prev = sorted[i - 1]!;
        if (
          (prev.type === 'CLOCK_IN' && curr.type === 'CLOCK_IN') ||
          (prev.type === 'CLOCK_OUT' && curr.type === 'CLOCK_OUT')
        ) {
          return true;
        }
      }
      if (clockOutCount > clockInCount) {
        return true;
      }
    }
    if (sorted.length > 0) {
      const last = sorted[sorted.length - 1]!;
      const day = last.timestamp.slice(0, 10);
      const now = new Date();
      const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
      const dayDate = new Date(`${day}T00:00:00Z`);
      if (last.type !== 'CLOCK_OUT' && dayDate.getTime() <= yesterday.getTime()) {
        return true;
      }
    }
    return clockInCount !== clockOutCount;
  };

  const statusForDay = (entries: TimeEntry[], abs: Absence[], pending: boolean): string => {
    if (abs.some((a) => (a as any).type === 'holiday')) return 'holiday';
    if (abs.some((a) => a.type === 'vacation')) return 'vacation';
    if (abs.some((a) => a.type === 'sick')) return 'sick';
    if (abs.length > 0) return 'away';
    if (pending) return 'pending';
    if (entries.length === 0) return 'empty';
    if (hasInconsistent(entries)) return 'inconsistent';
    const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const lastType = sorted.length > 0 ? sorted[sorted.length - 1]!.type : undefined;
    if (lastType && lastType !== 'CLOCK_OUT') return 'open';
    return 'ok';
  };

  const earliestEntry = entryRows.reduce<string | null>((acc, row) => {
    const key = row.timestamp.slice(0, 10);
    if (!acc) return key;
    return key < acc ? key : acc;
  }, null);
  const earliestAbsence = absences.reduce<string | null>((acc, row) => {
    if (!acc) return row.start_date;
    return row.start_date < acc ? row.start_date : acc;
  }, null);
  const monthStart = new Date(start);
  const startCursor = (() => {
    const dates = [trackingStartValue, earliestEntry, earliestAbsence].filter(Boolean) as string[];
    if (dates.length === 0) return new Date(start);
    let min: string = dates[0]!;
    dates.forEach((value) => {
      if (min && value < min) min = value;
    });
    const parsed = new Date(`${min}T00:00:00Z`);
    return parsed.getTime() < monthStart.getTime() ? parsed : new Date(start);
  })();

  const days: Record<string, { worked: number; planned: number; flex: number; absences: string[]; status: string; pending?: boolean }> = {};
  let flexCarry = 0;
  let cursor = new Date(startCursor);
  const endCursor = new Date(end);
  const today = new Date();
  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));

  while (cursor.getTime() <= endCursor.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    const planned = plannedMinutesForDate(userId, key);
    const entries = grouped.get(key) ?? [];
    const absencesForDay = absenceMap.get(key) ?? [];
    const workStats = computeDayWorkStats(entries);
    const baseWork = workStats.workedMinutes;

    let creditVacation = 0;
    let creditHoliday = 0;
    let topUpOther = 0;
    absencesForDay.forEach((absence) => {
      const factor = absence.duration === 'half' ? 0.5 : 1;
      const target = Math.round(absence.minutes_override ?? planned * factor);
      const kind = absenceKindMap.get(absence.type);
      if ((absence as any).type === 'holiday') {
        creditHoliday += target;
      } else if (absence.type === 'vacation') {
        creditVacation += target;
      } else if (kind?.counts_as_work) {
        const covered = baseWork + creditVacation + creditHoliday + topUpOther;
        const topUp = Math.max(target - covered, 0);
        topUpOther += topUp;
      }
    });

    const hasPending = pendingRequests.some((item) => item.start_date <= key && item.end_date >= key);
    const inactiveBeforeTracking = trackingStartDate && cursor.getTime() < trackingStartDate.getTime();
    const effectivePlanned = inactiveBeforeTracking ? 0 : planned;
    const effectiveWorked = inactiveBeforeTracking ? 0 : baseWork + creditVacation + creditHoliday + topUpOther;
    const delta = computeDelta(effectivePlanned, effectiveWorked);
    if (cursor.getTime() <= cutoff.getTime()) {
      flexCarry += delta;
    }
    const status = inactiveBeforeTracking
      ? 'inactive'
      : statusForDay(entries, absencesForDay, hasPending);
    const absenceLabels: string[] = absencesForDay.map((a) => {
      if ((a as any).type === 'holiday') return a.note ?? 'Feiertag';
      if (maskAbsences) return a.type === 'vacation' ? 'Urlaub' : 'Nicht im Haus';
      if (a.type === 'vacation') return 'Urlaub';
      const kind = absenceKindMap.get(a.type);
      if (kind) return kind.label;
      if (a.type === 'sick') return 'Krank';
      if (a.type === 'remote') return 'Remote';
      return a.type;
    });
    if (hasPending) {
      absenceLabels.push('pending');
    }
    if (cursor.getTime() >= monthStart.getTime()) {
      days[key] = {
        worked: effectiveWorked,
        planned: effectivePlanned,
        flex: delta,
        absences: absenceLabels,
        status,
        pending: hasPending,
      };
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return {
    month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`,
    days,
    flexBalance: flexCarry,
  };
}

router.use(requireAuth);

router.get('/me', (req: AuthRequest, res) => {
  const entries = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? ORDER BY timestamp DESC')
    .all(req.user!.id) as TimeEntry[];
  res.json(entries);
});

router.post('/clock-in', (req: AuthRequest, res) => {
  const parsedLocation = locationSchema.safeParse(req.body?.location ?? {});
  const source = sourceEnum.parse(req.body?.source ?? 'WEB');
  if (!parsedLocation.success) return res.status(400).json({ errors: parsedLocation.error.format() });
  if (parsedLocation.data.lat === undefined || parsedLocation.data.lng === undefined) {
    return res.status(400).json({ message: 'Standort erforderlich' });
  }
  const last = lastEntry(req.user!.id);
  if (last && (last.type === 'CLOCK_IN' || last.type === 'BREAK_END')) {
    return res.status(409).json({ message: 'Bereits eingestempelt' });
  }
  const loc = parsedLocation.data;
  insertEntry(req.user!.id, 'CLOCK_IN', source, { lat: loc.lat ?? null, lng: loc.lng ?? null });
  res.status(201).json({ message: 'Kommen erfasst' });
});

router.post('/clock-out', (req: AuthRequest, res) => {
  const parsedLocation = locationSchema.safeParse(req.body?.location ?? {});
  const source = sourceEnum.parse(req.body?.source ?? 'WEB');
  if (!parsedLocation.success) return res.status(400).json({ errors: parsedLocation.error.format() });
  if (parsedLocation.data.lat === undefined || parsedLocation.data.lng === undefined) {
    return res.status(400).json({ message: 'Standort erforderlich' });
  }
  const last = lastEntry(req.user!.id);
  if (!last || last.type === 'CLOCK_OUT' || last.type === 'BREAK_START') {
    return res.status(409).json({ message: 'Keine offene Buchung' });
  }
  const loc = parsedLocation.data;
  insertEntry(req.user!.id, 'CLOCK_OUT', source, { lat: loc.lat ?? null, lng: loc.lng ?? null });
  res.status(201).json({ message: 'Gehen erfasst' });
});

router.post('/break-start', (req: AuthRequest, res) => {
  const parsedLocation = locationSchema.safeParse(req.body?.location ?? {});
  const source = sourceEnum.parse(req.body?.source ?? 'WEB');
  if (!parsedLocation.success) return res.status(400).json({ errors: parsedLocation.error.format() });
  const last = lastEntry(req.user!.id);
  if (!last || last.type === 'CLOCK_OUT' || last.type === 'BREAK_START') {
    return res.status(409).json({ message: 'Keine laufende Arbeitszeit' });
  }
  const loc = parsedLocation.data;
  insertEntry(req.user!.id, 'BREAK_START', source, { lat: loc.lat ?? null, lng: loc.lng ?? null });
  res.status(201).json({ message: 'Pause gestartet' });
});

router.post('/break-end', (req: AuthRequest, res) => {
  const parsedLocation = locationSchema.safeParse(req.body?.location ?? {});
  const source = sourceEnum.parse(req.body?.source ?? 'WEB');
  if (!parsedLocation.success) return res.status(400).json({ errors: parsedLocation.error.format() });
  const last = lastEntry(req.user!.id);
  if (!last || last.type !== 'BREAK_START') {
    return res.status(409).json({ message: 'Keine laufende Pause' });
  }
  const loc = parsedLocation.data;
  insertEntry(req.user!.id, 'BREAK_END', source, { lat: loc.lat ?? null, lng: loc.lng ?? null });
  res.status(201).json({ message: 'Pause beendet' });
});

router.get('/me/daily', (req: AuthRequest, res) => {
  const { month } = req.query as { month?: string };
  res.json(buildDailySummary(req.user!.id, month, true));
});

router.get('/user/:userId/daily', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  const { month } = req.query as { month?: string };
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
  if (!exists) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  if (req.user!.id === userId) {
    return res.json(buildDailySummary(userId, month, true));
  }
  if (!ensureManageable(req, res, userId)) return;
  res.json(buildDailySummary(userId, month));
});

router.get('/user/:userId/day', requireAuth, (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  const { date } = req.query as { date?: string };
  if (!date) return res.status(400).json({ message: 'Datum erforderlich' });
  if (Number.isNaN(userId)) return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
  if (!exists) return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  if (req.user!.id !== userId) {
    if (req.user!.role === 'admin' || req.user!.role === 'hr') {
      if (!ensureManageable(req, res, userId)) return;
    } else if (req.user!.role === 'lead') {
      if (!ensureManageable(req, res, userId)) return;
    } else {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }
  }
  const entries = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND date(timestamp) = ? ORDER BY timestamp ASC')
    .all(userId, date) as TimeEntry[];
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? AND start_date <= ? AND end_date >= ?')
    .all(userId, date, date) as Absence[];
  const holidays = getHolidays(userId, date, date).map((holiday) => ({
    id: -1,
    user_id: userId,
    start_date: holiday.date,
    end_date: holiday.date,
    type: 'holiday',
    duration: holiday.duration,
    note: holiday.name,
    created_at: holiday.date,
  }));
  const pending = db
    .prepare("SELECT * FROM absence_requests WHERE user_id = ? AND status = 'pending' AND start_date <= ? AND end_date >= ?")
    .all(userId, date, date) as any[];
  const kindMap = new Map(
    (db.prepare('SELECT code, label FROM absence_kinds').all() as { code: string; label: string }[]).map((k) => [k.code, k.label])
  );
  const enrichedAbsences = [...absences, ...holidays].map((a) => ({
    ...a,
    source: (a as any).source ?? ((a as any).type === 'holiday' ? 'holiday' : 'manual'),
    label: (a as any).type === 'holiday' ? a.note ?? 'Feiertag' : kindMap.get(a.type) ?? a.type,
  }));
  const stats = computeDayWorkStats(entries);
  const inconsistent = ((): boolean => {
    const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const curr = sorted[i]!;
      if (
        (prev.type === 'CLOCK_IN' && curr.type === 'CLOCK_IN') ||
        (prev.type === 'CLOCK_OUT' && curr.type === 'CLOCK_OUT')
      ) {
        return true;
      }
    }
    const last = sorted[sorted.length - 1];
    if (last) {
      const day = new Date(`${date}T00:00:00Z`);
      const now = new Date();
      const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
      if (last.type !== 'CLOCK_OUT' && day.getTime() <= yesterday.getTime()) return true;
    }
    return false;
  })();

  res.json({
    entries,
    absences: enrichedAbsences,
    pending: pending.length > 0,
    autoBreakMinutes: stats.autoDeduction,
    recordedBreakMinutes: stats.recordedBreakMinutes,
    spanMinutes: stats.spanMinutes,
    inconsistent,
  });
});

router.get('/user/:userId/monthly-report', (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  const { month } = req.query as { month?: string };
  if (Number.isNaN(userId)) return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  if (userId !== req.user!.id && !ensureManageable(req, res, userId)) return;
  res.json(buildMonthlyReport(userId, month));
});

router.get('/me/monthly-report', (req: AuthRequest, res) => {
  const { month } = req.query as { month?: string };
  res.json(buildMonthlyReport(req.user!.id, month));
});

router.get('/inconsistent', (req: AuthRequest, res) => {
  const actor = req.user!;
  let userIds: { id: number; first_name?: string | null; last_name?: string | null; name?: string | null }[] = [];
  if (actor.role === 'admin' || actor.role === 'hr') {
    userIds = db.prepare('SELECT id, first_name, last_name, name FROM users').all() as any[];
  } else if (actor.role === 'lead') {
    const departments = managedDepartments(actor.id);
    if (departments.length === 0) {
      return res.json([]);
    }
    const placeholders = departments.map(() => '?').join(',');
    userIds = db
      .prepare(
        `SELECT DISTINCT u.id, u.first_name, u.last_name, u.name FROM users u
         JOIN department_members dm ON dm.user_id = u.id
         WHERE dm.department_id IN (${placeholders}) AND u.id != ?`
      )
      .all(...departments, actor.id) as any[];
  } else {
    return res.status(403).json({ message: 'Keine Berechtigung' });
  }

  if (userIds.length === 0) return res.json([]);
  const allowedIds = userIds.map((u) => u.id);
  const placeholders = allowedIds.map(() => '?').join(',');
  const entryRows = db
    .prepare(
      `SELECT * FROM time_entries WHERE user_id IN (${placeholders})
       ORDER BY user_id, timestamp ASC`
    )
    .all(...allowedIds) as TimeEntry[];

  const grouped: Record<string, TimeEntry[]> = {};
  entryRows.forEach((entry) => {
    const key = `${entry.user_id}:${entry.timestamp.slice(0, 10)}`;
    const list = grouped[key] ?? [];
    list.push(entry);
    grouped[key] = list;
  });

  const hasInconsistent = (entries: TimeEntry[], day: string) => {
    for (let i = 1; i < entries.length; i += 1) {
      const prev = entries[i - 1]!;
      const curr = entries[i]!;
      if (
        (prev.type === 'CLOCK_IN' && curr.type === 'CLOCK_IN') ||
        (prev.type === 'CLOCK_OUT' && curr.type === 'CLOCK_OUT')
      ) {
        return true;
      }
    }
    const now = new Date();
    const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const dayDate = new Date(`${day}T00:00:00Z`);
    const last = entries[entries.length - 1];
    if (last && last.type !== 'CLOCK_OUT' && dayDate.getTime() <= yesterday.getTime()) {
      return true;
    }
    return false;
  };

  const results = Object.entries(grouped)
    .filter(([key, entries]) => {
      const [, date] = key.split(':');
      return hasInconsistent(entries, date ?? '');
    })
    .map(([key, entries]) => {
      const [userIdStr, date] = key.split(':');
      const userId = Number(userIdStr);
      const user = userIds.find((u) => u.id === userId);
      const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.name || `User ${userId}`;
      return { user_id: userId, user: name, date, entries };
    });

  res.json(results);
});

router.get('/overview', (req: AuthRequest, res) => {
  const { month, department, userId } = req.query as { month?: string; department?: string; userId?: string };
  const today = new Date();
  const monthValue = month || `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const base = new Date(`${monthValue}-01T00:00:00Z`);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));

  const deptFilter = department?.trim();
  let deptId: number | null = null;
  if (deptFilter) {
    const numeric = Number(deptFilter);
    if (!Number.isNaN(numeric)) {
      deptId = numeric;
    } else {
      const row = db.prepare('SELECT id FROM departments WHERE name = ?').get(deptFilter) as { id: number } | undefined;
      deptId = row?.id ?? null;
    }
    if (deptId === null) {
      return res.json({ month: monthValue, days: {} });
    }
  }

  const userRows = deptId
    ? (db
        .prepare(
          `SELECT DISTINCT u.id, u.name, d.name as department
           FROM department_members dm
           JOIN users u ON u.id = dm.user_id
           JOIN departments d ON d.id = dm.department_id
           WHERE d.id = ?`
        )
        .all(deptId) as { id: number; name: string; department?: string | null }[])
    : (db
        .prepare(
          `SELECT u.id, u.name, d.name as department
           FROM users u
           LEFT JOIN department_members dm ON dm.user_id = u.id
           LEFT JOIN departments d ON d.id = dm.department_id`
        )
        .all() as { id: number; name: string; department?: string | null }[]);

  const filteredByUser = userId ? userRows.filter((row) => row.id === Number(userId)) : userRows;
  const selectedUsers = filteredByUser.length > 0 ? filteredByUser : userRows;

  const userMap = new Map<number, { name: string; department?: string | null }>();
  selectedUsers.forEach((row) => userMap.set(row.id, { name: row.name, department: row.department ?? null }));

  const userIds = selectedUsers.map((row: any) => row.id);
  if (userIds.length === 0) return res.json({ month: monthValue, days: {} });

  const placeholders = userIds.map(() => '?').join(',');
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const profileRows = db
    .prepare(`SELECT user_id, holiday_profile_id FROM user_profiles WHERE user_id IN (${placeholders})`)
    .all(...userIds) as { user_id: number; holiday_profile_id?: number | null }[];
  const holidayRanges: { user_id: number; start_date: string; end_date: string; type: 'holiday'; name: string; duration: string }[]
    = [];
  profileRows.forEach((row) => {
    if (!row.holiday_profile_id) return;
    const holidayList = db
      .prepare(
        'SELECT date as start_date, date as end_date, name, duration FROM holidays WHERE profile_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC'
      )
      .all(row.holiday_profile_id, startStr, endStr) as { start_date: string; end_date: string; name: string; duration: string }[];
    holidayList.forEach((h) =>
      holidayRanges.push({
        user_id: row.user_id,
        start_date: h.start_date,
        end_date: h.end_date,
        type: 'holiday',
        name: h.name,
        duration: h.duration,
      })
    );
  });

  const manualAbsences = db
    .prepare(
      `SELECT * FROM absences WHERE user_id IN (${placeholders}) AND NOT (end_date < ? OR start_date > ?)`
    )
    .all(...userIds, startStr, endStr) as Absence[];

  const approvedRequests = db
    .prepare(
      `SELECT user_id, start_date, end_date, type, 'full' as duration, NULL as note, created_at, id
       FROM absence_requests
       WHERE status = 'approved' AND canceled = 0 AND user_id IN (${placeholders}) AND NOT (end_date < ? OR start_date > ?)`
    )
    .all(...userIds, startStr, endStr) as Absence[];

  const days: Record<string, any> = {};

  const addRange = (startDate: string, endDate: string, type: string, user: { id: number; name: string; department?: string | null }) => {
    const cursor = new Date(`${startDate}T00:00:00Z`);
    const endValue = new Date(`${endDate}T00:00:00Z`);
    while (cursor.getTime() <= endValue.getTime()) {
      const key = cursor.toISOString().slice(0, 10);
      if (!days[key]) {
        days[key] = {
          date: key,
          planned: 0,
          worked: 0,
          flex: 0,
          absences: [],
          status: 'ok',
          pending: false,
          users: [],
        };
      }
      if (!days[key].users.some((u: any) => u.id === user.id)) {
        days[key].users.push(user);
      }
    if (type === 'holiday') {
      days[key].status = 'holiday';
      if (!days[key].absences.includes('Feiertag')) days[key].absences.push('Feiertag');
    } else if (type === 'vacation') {
      days[key].status = 'vacation';
      if (!days[key].absences.includes('Urlaub')) days[key].absences.push('Urlaub');
    } else {
      if (days[key].status !== 'vacation') days[key].status = 'away';
      if (!days[key].absences.includes('Nicht im Haus')) days[key].absences.push('Nicht im Haus');
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  };

  [...manualAbsences, ...approvedRequests, ...holidayRanges].forEach((absence) => {
    const meta = userMap.get((absence as any).user_id);
    if (!meta) return;
    addRange(absence.start_date, absence.end_date, (absence as any).type, {
      id: (absence as any).user_id,
      name: meta.name,
      department: meta.department ?? null,
    });
  });

  res.json({ month: monthValue, days });
});

router.post('/user/:userId/manual', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
  if (!exists) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  if (!ensureManageable(req, res, userId)) return;
  const parsed = manualEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { timestamp, type, source, location } = parsed.data;
  const stmt = db.prepare(
    'INSERT INTO time_entries (user_id, timestamp, type, source, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(userId, timestamp, type, source ?? 'WEB', location?.lat ?? null, location?.lng ?? null);
  const entry = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(result.lastInsertRowid) as TimeEntry;
  logAction(req.user!.id, 'time.manual.create', userId, { timestamp, type, source: source ?? 'WEB' });
  res.status(201).json(entry);
});

const updateEntrySchema = z.object({
  timestamp: z
    .string()
    .min(16)
    .transform((value) => {
      const [datePart, timePart] = value.replace('Z', '').split('T');
      if (!datePart || !timePart) throw new Error('Ungültiger Zeitstempel');
      const [hour, minute] = timePart.split(':');
      return `${datePart} ${hour}:${minute}:00`;
    }),
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
});

router.patch('/entry/:entryId', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const entryId = Number(req.params.entryId);
  if (Number.isNaN(entryId)) return res.status(400).json({ message: 'Ungültige Buchungs-ID' });
  const entry = ensureEntryManageable(req, res, entryId);
  if (!entry) return;
  const parsed = updateEntrySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const { timestamp, type } = parsed.data;
  db.prepare('UPDATE time_entries SET timestamp = ?, type = ? WHERE id = ?').run(timestamp, type, entryId);
  const updated = db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId) as TimeEntry;
  logAction(req.user!.id, 'time.manual.update', entry.user_id, { entry_id: entryId, timestamp, type });
  res.json(updated);
});

router.delete('/entry/:entryId', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const entryId = Number(req.params.entryId);
  if (Number.isNaN(entryId)) return res.status(400).json({ message: 'Ungültige Buchungs-ID' });
  const entry = ensureEntryManageable(req, res, entryId);
  if (!entry) return;
  db.prepare('DELETE FROM time_entries WHERE id = ?').run(entryId);
  logAction(req.user!.id, 'time.manual.delete', entry.user_id, { entry_id: entryId });
  res.status(204).send();
});

const correctionEntrySchema = z
  .object({
    timestamp: z.string().min(5),
    type: z.enum(['CLOCK_IN', 'CLOCK_OUT']),
    action: z.enum(['add', 'delete', 'replace']).default('add'),
    entry_id: z.number().int().optional(),
  })
  .refine((value) => {
    if (value.action === 'add') return true;
    return Number.isInteger(value.entry_id);
  }, 'Bestehende Buchung fehlt')
  .refine((value) => {
    if (value.action === 'delete') return true;
    return Boolean(value.timestamp);
  }, 'Zeitpunkt erforderlich');

const correctionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(500).optional().or(z.literal('')).transform((v) => v || undefined),
  entries: z.array(correctionEntrySchema).default([]),
});

const correctionCancellationSchema = z.object({
  reason: z.string().max(500).optional().or(z.literal('')).transform((v) => v || undefined),
});

const loadCorrectionEntries = (requestId: number) =>
  (db
    .prepare(
      `SELECT id, timestamp, type, action, entry_id as entryId, created_entry_id as createdEntryId,
              original_timestamp as originalTimestamp, original_type as originalType, original_source as originalSource
         FROM time_correction_entries
         WHERE request_id = ?
         ORDER BY timestamp ASC`
    )
    .all(requestId) as any[]).map((entry) => ({ ...entry }));

const persistOriginalEntry = db.prepare(
  'UPDATE time_correction_entries SET original_timestamp = ?, original_type = ?, original_source = ? WHERE id = ?'
);

const persistCreatedEntry = db.prepare('UPDATE time_correction_entries SET created_entry_id = ? WHERE id = ?');

const revertCorrectionEntries = (userId: number, entries: any[]) => {
  const insertOriginal = db.prepare(
    'INSERT INTO time_entries (user_id, timestamp, type, source, lat, lng) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const deleteEntry = db.prepare('DELETE FROM time_entries WHERE id = ? AND user_id = ?');

  entries.forEach((entry) => {
    if (entry.action !== 'delete' && entry.createdEntryId) {
      deleteEntry.run(entry.createdEntryId, userId);
    }

    if ((entry.action === 'replace' || entry.action === 'delete') && entry.originalTimestamp && entry.originalType) {
      insertOriginal.run(
        userId,
        entry.originalTimestamp,
        entry.originalType,
        entry.originalSource ?? 'WEB',
        null,
        null
      );
    }
  });
};

router.post('/corrections', requireAuth, (req: AuthRequest, res) => {
  const parsed = correctionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const { date, note, entries } = parsed.data;
  const result = db
    .prepare('INSERT INTO time_correction_requests (user_id, date, note) VALUES (?, ?, ?)')
    .run(req.user!.id, date, note ?? null);
  const created = db.prepare('SELECT * FROM time_correction_requests WHERE id = ?').get(result.lastInsertRowid) as any;
  const insertEntry = db.prepare(
    'INSERT INTO time_correction_entries (request_id, timestamp, type, action, entry_id) VALUES (?, ?, ?, ?, ?)' // timestamp already ISO/local string
  );
  entries.forEach((entry) => insertEntry.run(created.id, entry.timestamp, entry.type, entry.action ?? 'add', entry.entry_id ?? null));
  logAction(req.user!.id, 'correction.request.create', req.user!.id, { date, entries: entries.length });
  res.status(201).json({ ...created, entries: loadCorrectionEntries(created.id) });
});

router.get('/corrections/me', requireAuth, (req: AuthRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM time_correction_requests WHERE user_id = ? ORDER BY date DESC, created_at DESC')
    .all(req.user!.id);
  res.json(rows.map((row: any) => ({ ...row, entries: loadCorrectionEntries(row.id) })));
});

router.get('/corrections/inbox', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  if (req.user!.role === 'admin' || req.user!.role === 'hr') {
    const rows = db
      .prepare(
        `SELECT tcr.*, u.name as user_name, u.email as user_email
         FROM time_correction_requests tcr
         JOIN users u ON u.id = tcr.user_id
         WHERE (tcr.status = 'pending' OR tcr.cancel_requested = 1)
         ORDER BY tcr.date DESC, tcr.created_at DESC`
      )
      .all();
    return res.json(rows.map((row: any) => ({ ...row, entries: loadCorrectionEntries(row.id) })));
  }
  const allowedDepartments = managedDepartments(req.user!.id);
  if (allowedDepartments.length === 0) return res.json([]);
  const placeholders = allowedDepartments.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT DISTINCT tcr.*, u.name as user_name, u.email as user_email
       FROM time_correction_requests tcr
       JOIN users u ON u.id = tcr.user_id
       JOIN department_members dm ON dm.user_id = u.id
       WHERE dm.department_id IN (${placeholders}) AND dm.role IN ('lead','member','hr') AND (tcr.status = 'pending' OR tcr.cancel_requested = 1)
       ORDER BY tcr.date DESC, tcr.created_at DESC`
    )
    .all(...allowedDepartments);
  res.json(rows.map((row: any) => ({ ...row, entries: loadCorrectionEntries(row.id) })));
});

router.post('/corrections/:id/cancel', requireAuth, (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Ungültige ID' });
  const parsed = correctionCancellationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });

  const row = db
    .prepare('SELECT * FROM time_correction_requests WHERE id = ?')
    .get(id) as { user_id: number; status: string; cancel_requested?: number; canceled?: number } | undefined;
  if (!row) return res.status(404).json({ message: 'Antrag nicht gefunden' });
  if (row.user_id !== req.user!.id) return res.status(403).json({ message: 'Nur eigene Anträge stornierbar' });
  if (row.status !== 'approved' || row.cancel_requested) {
    return res.status(400).json({ message: 'Stornierung nicht möglich' });
  }

  db.prepare(
    "UPDATE time_correction_requests SET cancel_requested = 1, cancel_reason = ?, status = 'pending', canceled = 0 WHERE id = ?"
  ).run(parsed.data.reason ?? null, id);
  logAction(req.user!.id, 'correction.request.cancel', row.user_id, { request_id: id });
  res.json({ message: 'Stornierung angefragt' });
});

router.patch('/corrections/:id/status', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Ungültige ID' });
  const parsed = z.enum(['approved', 'rejected']).safeParse(req.body?.status);
  if (!parsed.success) return res.status(400).json({ message: 'Status ungültig' });
  const row = db
    .prepare('SELECT * FROM time_correction_requests WHERE id = ?')
    .get(id) as { user_id: number; status: string; cancel_requested?: number } | undefined;
  if (!row) return res.status(404).json({ message: 'Antrag nicht gefunden' });
  if (req.user!.role !== 'admin' && req.user!.role !== 'hr') {
    if (!ensureManageable(req, res, row.user_id)) return;
  }

  const entries = loadCorrectionEntries(id);
  const transaction = db.transaction(() => {
    if (row.cancel_requested) {
      if (parsed.data === 'approved') {
        revertCorrectionEntries(row.user_id, entries);
        db.prepare(
          "UPDATE time_correction_requests SET status = 'canceled', canceled = 1, cancel_requested = 0, handled_by = ? WHERE id = ?"
        ).run(req.user!.id, id);
        logAction(req.user!.id, 'correction.request.cancel.approve', row.user_id, { request_id: id });
      } else {
        db.prepare("UPDATE time_correction_requests SET cancel_requested = 0, status = 'approved', handled_by = ? WHERE id = ?").run(
          req.user!.id,
          id
        );
        logAction(req.user!.id, 'correction.request.cancel.reject', row.user_id, { request_id: id });
      }
      return;
    }

    db.prepare('UPDATE time_correction_requests SET status = ?, handled_by = ?, canceled = 0 WHERE id = ?').run(
      parsed.data,
      req.user!.id,
      id
    );
    if (parsed.data === 'approved' && row.status !== 'approved') {
      const insertEntry = db.prepare(
        'INSERT INTO time_entries (user_id, timestamp, type, source, lat, lng) VALUES (?, ?, ?, ?, NULL, NULL)'
      );
      const deleteEntry = db.prepare('DELETE FROM time_entries WHERE id = ? AND user_id = ?');
      entries.forEach((entry) => {
        const entryId = entry.entryId ?? entry.entry_id;
        if (entry.action === 'delete' || entry.action === 'replace') {
          if (entryId) {
            const original = db
              .prepare('SELECT id, timestamp, type, source FROM time_entries WHERE id = ? AND user_id = ?')
              .get(entryId, row.user_id) as any;
            if (original) {
              persistOriginalEntry.run(original.timestamp, original.type, original.source ?? 'WEB', entry.id);
            }
            deleteEntry.run(entryId, row.user_id);
          }
        }
        if (entry.action !== 'delete') {
          const result = insertEntry.run(row.user_id, entry.timestamp, entry.type, 'CORRECTION');
          persistCreatedEntry.run(Number(result.lastInsertRowid), entry.id);
        }
      });
      logAction(req.user!.id, 'correction.request.approve', row.user_id, { request_id: id, entries: entries.length });
    } else {
      logAction(req.user!.id, 'correction.request.reject', row.user_id, { request_id: id });
    }
  });
  transaction();
  const updated = db.prepare('SELECT * FROM time_correction_requests WHERE id = ?').get(id) as any;
  res.json({ ...(updated || {}), entries });
});

export default router;

