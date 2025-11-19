import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize, AuthRequest } from '../auth';
import type { User } from '../types';

const router = Router();

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

router.use(authorize(['admin']));

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['user', 'admin']).optional().default('user'),
});

router.get('/', (req: AuthRequest, res) => {
  const users = db
    .prepare(
      'SELECT id, name, email, role, created_at, active FROM users WHERE id != ? ORDER BY name ASC'
    )
    .all(req.user!.id) as (Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & { active: number })[];
  res.json(users.map((user) => ({ ...user, active: Boolean(user.active) })));
});

router.post('/', (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { name, email, password, role } = parsed.data;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) {
    return res.status(409).json({ message: 'E-Mail bereits vorhanden' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)');
  const result = stmt.run(name, email, passwordHash, role);
  const created = db
    .prepare('SELECT id, name, email, role, created_at, active FROM users WHERE id = ?')
    .get(result.lastInsertRowid) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & { active: number };
  res.status(201).json({ ...created, active: Boolean(created.active) });
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
    .prepare('SELECT id, name, email, role, created_at, active FROM users WHERE id = ?')
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & { active: number };
  res.json({ ...updated, active: Boolean(updated.active) });
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
    .prepare('SELECT id, name, email, role, created_at, active FROM users WHERE id = ?')
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & { active: number };
  res.json({ ...updated, active: Boolean(updated.active) });
});

export default router;
