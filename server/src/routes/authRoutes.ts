import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db';
import { authorize, requireAuth, AuthRequest } from '../auth';
import type { User } from '../types';

const router = Router();

const registerSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['employee', 'lead', 'hr', 'admin']).optional().default('employee'),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();

router.post('/register', requireAuth, authorize(['admin', 'hr']), (req: AuthRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { first_name, last_name, email, password, role } = parsed.data;
  const normalizedEmail = normalizeEmail(email);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail) as { id: number } | undefined;
  if (existing) {
    return res.status(409).json({ message: 'E-Mail bereits vorhanden' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const fullName = `${first_name} ${last_name}`.trim();
  const stmt = db.prepare(
    'INSERT INTO users (name, first_name, last_name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
  );
  const result = stmt.run(fullName, first_name, last_name, normalizedEmail, passwordHash, role);
  db.prepare('INSERT INTO user_settings (user_id) VALUES (?)').run(Number(result.lastInsertRowid));
  db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(Number(result.lastInsertRowid));
  res.json({ id: result.lastInsertRowid, name: fullName, firstName: first_name, lastName: last_name, email: normalizedEmail, role });
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

router.post('/login', (req: AuthRequest, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { email, password } = parsed.data;
  const normalizedEmail = normalizeEmail(email);
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as User | undefined;
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
  const session = req.session as { userId?: number; role?: string } | undefined;
  if (session) {
    session.userId = user.id;
    session.role = user.role;
  }
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.name;
  const profile = db
    .prepare('SELECT require_location FROM user_profiles WHERE user_id = ?')
    .get(user.id) as { require_location?: number | null } | undefined;
  res.json({
    user: {
      id: user.id,
      name: fullName,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      requireLocation: profile?.require_location !== 0,
    },
  });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = db
    .prepare(
      `SELECT u.id, u.name, u.first_name, u.last_name, u.email, u.role, up.require_location
       FROM users u
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(req.user!.id) as
      | { id: number; name: string; first_name?: string | null; last_name?: string | null; email: string; role: string; require_location?: number | null }
      | undefined;
  if (!user) {
    req.session.destroy(() => undefined);
    return res.redirect('/login');
  }
  const fullName = `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || user.name;
  res.json({
    user: {
      ...user,
      name: fullName,
      firstName: user.first_name,
      lastName: user.last_name,
      requireLocation: (user as any).require_location !== 0,
    },
  });
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => undefined);
  res.clearCookie('sid');
  res.redirect('/login');
});

export default router;
