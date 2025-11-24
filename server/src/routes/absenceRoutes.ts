import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize, AuthRequest } from '../auth';
import type { Absence, WorkScheduleEntry } from '../types';

const router = Router();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const absenceSchema = z
  .object({
    start_date: z.string().regex(dateRegex, 'Datum muss im Format YYYY-MM-DD vorliegen'),
    end_date: z.string().regex(dateRegex, 'Datum muss im Format YYYY-MM-DD vorliegen'),
    type: z.enum(['vacation', 'sick', 'remote', 'other']).default('vacation'),
    duration: z.enum(['full', 'half']).default('full'),
    note: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
  })
  .refine((value) => value.start_date <= value.end_date, {
    message: 'Enddatum muss nach dem Start liegen',
    path: ['end_date'],
  });

const absenceRequestSchema = z
  .object({
    start_date: z.string().regex(dateRegex),
    end_date: z.string().regex(dateRegex),
    type: z.enum(['vacation', 'sick', 'remote', 'other']).default('vacation'),
    comment: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
  })
  .refine((value) => value.start_date <= value.end_date, {
    message: 'Enddatum muss nach dem Start liegen',
    path: ['end_date'],
  });

const parseDate = (value: string) => {
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const weekdayFromDate = (date: Date) => (date.getUTCDay() + 6) % 7; // Monday = 0

function getSchedule(userId: number): WorkScheduleEntry[] {
  const entries = db
    .prepare('SELECT user_id, weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
  if (entries.length === 7) {
    return entries;
  }
  const defaults = [480, 480, 480, 480, 480, 0, 0];
  const insert = db.prepare('INSERT OR IGNORE INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
  defaults.forEach((minutes, weekday) => insert.run(userId, weekday, minutes));
  return db
    .prepare('SELECT user_id, weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
}

function workingDatesBetween(start: string, end: string, schedule: WorkScheduleEntry[]) {
  const workingMap = new Map(schedule.map((entry) => [entry.weekday, entry.minutes]));
  const results: string[] = [];
  let cursor = parseDate(start);
  const endDate = parseDate(end);
  while (cursor.getTime() <= endDate.getTime()) {
    const weekday = weekdayFromDate(cursor);
    const minutes = workingMap.get(weekday) ?? 0;
    if (minutes > 0) {
      results.push(formatDate(cursor));
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return results;
}

const enrichAbsence = (row: Absence, schedule: WorkScheduleEntry[]) => {
  const days = workingDatesBetween(row.start_date, row.end_date, schedule);
  return { ...row, days } as Absence;
};

const buildVacationUsage = (absences: Absence[], schedule: WorkScheduleEntry[]) => {
  const usage = new Map<string, number>();
  absences
    .filter((item) => item.type === 'vacation')
    .forEach((item) => {
      const factor = item.duration === 'half' ? 0.5 : 1;
      workingDatesBetween(item.start_date, item.end_date, schedule).forEach((day) => {
        const current = usage.get(day) ?? 0;
        usage.set(day, Math.max(current, factor));
      });
    });
  let total = 0;
  usage.forEach((value) => {
    total += value;
  });
  return total;
};

router.use(authenticate);

router.post('/request', (req: AuthRequest, res) => {
  const parsed = absenceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { start_date, end_date, type, comment } = parsed.data;
  const stmt = db.prepare(
    `INSERT INTO absence_requests (user_id, start_date, end_date, type, status, comment, created_by)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`
  );
  const result = stmt.run(req.user!.id, start_date, end_date, type, comment ?? null, req.user!.id);
  res.status(201).json({ id: result.lastInsertRowid, status: 'pending' });
});

router.get('/requests/me', (req: AuthRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM absence_requests WHERE user_id = ? ORDER BY start_date DESC')
    .all(req.user!.id);
  res.json(rows);
});

router.get('/me', (req: AuthRequest, res) => {
  const schedule = getSchedule(req.user!.id);
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? ORDER BY start_date DESC, created_at DESC')
    .all(req.user!.id) as Absence[];
  res.json(absences.map((absence) => enrichAbsence(absence, schedule)));
});

router.get('/me/summary', (req: AuthRequest, res) => {
  const allowanceRow = db
    .prepare('SELECT vacation_allowance FROM user_settings WHERE user_id = ?')
    .get(req.user!.id) as { vacation_allowance: number } | undefined;
  const allowance = allowanceRow?.vacation_allowance ?? 0;
  const schedule = getSchedule(req.user!.id);
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ?')
    .all(req.user!.id) as Absence[];
  const used = buildVacationUsage(absences, schedule);
  res.json({ allowance, used, remaining: Math.max(allowance - used, 0) });
});

router.use(authorize(['admin', 'hr', 'lead']));

router.get('/requests', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT ar.*, u.name as user_name
       FROM absence_requests ar
       JOIN users u ON u.id = ar.user_id
       ORDER BY ar.start_date DESC, ar.created_at DESC`
    )
    .all();
  res.json(rows);
});

router.patch('/requests/:id/status', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Ungültige ID' });
  }
  const parsed = z.enum(['approved', 'rejected']).safeParse(req.body?.status);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Status fehlt oder ist ungültig' });
  }
  const requestRow = db
    .prepare('SELECT * FROM absence_requests WHERE id = ?')
    .get(id) as { user_id: number; start_date: string; end_date: string; type: string } | undefined;
  if (!requestRow) {
    return res.status(404).json({ message: 'Antrag nicht gefunden' });
  }
  db.prepare('UPDATE absence_requests SET status = ? WHERE id = ?').run(parsed.data, id);
  if (parsed.data === 'approved') {
    db.prepare(
      'INSERT INTO absences (user_id, start_date, end_date, type, duration) VALUES (?, ?, ?, ?, "full")'
    ).run(requestRow.user_id, requestRow.start_date, requestRow.end_date, requestRow.type);
  }
  res.json({ message: 'Aktualisiert' });
});

router.get('/summary', (_req, res) => {
  const users = db
    .prepare(
      `SELECT u.id as user_id, u.name, u.email, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       ORDER BY u.name ASC`
    )
    .all() as { user_id: number; name: string; email: string; vacation_allowance: number }[];
  const payload = users.map((row) => {
    const schedule = getSchedule(row.user_id);
    const absences = db
      .prepare('SELECT * FROM absences WHERE user_id = ?')
      .all(row.user_id) as Absence[];
    const used = buildVacationUsage(absences, schedule);
    return {
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      allowance: row.vacation_allowance,
      used,
      remaining: Math.max(row.vacation_allowance - used, 0),
    };
  });
  res.json(payload);
});

router.get('/user/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const schedule = getSchedule(userId);
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? ORDER BY start_date DESC, created_at DESC')
    .all(userId) as Absence[];
  res.json(absences.map((absence) => enrichAbsence(absence, schedule)));
});

router.post('/user/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
  if (!user) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const parsed = absenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { start_date, end_date, type, duration, note } = parsed.data;
  const schedule = getSchedule(userId);
  db.prepare('DELETE FROM absences WHERE user_id = ? AND NOT (end_date < ? OR start_date > ?)').run(
    userId,
    start_date,
    end_date
  );
  const stmt = db.prepare(
    'INSERT INTO absences (user_id, start_date, end_date, date, type, duration, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(userId, start_date, end_date, start_date, type, duration, note ?? null);
  const created = db.prepare('SELECT * FROM absences WHERE id = ?').get(result.lastInsertRowid) as Absence;
  res.status(201).json(enrichAbsence({ ...created, start_date, end_date }, schedule));
});

router.delete('/:id', (req, res) => {
  const absenceId = Number(req.params.id);
  if (Number.isNaN(absenceId)) {
    return res.status(400).json({ message: 'Ungültige Abwesenheits-ID' });
  }
  const result = db.prepare('DELETE FROM absences WHERE id = ?').run(absenceId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Eintrag nicht gefunden' });
  }
  res.json({ message: 'Eintrag gelöscht' });
});

export default router;
