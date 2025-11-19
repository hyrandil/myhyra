import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize } from '../auth';
import type { User } from '../types';

const router = Router();

router.use(authenticate, authorize(['admin']));

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['user', 'admin']).optional().default('user'),
});

router.get('/', (_req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, created_at FROM users WHERE role = 'user' ORDER BY name ASC")
    .all() as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'>[];
  res.json(users);
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
  const stmt = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
  const result = stmt.run(name, email, passwordHash, role);
  const created = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(result.lastInsertRowid) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'>;
  res.status(201).json(created);
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

export default router;
