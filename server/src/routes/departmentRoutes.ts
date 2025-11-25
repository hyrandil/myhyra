import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../auth';
import db from '../db';

const router = Router();

const deptSchema = z.object({
  name: z.string().min(2),
  description: z.string().max(255).optional().or(z.literal('')).transform((v) => v || undefined),
});

const memberSchema = z.object({
  userId: z.number().int(),
  role: z.enum(['member', 'lead', 'hr']).default('member'),
});

router.use(authenticate);

router.get('/public', (_req, res) => {
  const departments = db.prepare('SELECT id, name, description FROM departments ORDER BY name ASC').all();
  res.json(departments);
});

router.use(authorize(['admin', 'hr']));

router.get('/', (_req, res) => {
  const departments = db
    .prepare('SELECT id, name, description, created_at FROM departments ORDER BY name ASC')
    .all();
  const members = db
    .prepare(
      `SELECT dm.department_id, dm.user_id, dm.role, u.name, u.email
       FROM department_members dm
       JOIN users u ON u.id = dm.user_id`
    )
    .all();
  res.json({ departments, members });
});

router.post('/', (req, res) => {
  const parsed = deptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  try {
    const result = db.prepare('INSERT INTO departments (name, description) VALUES (?, ?)').run(
      parsed.data.name.trim(),
      parsed.data.description ?? null
    );
    res.status(201).json({ id: Number(result.lastInsertRowid), ...parsed.data });
  } catch (error: any) {
    if (String(error?.message).includes('UNIQUE')) {
      return res.status(409).json({ message: 'Abteilung existiert bereits' });
    }
    return res.status(500).json({ message: 'Anlegen fehlgeschlagen' });
  }
});

router.patch('/:id', (req, res) => {
  const departmentId = Number(req.params.id);
  if (Number.isNaN(departmentId)) return res.status(400).json({ message: 'Ungültige Abteilungs-ID' });
  const parsed = deptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const exists = db.prepare('SELECT id FROM departments WHERE id = ?').get(departmentId);
  if (!exists) return res.status(404).json({ message: 'Abteilung nicht gefunden' });
  db.prepare('UPDATE departments SET name = ?, description = ? WHERE id = ?').run(
    parsed.data.name.trim(),
    parsed.data.description ?? null,
    departmentId
  );
  res.json({ message: 'Aktualisiert' });
});

router.delete('/:id', (req, res) => {
  const departmentId = Number(req.params.id);
  if (Number.isNaN(departmentId)) return res.status(400).json({ message: 'Ungültige Abteilungs-ID' });
  const exists = db.prepare('SELECT id FROM departments WHERE id = ?').get(departmentId);
  if (!exists) return res.status(404).json({ message: 'Abteilung nicht gefunden' });
  db.prepare('DELETE FROM department_members WHERE department_id = ?').run(departmentId);
  db.prepare('DELETE FROM departments WHERE id = ?').run(departmentId);
  res.json({ message: 'Abteilung gelöscht' });
});

router.post('/:id/members', (req, res) => {
  const departmentId = Number(req.params.id);
  if (Number.isNaN(departmentId)) return res.status(400).json({ message: 'Ungültige Abteilungs-ID' });
  const parsed = memberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(departmentId);
  if (!dept) return res.status(404).json({ message: 'Abteilung nicht gefunden' });
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(parsed.data.userId);
  if (!user) return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  db.prepare(
    'INSERT OR REPLACE INTO department_members (department_id, user_id, role) VALUES (?, ?, ?)' // replace keeps unique
  ).run(departmentId, parsed.data.userId, parsed.data.role);
  res.json({ message: 'Zugeordnet' });
});

router.patch('/:id/members/:userId', (req, res) => {
  const departmentId = Number(req.params.id);
  const userId = Number(req.params.userId);
  const parsedRole = z.enum(['member', 'lead', 'hr']).safeParse(req.body?.role);
  if (!parsedRole.success) return res.status(400).json({ errors: parsedRole.error.format() });
  const exists = db
    .prepare('SELECT id FROM department_members WHERE department_id = ? AND user_id = ?')
    .get(departmentId, userId);
  if (!exists) return res.status(404).json({ message: 'Zuordnung nicht gefunden' });
  db.prepare('UPDATE department_members SET role = ? WHERE department_id = ? AND user_id = ?').run(
    parsedRole.data,
    departmentId,
    userId
  );
  res.json({ message: 'Aktualisiert' });
});

router.delete('/:id/members/:userId', (req, res) => {
  const departmentId = Number(req.params.id);
  const userId = Number(req.params.userId);
  db.prepare('DELETE FROM department_members WHERE department_id = ? AND user_id = ?').run(departmentId, userId);
  res.json({ message: 'Entfernt' });
});

export default router;
