import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize } from '../auth';
import { buildHolidayList } from '../utils/holidays';

const router = Router();

const profileSchema = z.object({
  name: z.string().min(3),
  state: z.string().regex(/^[A-Z]{2}$/),
  year: z.number().int().min(2000).max(2100).optional(),
});

const customHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(3),
  duration: z.enum(['full', 'half']).default('full'),
});

router.use(authenticate);
router.use(authorize(['admin', 'hr']));

router.get('/profiles', (_req, res) => {
  const rows = db.prepare('SELECT * FROM holiday_profiles ORDER BY created_at DESC').all();
  res.json(rows);
});

router.post('/profiles', (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const { name, state, year } = parsed.data;
  const result = db.prepare('INSERT INTO holiday_profiles (name, state) VALUES (?, ?)').run(name, state);
  const profileId = Number(result.lastInsertRowid);
  const importYear = year ?? new Date().getUTCFullYear();
  const holidays = buildHolidayList(state, importYear);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO holidays (profile_id, date, name, duration, source) VALUES (?, ?, ?, ?, ?)' as string
  );
  holidays.forEach((holiday) => insert.run(profileId, holiday.date, holiday.name, holiday.duration, 'imported'));
  res.status(201).json({ id: profileId, name, state });
});

router.post('/profiles/:id/import', (req, res) => {
  const profileId = Number(req.params.id);
  if (Number.isNaN(profileId)) return res.status(400).json({ message: 'Ungültige Profil-ID' });
  const body = profileSchema.pick({ year: true }).safeParse(req.body);
  const year = body.success && body.data.year ? body.data.year : new Date().getUTCFullYear();
  const profile = db.prepare('SELECT * FROM holiday_profiles WHERE id = ?').get(profileId) as any;
  if (!profile) return res.status(404).json({ message: 'Profil nicht gefunden' });
  db.prepare("DELETE FROM holidays WHERE profile_id = ? AND strftime('%Y', date) = ?").run(profileId, `${year}`);
  const holidays = buildHolidayList(profile.state, year);
  const insert = db.prepare(
    'INSERT OR IGNORE INTO holidays (profile_id, date, name, duration, source) VALUES (?, ?, ?, ?, ?)' as string
  );
  holidays.forEach((holiday) => insert.run(profileId, holiday.date, holiday.name, holiday.duration, 'imported'));
  res.json({ message: 'Feiertage importiert', count: holidays.length });
});

router.post('/profiles/:id/holidays', (req, res) => {
  const profileId = Number(req.params.id);
  if (Number.isNaN(profileId)) return res.status(400).json({ message: 'Ungültige Profil-ID' });
  const parsed = customHolidaySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const profile = db.prepare('SELECT id FROM holiday_profiles WHERE id = ?').get(profileId);
  if (!profile) return res.status(404).json({ message: 'Profil nicht gefunden' });
  const { date, name, duration } = parsed.data;
  db.prepare('INSERT OR REPLACE INTO holidays (profile_id, date, name, duration, source) VALUES (?, ?, ?, ?, ?)').run(
    profileId,
    date,
    name,
    duration,
    'custom'
  );
  res.status(201).json({ message: 'Feiertag gespeichert' });
});

router.get('/profiles/:id/holidays', (req, res) => {
  const profileId = Number(req.params.id);
  if (Number.isNaN(profileId)) return res.status(400).json({ message: 'Ungültige Profil-ID' });
  const { year } = req.query as { year?: string };
  const profile = db.prepare('SELECT * FROM holiday_profiles WHERE id = ?').get(profileId) as any;
  if (!profile) return res.status(404).json({ message: 'Profil nicht gefunden' });
  const rows = year
    ? db
        .prepare("SELECT * FROM holidays WHERE profile_id = ? AND strftime('%Y', date) = ? ORDER BY date ASC")
        .all(profileId, year)
    : db.prepare('SELECT * FROM holidays WHERE profile_id = ? ORDER BY date ASC').all(profileId);
  res.json(rows);
});

export default router;
