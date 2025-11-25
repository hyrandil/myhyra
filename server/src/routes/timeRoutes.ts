import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, AuthRequest, authorize } from '../auth';
import { Absence, TimeEntry, WorkScheduleEntry } from '../types';
import { computeDayWorkMinutes, computeDelta } from '../services/timeService';
import { canManageUser } from '../utils/permissions';

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

const manualEntrySchema = z.object({
  timestamp: z.string().datetime(),
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
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

function buildDailySummary(userId: number, month?: string, maskAbsences = false) {
  const now = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const profile = db
    .prepare('SELECT tracking_start_date, start_date FROM user_profiles WHERE user_id = ?')
    .get(userId) as { tracking_start_date?: string | null; start_date?: string | null } | undefined;
  const trackingStartValue = profile?.tracking_start_date || profile?.start_date;
  const trackingStartDate = trackingStartValue ? new Date(`${trackingStartValue}T00:00:00Z`) : undefined;
  const schedule = getSchedule(userId);
  const planMap = new Map(schedule.map((entry) => [entry.weekday, entry.minutes]));

  const entryRows = db
    .prepare('SELECT * FROM time_entries WHERE user_id = ? AND date(timestamp) BETWEEN ? AND ?')
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as TimeEntry[];

  const manualAbsences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? AND NOT (end_date < ? OR start_date > ?)')
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as Absence[];

  const approvedRequests = db
    .prepare(
      "SELECT user_id, start_date, end_date, type, 'full' as duration, NULL as note, created_at, id FROM absence_requests WHERE user_id = ? AND status = 'approved' AND NOT (end_date < ? OR start_date > ?)"
    )
    .all(userId, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as Absence[];

  const absenceKey = new Set(
    manualAbsences.map((a) => `${a.start_date}|${a.end_date}|${a.type}|${a.duration ?? 'full'}`)
  );
  const absences = [
    ...manualAbsences,
    ...approvedRequests.filter((a) => !absenceKey.has(`${a.start_date}|${a.end_date}|${a.type}|${a.duration ?? 'full'}`)),
  ];

  const pendingRequests = db
    .prepare(
      "SELECT * FROM absence_requests WHERE user_id = ? AND status = 'pending' AND NOT (end_date < ? OR start_date > ?)"
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
  absences.forEach((absence) => {
    const days = (() => {
      const workingMap = new Map(schedule.map((entry) => [entry.weekday, entry.minutes]));
      const results: string[] = [];
      let cursor = new Date(`${absence.start_date}T00:00:00Z`);
      const endDate = new Date(`${absence.end_date}T00:00:00Z`);
      while (cursor.getTime() <= endDate.getTime()) {
        const weekday = (cursor.getUTCDay() + 6) % 7;
        if ((workingMap.get(weekday) ?? 0) > 0) {
          results.push(cursor.toISOString().slice(0, 10));
        }
        cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
      }
      return results;
    })();
    days.forEach((day) => {
      const list = absenceMap.get(day) ?? [];
      list.push(absence);
      absenceMap.set(day, list);
    });
  });

  const statusForDay = (entries: TimeEntry[], abs: Absence[], pending: boolean): string => {
    if (abs.some((a) => a.type === 'vacation')) return 'vacation';
    if (abs.length > 0) return 'away';
    if (pending) return 'pending';
    if (entries.length === 0) return 'empty';
    const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
    const absencesForDay = absenceMap.get(key) ?? [];
    const baseWork = computeDayWorkMinutes(entries);

    let creditVacation = 0;
    let topUpOther = 0;
    absencesForDay.forEach((absence) => {
      const factor = absence.duration === 'half' ? 0.5 : 1;
      const target = Math.round(planned * factor);
      if (absence.type === 'vacation') {
        creditVacation += target;
      } else {
        const covered = baseWork + creditVacation + topUpOther;
        const topUp = Math.max(target - covered, 0);
        topUpOther += topUp;
      }
    });

    const hasPending = pendingRequests.some((item) => item.start_date <= key && item.end_date >= key);
    const inactiveBeforeTracking = trackingStartDate && cursor.getTime() < trackingStartDate.getTime();
    const effectivePlanned = inactiveBeforeTracking ? 0 : planned;
    const effectiveWorked = inactiveBeforeTracking ? 0 : baseWork + creditVacation + topUpOther;
    const delta = computeDelta(effectivePlanned, effectiveWorked);
    const status = inactiveBeforeTracking
      ? 'inactive'
      : statusForDay(entries, absencesForDay, hasPending);
    const absenceLabels: string[] = absencesForDay.map((a) => {
      if (a.type === 'vacation') return 'Urlaub';
      if (maskAbsences) return 'Nicht im Haus';
      if (a.type === 'sick') return 'Krank';
      if (a.type === 'remote') return 'Remote';
      return 'Sonstige';
    });
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

  return { month: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`, days };
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
  if (!ensureManageable(req, res, userId)) return;
  res.json(buildDailySummary(userId, month));
});

router.get('/overview', (req: AuthRequest, res) => {
  const { month, department, userId } = req.query as { month?: string; department?: string; userId?: string };
  const today = new Date();
  const monthValue = month || `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const base = new Date(`${monthValue}-01T00:00:00Z`);
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));

  const deptFilter = department?.trim();
  const userRows = deptFilter
    ? (db
        .prepare(
          'SELECT u.id, u.name, up.department FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id WHERE up.department = ?'
        )
        .all(deptFilter) as { id: number; name: string; department?: string | null }[])
    : (db
        .prepare('SELECT u.id, u.name, up.department FROM users u LEFT JOIN user_profiles up ON up.user_id = u.id')
        .all() as { id: number; name: string; department?: string | null }[]);

  const filteredByUser = userId ? userRows.filter((row) => row.id === Number(userId)) : userRows;
  const selectedUsers = filteredByUser.length > 0 ? filteredByUser : userRows;

  const userMap = new Map<number, { name: string; department?: string | null }>();
  selectedUsers.forEach((row) => userMap.set(row.id, { name: row.name, department: row.department ?? null }));

  const userIds = selectedUsers.map((row: any) => row.id);
  if (userIds.length === 0) return res.json({ month: monthValue, days: {} });

  const placeholders = userIds.map(() => '?').join(',');
  const manualAbsences = db
    .prepare(
      `SELECT * FROM absences WHERE user_id IN (${placeholders}) AND NOT (end_date < ? OR start_date > ?)`
    )
    .all(...userIds, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as Absence[];

  const approvedRequests = db
    .prepare(
      `SELECT user_id, start_date, end_date, type, 'full' as duration, NULL as note, created_at, id
       FROM absence_requests
       WHERE status = 'approved' AND user_id IN (${placeholders}) AND NOT (end_date < ? OR start_date > ?)`
    )
    .all(...userIds, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)) as Absence[];

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
          delta: 0,
          absences: [],
          status: 'ok',
          pending: false,
          users: [],
        };
      }
      if (!days[key].users.some((u: any) => u.id === user.id)) {
        days[key].users.push(user);
      }
      if (type === 'vacation') {
        days[key].status = 'vacation';
        if (!days[key].absences.includes('Urlaub')) days[key].absences.push('Urlaub');
      } else {
        if (days[key].status !== 'vacation') days[key].status = 'away';
        if (!days[key].absences.includes('Nicht im Haus')) days[key].absences.push('Nicht im Haus');
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  };

  [...manualAbsences, ...approvedRequests].forEach((absence) => {
    const meta = userMap.get((absence as any).user_id);
    if (!meta) return;
    addRange(absence.start_date, absence.end_date, absence.type, {
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
  res.status(201).json(entry);
});

export default router;

