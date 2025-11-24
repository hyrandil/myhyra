import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db';
import { signToken } from '../auth';
import { authorize, authenticate, AuthRequest } from '../auth';
import type { User } from '../types';

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['employee', 'lead', 'hr', 'admin']).optional().default('employee'),
});

router.post('/register', authenticate, authorize(['admin', 'hr']), (req: AuthRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
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
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(Number(result.lastInsertRowid));
  db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(Number(result.lastInsertRowid));
  res.json({ id: result.lastInsertRowid, name, email, role });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { email, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  if (!user) {
    return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  }
  if (!user.active) {
    return res.status(403).json({ message: 'Dieser Zugang wurde deaktiviert' });
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: 'Ungültige Zugangsdaten' });
  }
  const token = signToken({ id: user.id, role: user.role });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

export default router;
