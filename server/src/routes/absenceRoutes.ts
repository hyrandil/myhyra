import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { requireAuth, authorize, AuthRequest } from '../auth';
import type { Absence, WorkScheduleEntry } from '../types';
import { canManageUser, managedDepartments } from '../utils/permissions';

const router = Router();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

type AbsenceKind = {
  id: number;
  code: string;
  label: string;
  counts_as_work: number;
  allow_full: number;
  allow_half: number;
  allow_hourly: number;
};

const absenceKindByCode = (code: string): AbsenceKind | undefined =>
  db.prepare('SELECT * FROM absence_kinds WHERE code = ?').get(code) as AbsenceKind | undefined;

const kindUsage = (code: string) => {
  const used = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM absences WHERE type = ?) as absences_count,
         (SELECT COUNT(*) FROM absence_requests WHERE type = ?) as request_count`
    )
    .get(code, code) as { absences_count: number; request_count: number };
  return used.absences_count + used.request_count;
};

const timeRegex = /^\d{2}:\d{2}$/;

const absenceSchema = z
  .object({
    start_date: z.string().regex(dateRegex, 'Datum muss im Format YYYY-MM-DD vorliegen'),
    end_date: z.string().regex(dateRegex, 'Datum muss im Format YYYY-MM-DD vorliegen'),
    type: z.string().min(2),
    duration: z.enum(['full', 'half']).default('full'),
    start_time: z.string().regex(timeRegex).optional(),
    end_time: z.string().regex(timeRegex).optional(),
    note: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
  })
  .refine((value) => value.start_date <= value.end_date, {
    message: 'Enddatum muss nach dem Start liegen',
    path: ['end_date'],
  })
  .refine((value) => {
    if (!value.start_time && !value.end_time) return true;
    return Boolean(value.start_time && value.end_time);
  }, "Start- und Endzeit sind nötig")
  .refine((value) => {
    if (!value.start_time || !value.end_time) return true;
    return value.start_date === value.end_date;
  }, 'Stundenweise Abwesenheit muss an einem Tag liegen');

const absenceRequestSchema = z
  .object({
    start_date: z.string().regex(dateRegex),
    end_date: z.string().regex(dateRegex),
    type: z.string().min(2),
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

const timeDiffMinutes = (start?: string, end?: string) => {
  if (!start || !end) return null;
  const [sh = NaN, sm = NaN] = start.split(':').map((v) => Number(v));
  const [eh = NaN, em = NaN] = end.split(':').map((v) => Number(v));
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return null;
  if (endMin <= startMin) return null;
  return endMin - startMin;
};

function validateKind(type: string, duration: 'full' | 'half', hasHours: boolean) {
  const kind = absenceKindByCode(type);
  if (!kind) return { ok: false, message: 'Unbekannte Abwesenheitsart' } as const;
  if (hasHours) {
    if (!kind.allow_hourly) return { ok: false, message: 'Stundenweise Abwesenheit ist hier nicht erlaubt' } as const;
    return { ok: true, kind } as const;
  }
  if (duration === 'half' && !kind.allow_half) return { ok: false, message: 'Halbtage sind für diese Art nicht erlaubt' } as const;
  if (duration === 'full' && !kind.allow_full) return { ok: false, message: 'Ganze Tage sind für diese Art nicht erlaubt' } as const;
  return { ok: true, kind } as const;
}

const userExists = (userId: number) => Boolean(db.prepare('SELECT id FROM users WHERE id = ?').get(userId));

function getSchedule(userId: number): WorkScheduleEntry[] {
  if (!userExists(userId)) {
    return [];
  }
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

router.use(requireAuth);

router.get('/kinds', (req: AuthRequest, res) => {
  const kinds = (
    db
      .prepare(
        `SELECT id, code, label, counts_as_work, allow_full, allow_half, allow_hourly,
                (SELECT COUNT(*) FROM absences a WHERE a.type = ak.code) as absences_count,
                (SELECT COUNT(*) FROM absence_requests r WHERE r.type = ak.code) as request_count
           FROM absence_kinds ak
           ORDER BY label ASC`
      )
      .all() as any[]
  ).map((kind: any) => ({
    ...kind,
    locked: (kind as any).absences_count + (kind as any).request_count > 0,
  }));
  res.json(kinds);
});

router.post('/kinds', authorize(['admin', 'hr']), (req: AuthRequest, res) => {
  const parsed = z
    .object({
      code: z.string().min(2),
      label: z.string().min(2),
      counts_as_work: z.boolean(),
      allow_full: z.boolean().default(true),
      allow_half: z.boolean().default(true),
      allow_hourly: z.boolean().default(false),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const { code, label, counts_as_work, allow_full, allow_half, allow_hourly } = parsed.data;
  try {
    const result = db
      .prepare(
        `INSERT INTO absence_kinds (code, label, counts_as_work, allow_full, allow_half, allow_hourly)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(code, label, counts_as_work ? 1 : 0, allow_full ? 1 : 0, allow_half ? 1 : 0, allow_hourly ? 1 : 0);
    const created = db.prepare('SELECT * FROM absence_kinds WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(created);
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(409).json({ message: 'Code bereits vorhanden' });
    }
    throw error;
  }
});

router.patch('/kinds/:id', authorize(['admin', 'hr']), (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Ungültige ID' });
  const existing = db.prepare('SELECT * FROM absence_kinds WHERE id = ?').get(id) as AbsenceKind | undefined;
  if (!existing) return res.status(404).json({ message: 'Abwesenheitsart nicht gefunden' });
  if (kindUsage(existing.code) > 0) return res.status(409).json({ message: 'Art wird bereits verwendet und kann nicht bearbeitet werden.' });
  const parsed = z
    .object({
      code: z.string().min(2),
      label: z.string().min(2),
      counts_as_work: z.boolean(),
      allow_full: z.boolean().default(true),
      allow_half: z.boolean().default(true),
      allow_hourly: z.boolean().default(false),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const { code, label, counts_as_work, allow_full, allow_half, allow_hourly } = parsed.data;
  try {
    db.prepare(
      `UPDATE absence_kinds
         SET code = ?, label = ?, counts_as_work = ?, allow_full = ?, allow_half = ?, allow_hourly = ?
       WHERE id = ?`
    ).run(code, label, counts_as_work ? 1 : 0, allow_full ? 1 : 0, allow_half ? 1 : 0, allow_hourly ? 1 : 0, id);
    const updated = db.prepare('SELECT * FROM absence_kinds WHERE id = ?').get(id);
    return res.json(updated);
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE')) {
      return res.status(409).json({ message: 'Code bereits vorhanden' });
    }
    throw error;
  }
});

router.delete('/kinds/:id', authorize(['admin', 'hr']), (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Ungültige ID' });
  const existing = db.prepare('SELECT * FROM absence_kinds WHERE id = ?').get(id) as AbsenceKind | undefined;
  if (!existing) return res.status(404).json({ message: 'Abwesenheitsart nicht gefunden' });
  if (kindUsage(existing.code) > 0) {
    return res.status(409).json({ message: 'Diese Abwesenheitsart ist bereits verwendet und kann nicht gelöscht werden.' });
  }
  db.prepare('DELETE FROM absence_kinds WHERE id = ?').run(id);
  res.json({ message: 'Abwesenheitsart gelöscht' });
});

router.post('/request', (req: AuthRequest, res) => {
  const parsed = absenceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { start_date, end_date, type, comment } = parsed.data;
  const validation = validateKind(type, 'full', false);
  if (!validation.ok) return res.status(400).json({ message: validation.message });
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

router.post('/requests/:id/cancel-request', (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: 'Ungültige ID' });
  const parsedReason = z
    .string()
    .max(255)
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined)
    .safeParse(req.body?.reason ?? req.body?.comment ?? '');
  if (!parsedReason.success) return res.status(400).json({ message: 'Ungültige Begründung' });
  const row = db
    .prepare('SELECT * FROM absence_requests WHERE id = ?')
    .get(id) as { id: number; user_id: number; status: string; cancel_requested?: number; canceled?: number } | undefined;
  if (!row) return res.status(404).json({ message: 'Antrag nicht gefunden' });
  if (row.user_id !== req.user!.id) return res.status(403).json({ message: 'Keine Berechtigung' });
  if (row.canceled) return res.status(400).json({ message: 'Antrag wurde bereits storniert' });
  if (row.cancel_requested) return res.status(400).json({ message: 'Stornierung wurde bereits angefragt' });
  db.prepare('UPDATE absence_requests SET cancel_requested = 1, cancel_reason = ? WHERE id = ?').run(
    parsedReason.data ?? null,
    id
  );
  res.json({ message: 'Stornierung eingereicht' });
});

router.delete('/requests/:id', (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    return res.status(400).json({ message: 'Ungültige ID' });
  }
  const row = db
    .prepare('SELECT * FROM absence_requests WHERE id = ?')
    .get(id) as { id: number; user_id: number; status: string } | undefined;
  if (!row) {
    return res.status(404).json({ message: 'Antrag nicht gefunden' });
  }
  if (row.user_id !== req.user!.id) {
    return res.status(403).json({ message: 'Keine Berechtigung' });
  }
  if (row.status !== 'pending') {
    return res.status(400).json({ message: 'Nur offene Anträge können storniert werden' });
  }
  db.prepare('DELETE FROM absence_requests WHERE id = ?').run(id);
  return res.json({ message: 'Antrag storniert' });
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

router.get('/requests', (req: AuthRequest, res) => {
  const baseQuery =
    `SELECT DISTINCT ar.*, u.name as user_name
     FROM absence_requests ar
     JOIN users u ON u.id = ar.user_id`;
  if (req.user!.role === 'admin' || req.user!.role === 'hr') {
    const rows = db
      .prepare(
        `${baseQuery} WHERE (ar.status = 'pending' OR ar.cancel_requested = 1) ORDER BY ar.start_date DESC, ar.created_at DESC`
      )
      .all();
    return res.json(rows);
  }
  const allowedDepartments = managedDepartments(req.user!.id);
  if (allowedDepartments.length === 0) return res.json([]);
  const placeholders = allowedDepartments.map(() => '?').join(',');
  const rows = db
    .prepare(
      `${baseQuery}
       JOIN department_members dm ON dm.user_id = ar.user_id
       WHERE dm.department_id IN (${placeholders}) AND (ar.status = 'pending' OR ar.cancel_requested = 1)
       ORDER BY ar.start_date DESC, ar.created_at DESC`
    )
    .all(...allowedDepartments);
  res.json(rows);
});

router.patch('/requests/:id/status', (req: AuthRequest, res) => {
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
    .get(id) as { user_id: number; start_date: string; end_date: string; type: string; cancel_requested?: number } | undefined;
  if (!requestRow) {
    return res.status(404).json({ message: 'Antrag nicht gefunden' });
  }
  if (req.user!.role !== 'admin' && req.user!.role !== 'hr') {
    const allowed = canManageUser(req.user!.id, req.user!.role, requestRow.user_id);
    if (!allowed) {
      return res.status(403).json({ message: 'Keine Berechtigung für diese Abteilung' });
    }
  }
  if (requestRow.cancel_requested) {
    if (parsed.data === 'approved') {
      db.prepare('DELETE FROM absences WHERE user_id = ? AND NOT (end_date < ? OR start_date > ?)').run(
        requestRow.user_id,
        requestRow.start_date,
        requestRow.end_date
      );
      db.prepare('UPDATE absence_requests SET cancel_requested = 0, canceled = 1 WHERE id = ?').run(id);
      return res.json({ message: 'Stornierung bestätigt' });
    }
    db.prepare('UPDATE absence_requests SET cancel_requested = 0 WHERE id = ?').run(id);
    return res.json({ message: 'Stornierung abgelehnt' });
  }

  db.prepare('UPDATE absence_requests SET status = ?, canceled = 0 WHERE id = ?').run(parsed.data, id);
  if (parsed.data === 'approved') {
    db.prepare('DELETE FROM absences WHERE user_id = ? AND NOT (end_date < ? OR start_date > ?)').run(
      requestRow.user_id,
      requestRow.start_date,
      requestRow.end_date
    );
    db.prepare(
      "INSERT INTO absences (user_id, start_date, end_date, type, duration, start_time, end_time, minutes_override) VALUES (?, ?, ?, ?, 'full', NULL, NULL, NULL)"
    ).run(requestRow.user_id, requestRow.start_date, requestRow.end_date, requestRow.type);
  }
  res.json({ message: 'Aktualisiert' });
});

function ensureManageable(req: AuthRequest, res: any, targetUserId: number) {
  if (!req.user) return false;
  if (req.user.role === 'admin' || req.user.role === 'hr') return true;
  if (canManageUser(req.user.id, req.user.role, targetUserId)) return true;
  res.status(403).json({ message: 'Keine Berechtigung für diesen Mitarbeitenden' });
  return false;
}

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
  if (!userExists(userId)) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const schedule = getSchedule(userId);
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? ORDER BY start_date DESC, created_at DESC')
    .all(userId) as Absence[];
  res.json(absences.map((absence) => enrichAbsence(absence, schedule)));
});

router.post('/user/:userId', (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (!canManageUser(req.user!.id, req.user!.role, userId)) {
    return res.status(403).json({ message: 'Keine Berechtigung für diesen Nutzer' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: number } | undefined;
  if (!user) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const parsed = absenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { start_date, end_date, type, duration, note, start_time, end_time } = parsed.data;
  const minutesOverride = timeDiffMinutes(start_time, end_time);
  const validation = validateKind(type, duration, Boolean(minutesOverride));
  if (!validation.ok) return res.status(400).json({ message: validation.message });
  const schedule = getSchedule(userId);
  db.prepare('DELETE FROM absences WHERE user_id = ? AND NOT (end_date < ? OR start_date > ?)').run(
    userId,
    start_date,
    end_date
  );
  if (minutesOverride === null && start_time && end_time) {
    return res.status(400).json({ message: 'Zeitfenster ist ungültig' });
  }
  const stmt = db.prepare(
    'INSERT INTO absences (user_id, start_date, end_date, date, type, duration, note, start_time, end_time, minutes_override) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    userId,
    start_date,
    end_date,
    start_date,
    type,
    duration,
    note ?? null,
    start_time ?? null,
    end_time ?? null,
    minutesOverride ?? null
  );
  const created = db.prepare('SELECT * FROM absences WHERE id = ?').get(result.lastInsertRowid) as Absence;
  res.status(201).json(enrichAbsence({ ...created, start_date, end_date }, schedule));
});

router.delete('/user/:userId', (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (!ensureManageable(req, res, userId)) return;
  const parsed = absenceSchema.pick({ start_date: true, end_date: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { start_date, end_date } = parsed.data;
  db.prepare('DELETE FROM absences WHERE user_id = ? AND NOT (end_date < ? OR start_date > ?)').run(
    userId,
    start_date,
    end_date
  );
  res.json({ message: 'Abwesenheit entfernt' });
});

router.delete('/:id', (req: AuthRequest, res) => {
  const absenceId = Number(req.params.id);
  if (Number.isNaN(absenceId)) {
    return res.status(400).json({ message: 'Ungültige Abwesenheits-ID' });
  }
  const existing = db
    .prepare('SELECT user_id FROM absences WHERE id = ?')
    .get(absenceId) as { user_id: number } | undefined;
  if (!existing) {
    return res.status(404).json({ message: 'Eintrag nicht gefunden' });
  }
  if (!canManageUser(req.user!.id, req.user!.role, existing.user_id)) {
    return res.status(403).json({ message: 'Keine Berechtigung für diesen Nutzer' });
  }
  const result = db.prepare('DELETE FROM absences WHERE id = ?').run(absenceId);
  res.json({ message: 'Eintrag gelöscht' });
});

export default router;
