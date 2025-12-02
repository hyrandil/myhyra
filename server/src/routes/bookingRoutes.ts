import { Router, Response } from 'express';
import { z } from 'zod';
import db from '../db';
import { requireAuth, authorize, AuthRequest } from '../auth';
import type { Booking } from '../types';
import { canManageUser } from '../utils/permissions';

const router = Router();

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const bookingEditSchema = z
  .object({
    clock_in: z.string().datetime().optional(),
    clock_out: z.union([z.string().datetime(), z.null()]).optional(),
  })
  .refine((data) => 'clock_in' in data || 'clock_out' in data, {
    message: 'Mindestens ein Feld muss gesetzt sein',
  });

const manualBookingSchema = z
  .object({
    clock_in: z.string().datetime().optional(),
    clock_out: z.string().datetime().optional(),
    clock_in_location: locationSchema.optional(),
    clock_out_location: locationSchema.optional(),
  })
  .refine((data) => Boolean(data.clock_in) || Boolean(data.clock_out), {
    message: 'Mindestens eine Zeit muss angegeben werden',
  })
  .refine((data) => !data.clock_in_location || Boolean(data.clock_in), {
    message: 'Standortdaten für Kommen erfordern eine Zeitangabe',
    path: ['clock_in_location'],
  })
  .refine((data) => !data.clock_out_location || Boolean(data.clock_out), {
    message: 'Standortdaten für Gehen erfordern eine Zeitangabe',
    path: ['clock_out_location'],
  });

router.use(requireAuth);

function ensureCanManage(req: AuthRequest, res: Response, targetUserId: number) {
  if (!req.user) return false;
  if (req.user.role === 'admin' || req.user.role === 'hr') return true;
  if (canManageUser(req.user.id, req.user.role, targetUserId)) return true;
  res.status(403).json({ message: 'Keine Berechtigung für diesen Nutzer' });
  return false;
}

router.get('/me', (req: AuthRequest, res) => {
  const bookings = db
    .prepare(
      'SELECT * FROM bookings WHERE user_id = ? ORDER BY clock_in DESC'
    )
    .all(req.user!.id) as Booking[];
  res.json(bookings);
});

router.post('/clock-in', (req: AuthRequest, res) => {
  const parsed = locationSchema.safeParse(req.body?.location ?? {});
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const existing = db
    .prepare('SELECT id FROM bookings WHERE user_id = ? AND clock_out IS NULL')
    .get(req.user!.id) as { id: number } | undefined;
  if (existing) {
    return res.status(409).json({ message: 'Bereits eingestempelt' });
  }
  const { lat, lng } = parsed.data;
  const stmt = db.prepare(
    "INSERT INTO bookings (user_id, clock_in, clock_in_lat, clock_in_lng) VALUES (?, datetime('now'), ?, ?)"
  );
  const result = stmt.run(req.user!.id, lat, lng);
  res.json({ id: result.lastInsertRowid });
});

router.post('/clock-out', (req: AuthRequest, res) => {
  const parsed = locationSchema.safeParse(req.body?.location ?? {});
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const openBooking = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1')
    .get(req.user!.id) as Booking | undefined;
  if (!openBooking) {
    return res.status(409).json({ message: 'Kein aktiver Stempelvorgang' });
  }
  const { lat, lng } = parsed.data;
  db.prepare(
    "UPDATE bookings SET clock_out = datetime('now'), clock_out_lat = ?, clock_out_lng = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(lat, lng, openBooking.id);
  res.json({ message: 'Ausgestempelt' });
});

router.get('/', authorize(['admin', 'hr']), (_req, res) => {
  const bookings = db
    .prepare(
      `SELECT b.*, u.name as user_name, u.email as user_email FROM bookings b
      JOIN users u ON u.id = b.user_id ORDER BY b.clock_in DESC`
    )
    .all();
  res.json(bookings);
});

router.get('/user/:userId', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (!ensureCanManage(req, res, userId)) return;
  const bookings = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY clock_in DESC')
    .all(userId) as Booking[];
  res.json(bookings);
});

router.post('/user/:userId/manual', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (!ensureCanManage(req, res, userId)) return;
  const user = db
    .prepare('SELECT id FROM users WHERE id = ?')
    .get(userId) as { id: number } | undefined;
  if (!user) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const parsed = manualBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { clock_in, clock_out, clock_in_location, clock_out_location } = parsed.data;
  if (clock_in) {
    const stmt = db.prepare(
      'INSERT INTO bookings (user_id, clock_in, clock_out, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      userId,
      clock_in,
      clock_out ?? null,
      clock_in_location?.lat ?? null,
      clock_in_location?.lng ?? null,
      clock_out ? clock_out_location?.lat ?? null : null,
      clock_out ? clock_out_location?.lng ?? null : null
    );
    const created = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid) as Booking;
    return res.status(201).json(created);
  }

  if (!clock_out) {
    return res.status(400).json({ message: 'Eine Gehen-Zeit ist erforderlich.' });
  }

  const openBooking = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1')
    .get(userId) as Booking | undefined;
  if (!openBooking) {
    return res.status(409).json({ message: 'Keine offene Kommen-Buchung zum Ergänzen gefunden.' });
  }
  db.prepare(
    'UPDATE bookings SET clock_out = ?, clock_out_lat = ?, clock_out_lng = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(clock_out, clock_out_location?.lat ?? null, clock_out_location?.lng ?? null, openBooking.id);
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(openBooking.id) as Booking;
  return res.json(updated);
});

router.patch('/:bookingId', authorize(['admin', 'hr', 'lead']), (req: AuthRequest, res) => {
  const bookingId = Number(req.params.bookingId);
  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ message: 'Ungültige Buchungs-ID' });
  }
  const owner = db
    .prepare('SELECT user_id FROM bookings WHERE id = ?')
    .get(bookingId) as { user_id: number } | undefined;
  if (!owner) {
    return res.status(404).json({ message: 'Buchung nicht gefunden' });
  }
  if (!ensureCanManage(req, res, owner.user_id)) return;
  const parsed = bookingEditSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const updates: string[] = [];
  const values: (string | null)[] = [];
  if ('clock_in' in parsed.data && parsed.data.clock_in) {
    updates.push('clock_in = ?');
    values.push(parsed.data.clock_in);
  }
  if ('clock_out' in parsed.data) {
    updates.push('clock_out = ?');
    values.push(parsed.data.clock_out ?? null);
  }
  if (updates.length === 0) {
    return res.status(400).json({ message: 'Keine Änderungen übergeben' });
  }
  const stmt = db.prepare(`UPDATE bookings SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
  const result = stmt.run(...values, bookingId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Buchung nicht gefunden' });
  }
  const updated = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Booking;
  res.json(updated);
});

export default router;
