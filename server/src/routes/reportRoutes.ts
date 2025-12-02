import { Router } from 'express';
import { utils, write } from 'xlsx';
import db from '../db';
import { requireAuth, authorize } from '../auth';
import type { WorkScheduleEntry } from '../types';

const router = Router();

router.use(requireAuth);
router.use(authorize(['admin', 'hr']));

const monthRegex = /^\d{4}-\d{2}$/;

const parseDate = (value: string) => {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return new Date(Date.UTC(year, month - 1, day));
};

const weekdayFromDate = (date: Date) => (date.getUTCDay() + 6) % 7;

const workingDatesBetween = (start: string, end: string, schedule: WorkScheduleEntry[]) => {
  const workingMap = new Map(schedule.map((entry) => [entry.weekday, entry.minutes]));
  const results: string[] = [];
  let cursor = parseDate(start);
  const endDate = parseDate(end);
  while (cursor.getTime() <= endDate.getTime()) {
    const weekday = weekdayFromDate(cursor);
    const minutes = workingMap.get(weekday) ?? 0;
    if (minutes > 0) {
      results.push(cursor.toISOString().slice(0, 10));
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return results;
};

const scheduleForUser = (userId: number) => {
  const rows = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
  if (rows.length === 7) {
    return rows;
  }
  const defaults = [480, 480, 480, 480, 480, 0, 0];
  const insert = db.prepare('INSERT OR IGNORE INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
  defaults.forEach((minutes, weekday) => insert.run(userId, weekday, minutes));
  return db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
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
  const absenceDays = new Map<number, Set<string>>();

  const scheduleCache = new Map<number, WorkScheduleEntry[]>();

  const addAbsence = (userId: number, type: string, duration: 'full' | 'half', start: string, end: string) => {
    if (!absenceUsage.has(userId)) {
      absenceUsage.set(userId, new Map());
    }
    if (!scheduleCache.has(userId)) {
      scheduleCache.set(userId, scheduleForUser(userId));
    }
    const schedule = scheduleCache.get(userId)!;
    const days = workingDatesBetween(start, end, schedule);
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

  absences.forEach((row) => {
    if (!scheduleCache.has(row.user_id)) {
      scheduleCache.set(row.user_id, scheduleForUser(row.user_id));
    }
    const schedule = scheduleCache.get(row.user_id)!;
    const days = workingDatesBetween(row.start_date, row.end_date, schedule);
    if (!absenceDays.has(row.user_id)) absenceDays.set(row.user_id, new Set());
    days.forEach((day) => absenceDays.get(row.user_id)!.add(day));
  });

  bookings.forEach((row) => {
    const blocked = absenceDays.get(row.user_id);
    if (blocked && blocked.has(row.work_day)) return;
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
