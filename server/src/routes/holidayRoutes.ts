import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { requireAuth, authorize } from '../auth';
import { buildHolidayList } from '../utils/holidays';

const router = Router();

const profileSchema = z.object({
  name: z.string().min(3),
  state: z.string().regex(/^[A-Z]{2}$/),
  year: z.number().int().min(2000).max(2100).optional(),
  years: z.array(z.number().int().min(2000).max(2100)).optional(),
  startYear: z.number().int().min(2000).max(2100).optional(),
  endYear: z.number().int().min(2000).max(2100).optional(),
});

const customHolidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(3),
  duration: z.enum(['full', 'half']).default('full'),
});

const profileUpdateSchema = z.object({
  name: z.string().min(3),
  state: z.string().regex(/^[A-Z]{2}$/),
});

router.use(requireAuth);
router.use(authorize(['admin']));

const resolveYears = (payload: {
  year?: number | null | undefined;
  years?: (number | undefined)[] | null | undefined;
  startYear?: number | null | undefined;
  endYear?: number | null | undefined;
}) => {
  if (payload.years && payload.years.length > 0) {
    return Array.from(new Set(payload.years.filter((y): y is number => typeof y === 'number'))).sort();
  }
  if (payload.startYear && payload.endYear && payload.endYear >= payload.startYear) {
    const arr: number[] = [];
    for (let y = payload.startYear; y <= payload.endYear; y += 1) arr.push(y);
    return arr;
  }
  if (payload.year) return [payload.year];
  return [new Date().getUTCFullYear()];
};

router.get('/profiles', (_req, res) => {
  const rows = db.prepare('SELECT * FROM holiday_profiles ORDER BY created_at DESC').all();
  res.json(rows);
});

router.patch('/profiles/:id', (req, res) => {
  const profileId = Number(req.params.id);
  if (Number.isNaN(profileId)) return res.status(400).json({ message: 'Ungültige Profil-ID' });
  const parsed = profileUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const existing = db.prepare('SELECT id FROM holiday_profiles WHERE id = ?').get(profileId);
  if (!existing) return res.status(404).json({ message: 'Profil nicht gefunden' });
  db.prepare('UPDATE holiday_profiles SET name = ?, state = ? WHERE id = ?').run(
    parsed.data.name,
    parsed.data.state,
    profileId
  );
  res.json({ id: profileId, name: parsed.data.name, state: parsed.data.state });
});

router.delete('/profiles/:id', (req, res) => {
  const profileId = Number(req.params.id);
  if (Number.isNaN(profileId)) return res.status(400).json({ message: 'Ungültige Profil-ID' });
  const used = db
    .prepare('SELECT COUNT(1) as count FROM user_profiles WHERE holiday_profile_id = ?')
    .get(profileId) as { count: number };
  if (used.count > 0) {
    return res.status(409).json({ message: 'Profil ist noch Mitarbeitenden zugewiesen.' });
  }
  const result = db.prepare('DELETE FROM holiday_profiles WHERE id = ?').run(profileId);
  if (result.changes === 0) return res.status(404).json({ message: 'Profil nicht gefunden' });
  res.json({ message: 'Profil gelöscht' });
});

router.post('/profiles', (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.format() });
  const { name, state, ...rest } = parsed.data;
  const result = db.prepare('INSERT INTO holiday_profiles (name, state) VALUES (?, ?)').run(name, state);
  const profileId = Number(result.lastInsertRowid);
  const years = resolveYears(rest);
  const holidays = years.flatMap((importYear) => buildHolidayList(state, importYear));
  const insert = db.prepare(
    'INSERT OR IGNORE INTO holidays (profile_id, date, name, duration, source) VALUES (?, ?, ?, ?, ?)' as string
  );
  holidays.forEach((holiday) => insert.run(profileId, holiday.date, holiday.name, holiday.duration, 'imported'));
  res.status(201).json({ id: profileId, name, state });
});

router.post('/profiles/:id/import', (req, res) => {
  const profileId = Number(req.params.id);
  if (Number.isNaN(profileId)) return res.status(400).json({ message: 'Ungültige Profil-ID' });
  const parsed = profileSchema.pick({ year: true, years: true, startYear: true, endYear: true }).safeParse(req.body);
  const profile = db.prepare('SELECT * FROM holiday_profiles WHERE id = ?').get(profileId) as any;
  if (!profile) return res.status(404).json({ message: 'Profil nicht gefunden' });
  const years = parsed.success ? resolveYears(parsed.data) : [new Date().getUTCFullYear()];
  years.forEach((year) => {
    db.prepare("DELETE FROM holidays WHERE profile_id = ? AND strftime('%Y', date) = ?").run(profileId, `${year}`);
  });
  const holidays = years.flatMap((year) => buildHolidayList(profile.state, year));
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
