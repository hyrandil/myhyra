import { Router } from 'express';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize, AuthRequest } from '../auth';
import type { Booking } from '../types';

const router = Router();

const locationSchema = z.object({
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
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
    'INSERT INTO bookings (user_id, clock_in, location_lat, location_lng) VALUES (?, datetime("now"), ?, ?)'
  );
  const result = stmt.run(req.user!.id, lat ?? null, lng ?? null);
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
    'UPDATE bookings SET clock_out = datetime("now"), location_lat = COALESCE(?, location_lat), location_lng = COALESCE(?, location_lng), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(lat ?? null, lng ?? null, openBooking.id);
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

export default router;
