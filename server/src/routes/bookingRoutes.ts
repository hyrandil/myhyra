import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize, AuthRequest } from '../auth';
import type { Booking } from '../types';

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
    clock_in: z.string().datetime(),
    clock_out: z.string().datetime().optional(),
    clock_in_location: locationSchema,
    clock_out_location: locationSchema.optional(),
  })
  .refine((data) => !data.clock_out || Boolean(data.clock_out_location), {
    message: 'Für eine Gehen-Zeit muss auch ein Standort angegeben werden',
    path: ['clock_out_location'],
  });

router.use(authenticate);

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

router.get('/', authorize(['admin']), (_req, res) => {
  const bookings = db
    .prepare(
      `SELECT b.*, u.name as user_name, u.email as user_email FROM bookings b
      JOIN users u ON u.id = b.user_id ORDER BY b.clock_in DESC`
    )
    .all();
  res.json(bookings);
});

router.get('/user/:userId', authorize(['admin']), (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const bookings = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY clock_in DESC')
    .all(userId) as Booking[];
  res.json(bookings);
});

router.post('/user/:userId/manual', authorize(['admin']), (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
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
  const stmt = db.prepare(
    'INSERT INTO bookings (user_id, clock_in, clock_out, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const result = stmt.run(
    userId,
    clock_in,
    clock_out ?? null,
    clock_in_location.lat,
    clock_in_location.lng,
    clock_out ? clock_out_location!.lat : null,
    clock_out ? clock_out_location!.lng : null
  );
  const created = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid) as Booking;
  res.status(201).json(created);
});

router.patch('/:bookingId', authorize(['admin']), (req, res) => {
  const bookingId = Number(req.params.bookingId);
  if (Number.isNaN(bookingId)) {
    return res.status(400).json({ message: 'Ungültige Buchungs-ID' });
  }
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
