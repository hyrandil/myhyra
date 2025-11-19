import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize, AuthRequest } from '../auth';
import type { Absence } from '../types';

const router = Router();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const absenceSchema = z.object({
  date: z.string().regex(dateRegex, 'Datum muss im Format YYYY-MM-DD vorliegen'),
  type: z.enum(['vacation', 'sick', 'remote', 'training', 'other']).default('vacation'),
  duration: z.enum(['full', 'half']).default('full'),
  note: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
});

router.use(authenticate);

router.get('/me', (req: AuthRequest, res) => {
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? ORDER BY date DESC, created_at DESC')
    .all(req.user!.id) as Absence[];
  res.json(absences);
});

router.get('/me/summary', (req: AuthRequest, res) => {
  const summary = db
    .prepare(
      `SELECT us.vacation_allowance as allowance, IFNULL(SUM(CASE WHEN a.type = 'vacation' THEN CASE WHEN a.duration = 'half' THEN 0.5 ELSE 1 END ELSE 0 END), 0) as used
       FROM user_settings us
       LEFT JOIN absences a ON a.user_id = us.user_id
       WHERE us.user_id = ?`
    )
    .get(req.user!.id) as { allowance: number; used: number } | undefined;
  const allowance = summary?.allowance ?? 0;
  const used = summary?.used ?? 0;
  res.json({ allowance, used, remaining: Math.max(allowance - used, 0) });
});

router.use(authorize(['admin']));

router.get('/summary', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id as user_id, u.name, u.email, us.vacation_allowance,
        IFNULL(SUM(CASE WHEN a.type = 'vacation' THEN CASE WHEN a.duration = 'half' THEN 0.5 ELSE 1 END ELSE 0 END), 0) as used
      FROM users u
      LEFT JOIN user_settings us ON us.user_id = u.id
      LEFT JOIN absences a ON a.user_id = u.id
      GROUP BY u.id, u.name, u.email, us.vacation_allowance
      ORDER BY u.name ASC`
    )
    .all() as { user_id: number; name: string; email: string; vacation_allowance: number | null; used: number }[];
  const payload = rows.map((row) => {
    const allowance = row.vacation_allowance ?? 0;
    return {
      user_id: row.user_id,
      name: row.name,
      email: row.email,
      allowance,
      used: row.used,
      remaining: Math.max(allowance - row.used, 0),
    };
  });
  res.json(payload);
});

router.get('/user/:userId', (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? ORDER BY date DESC, created_at DESC')
    .all(userId) as Absence[];
  res.json(absences);
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
  const { date, type, duration, note } = parsed.data;
  const stmt = db.prepare('INSERT INTO absences (user_id, date, type, duration, note) VALUES (?, ?, ?, ?, ?)');
  const result = stmt.run(userId, date, type, duration, note ?? null);
  const created = db.prepare('SELECT * FROM absences WHERE id = ?').get(result.lastInsertRowid) as Absence;
  res.status(201).json(created);
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
