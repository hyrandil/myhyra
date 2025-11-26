import { Router } from 'express';
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

type AbsenceDayUsage = {
  vacation: Map<string, number>;
  sick: Map<string, number>;
  remote: Map<string, number>;
  other: Map<string, number>;
};

router.get('/attendance', (req, res) => {
  const monthParam = typeof req.query.month === 'string' && monthRegex.test(req.query.month)
    ? req.query.month
    : undefined;
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

  const settings = db
    .prepare('SELECT user_id, vacation_allowance FROM user_settings')
    .all() as { user_id: number; vacation_allowance: number }[];

  const users = db
    .prepare('SELECT id, name, email FROM users ORDER BY name ASC')
    .all() as { id: number; name: string; email: string }[];

  const allowanceMap = new Map(settings.map((item) => [item.user_id, item.vacation_allowance]));
  const presenceMap = new Map<number, Set<string>>();
  bookings.forEach((row) => {
    if (!presenceMap.has(row.user_id)) {
      presenceMap.set(row.user_id, new Set());
    }
    presenceMap.get(row.user_id)!.add(row.work_day);
  });

  type AbsenceBucket = {
    vacation: number;
    sick: number;
    remote: number;
    other: number;
  };
  const absenceMap = new Map<number, AbsenceBucket>();
  const absenceUsage = new Map<number, AbsenceDayUsage>();

  const scheduleCache = new Map<number, WorkScheduleEntry[]>();

  const addAbsence = (userId: number, type: keyof AbsenceDayUsage, duration: 'full' | 'half', start: string, end: string) => {
    if (!absenceMap.has(userId)) {
      absenceMap.set(userId, { vacation: 0, sick: 0, remote: 0, other: 0 });
    }
    if (!absenceUsage.has(userId)) {
      absenceUsage.set(userId, {
        vacation: new Map<string, number>(),
        sick: new Map<string, number>(),
        remote: new Map<string, number>(),
        other: new Map<string, number>(),
      });
    }
    if (!scheduleCache.has(userId)) {
      scheduleCache.set(userId, scheduleForUser(userId));
    }
    const schedule = scheduleCache.get(userId)!;
    const days = workingDatesBetween(start, end, schedule);
    const dayValue = duration === 'half' ? 0.5 : 1;
    const perUser = absenceUsage.get(userId)!;
    days.forEach((day) => {
      const current = perUser[type].get(day) ?? 0;
      perUser[type].set(day, Math.max(current, dayValue));
    });
  };

  absences.forEach((row) => addAbsence(row.user_id, row.type as keyof AbsenceDayUsage, row.duration, row.start_date, row.end_date));

  const sumDays = (map: Map<string, number>) => {
    let total = 0;
    map.forEach((value) => {
      total += value;
    });
    return total;
  };

  absenceUsage.forEach((usage, userId) => {
    const bucket = absenceMap.get(userId) ?? { vacation: 0, sick: 0, remote: 0, other: 0 };
    bucket.vacation = sumDays(usage.vacation);
    bucket.sick = sumDays(usage.sick);
    bucket.remote = sumDays(usage.remote);
    bucket.other = sumDays(usage.other);
    absenceMap.set(userId, bucket);
  });

  const rows = users.map((user) => {
    const presenceDays = presenceMap.get(user.id)?.size ?? 0;
    const absenceBucket = absenceMap.get(user.id) ?? { vacation: 0, sick: 0, remote: 0, other: 0 };
    const allowance = allowanceMap.get(user.id) ?? 0;
    const usedVacation = absenceBucket.vacation;
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      presenceDays,
      vacationDays: absenceBucket.vacation,
      sickDays: absenceBucket.sick,
      remoteDays: absenceBucket.remote,
      otherAbsences: absenceBucket.other,
      remainingVacation: Math.max(allowance - usedVacation, 0),
    };
  });

  res.json({ month, rows });
});

export default router;
