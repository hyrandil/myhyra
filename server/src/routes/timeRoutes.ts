import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, AuthRequest } from '../auth';
import { TimeEntry, WorkScheduleEntry } from '../types';
import { computeDayWorkMinutes, computeDelta } from '../services/timeService';

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

function lastEntry(userId: number): TimeEntry | undefined {
  return db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1')
    .get(userId) as TimeEntry | undefined;
}

function insertEntry(
  userId: number,
  type: TimeEntry['type'],
  source: TimeEntry['source'],
  location?: { lat?: number | null; lng?: number | null }
) {
  const stmt = db.prepare(
    "INSERT INTO time_entries (user_id, timestamp, type, source, lat, lng) VALUES (?, datetime('now'), ?, ?, ?, ?)"
  );
  return stmt.run(userId, type, source, location?.lat ?? null, location?.lng ?? null);
}

router.use(authenticate);

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
  const now = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const profile = db
    .prepare('SELECT tracking_start_date, start_date FROM user_profiles WHERE user_id = ?')
    .get(req.user!.id) as { tracking_start_date?: string | null; start_date?: string | null } | undefined;
  const trackingStartValue = profile?.tracking_start_date || profile?.start_date;
  const trackingStartDate = trackingStartValue ? new Date(`${trackingStartValue}T00:00:00Z`) : undefined;
  const schedule = getSchedule(req.user!.id);
  const planMap = new Map(schedule.map((entry) => [entry.weekday, entry.minutes]));

  const entryRows = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND date(timestamp) BETWEEN ? AND ?')
    .all(
      req.user!.id,
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10)
    ) as TimeEntry[];

  const absences = db
    .prepare(
      "SELECT * FROM absence_requests WHERE user_id = ? AND status = 'approved' AND NOT (end_date < ? OR start_date > ?)"
    )
    .all(req.user!.id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as {
      start_date: string;
      end_date: string;
      type: string;
      status: string;
    }[];

  const pendingRequests = db
    .prepare(
      "SELECT * FROM absence_requests WHERE user_id = ? AND status = 'pending' AND NOT (end_date < ? OR start_date > ?)"
    )
    .all(req.user!.id, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as {
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

  const statusForDay = (entries: TimeEntry[], abs: string[], pending: boolean): string => {
    if (abs.includes('sick')) return 'sick';
    if (abs.includes('vacation')) return 'vacation';
    if (pending) return 'pending';
    if (entries.length === 0) return 'empty';
    const sorted = [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const lastType = sorted.length > 0 ? sorted[sorted.length - 1]!.type : undefined;
    if (lastType && lastType !== 'CLOCK_OUT') return 'open';
    return 'ok';
  };

  const cursor = new Date(start);
  const days: Record<
    string,
    { worked: number; planned: number; delta: number; absences: string[]; status: string; pending?: boolean }
  > = {};
  while (cursor.getTime() <= end.getTime()) {
    const key = cursor.toISOString().slice(0, 10);
    const weekday = (cursor.getUTCDay() + 6) % 7;
    const planned = planMap.get(weekday) ?? 0;
    const entries = grouped.get(key) ?? [];
    const worked = computeDayWorkMinutes(entries);
    const absenceLabels: string[] = [];
    absences.forEach((item) => {
      if (item.start_date <= key && item.end_date >= key) {
        absenceLabels.push(item.type);
      }
    });
    const hasPending = pendingRequests.some((item) => item.start_date <= key && item.end_date >= key);
    const inactiveBeforeTracking = trackingStartDate && cursor.getTime() < trackingStartDate.getTime();
    const effectivePlanned = inactiveBeforeTracking ? 0 : planned;
    const effectiveWorked = inactiveBeforeTracking ? 0 : worked;
    const delta = computeDelta(effectivePlanned, effectiveWorked);
    const status = inactiveBeforeTracking ? 'inactive' : statusForDay(entries, absenceLabels, hasPending);
    if (hasPending) {
      absenceLabels.push('pending');
    }
    days[key] = {
      worked: effectiveWorked,
      planned: effectivePlanned,
      delta,
      absences: absenceLabels,
      status,
      pending: hasPending,
    };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  res.json({ month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, days });
});

export default router;

