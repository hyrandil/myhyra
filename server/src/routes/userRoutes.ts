import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize, AuthRequest } from '../auth';
import type { User } from '../types';

const router = Router();

const ensureSettingsRow = (userId: number) => {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
};

const toUserPayload = (
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & { active: number; vacation_allowance?: number }
) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  created_at: user.created_at,
  active: Boolean(user.active),
  vacationAllowance: user.vacation_allowance ?? 0,
});

router.use(authenticate);

const selfPasswordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwörter stimmen nicht überein',
    path: ['confirmPassword'],
  });

router.patch('/me/password', (req: AuthRequest, res) => {
  const parsed = selfPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const user = db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(req.user!.id) as { password_hash: string } | undefined;
  if (!user) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const valid = bcrypt.compareSync(parsed.data.currentPassword, user.password_hash);
  if (!valid) {
    return res.status(400).json({ message: 'Das alte Passwort ist nicht korrekt' });
  }
  const passwordHash = bcrypt.hashSync(parsed.data.newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user!.id);
  res.json({ message: 'Passwort aktualisiert' });
});

const selfSettingsSchema = z.object({
  language: z.enum(['de', 'en']),
  week_start: z.enum(['monday', 'sunday']),
  time_format: z.enum(['24h', '12h']),
});

router.get('/me/settings', (req: AuthRequest, res) => {
  ensureSettingsRow(req.user!.id);
  const settings = db
    .prepare(
      'SELECT language, week_start, time_format, vacation_allowance FROM user_settings WHERE user_id = ?'
    )
    .get(req.user!.id) as
    | {
        language: string;
        week_start: string | null;
        time_format: string | null;
        vacation_allowance: number;
      }
    | undefined;
  if (!settings) {
    return res.status(404).json({ message: 'Einstellungen nicht gefunden' });
  }
  res.json({
    language: settings.language,
    week_start: settings.week_start ?? 'monday',
    time_format: settings.time_format ?? '24h',
    vacation_allowance: settings.vacation_allowance,
  });
});

router.patch('/me/settings', (req: AuthRequest, res) => {
  const parsed = selfSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureSettingsRow(req.user!.id);
  db.prepare(
    `UPDATE user_settings
     SET language = ?, week_start = ?, time_format = ?
     WHERE user_id = ?`
  ).run(parsed.data.language, parsed.data.week_start, parsed.data.time_format, req.user!.id);
  res.json({ message: 'Einstellungen gespeichert' });
});

router.use(authorize(['admin']));

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['user', 'admin']).optional().default('user'),
  vacationAllowance: z.number().min(0).max(80).optional(),
});

router.get('/', (req: AuthRequest, res) => {
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id != ?
       ORDER BY u.name ASC`
    )
    .all(req.user!.id) as (Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
    })[];
  res.json(users.map((user) => toUserPayload(user)));
});

router.post('/', (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { name, email, password, role, vacationAllowance } = parsed.data;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) {
    return res.status(409).json({ message: 'E-Mail bereits vorhanden' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)');
  const result = stmt.run(name, email, passwordHash, role);
  db.prepare('INSERT INTO user_settings (user_id, vacation_allowance) VALUES (?, ?)').run(
    Number(result.lastInsertRowid),
    vacationAllowance ?? 30
  );
  const created = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = ?`
    )
    .get(result.lastInsertRowid) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
    };
  res.status(201).json(toUserPayload(created));
});

const passwordSchema = z.object({
  password: z.string().min(6),
});

router.patch('/:id/password', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const passwordHash = bcrypt.hashSync(parsed.data.password, 10);
  const result = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  res.json({ message: 'Passwort aktualisiert' });
});

const statusSchema = z.object({ active: z.boolean() });

router.patch('/:id/status', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const result = db.prepare('UPDATE users SET active = ? WHERE id = ?').run(parsed.data.active ? 1 : 0, userId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const updated = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
    };
  res.json(toUserPayload(updated));
});

const userUpdateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
});

router.patch('/:id', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = userUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const duplicate = db
    .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(parsed.data.email, userId) as { id: number } | undefined;
  if (duplicate) {
    return res.status(409).json({ message: 'E-Mail ist bereits vergeben' });
  }
  const result = db
    .prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?')
    .run(parsed.data.name, parsed.data.email, parsed.data.role, userId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const updated = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
    };
  res.json(toUserPayload(updated));
});

const adminSettingsSchema = z.object({
  vacation_allowance: z.number().min(0).max(80),
});

router.patch('/:id/settings', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = adminSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureSettingsRow(userId);
  db.prepare('UPDATE user_settings SET vacation_allowance = ? WHERE user_id = ?').run(
    parsed.data.vacation_allowance,
    userId
  );
  const updated = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
    };
  res.json(toUserPayload(updated));
});

export default router;
