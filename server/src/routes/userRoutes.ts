import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db';
import { authenticate, authorize, AuthRequest } from '../auth';
import type { User, Booking, Absence, WorkScheduleEntry } from '../types';

const router = Router();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const ensureSettingsRow = (userId: number) => {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
};

const ensureProfileRow = (userId: number) => {
  db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(userId);
};

const ensureSchedule = (userId: number) => {
  const existing = db.prepare('SELECT COUNT(1) as count FROM work_schedules WHERE user_id = ?').get(userId) as {
    count: number;
  };
  if (existing?.count === 7) {
    return;
  }
  const defaults = [480, 480, 480, 480, 480, 0, 0];
  const insert = db.prepare('INSERT OR IGNORE INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
  defaults.forEach((minutes, weekday) => insert.run(userId, weekday, minutes));
};

const toUserPayload = (
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
    active: number;
    vacation_allowance?: number;
    personnel_number?: string | null;
    flex_enabled?: number;
    location?: string | null;
    department?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    work_model_id?: number | null;
  }
) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  created_at: user.created_at,
  active: Boolean(user.active),
  vacationAllowance: user.vacation_allowance ?? 0,
  personnelNumber: user.personnel_number ?? undefined,
  flexEnabled: Boolean(user.flex_enabled ?? 0),
  location: user.location ?? undefined,
  department: user.department ?? undefined,
  startDate: user.start_date ?? undefined,
  endDate: user.end_date ?? undefined,
  workModelId: user.work_model_id ?? undefined,
});

const dateKey = (value: string) => value.slice(0, 10);

const toDateParts = (value: string) => {
  const parts = value.split('-').map((num) => Number(num));
  return {
    year: parts[0] ?? 0,
    month: parts[1] ?? 1,
    day: parts[2] ?? 1,
  };
};

const weekdayFromDate = (value: string) => {
  const { year, month, day } = toDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (date.getUTCDay() + 6) % 7;
};

const scheduleForUser = (userId: number): WorkScheduleEntry[] => {
  const entries = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
  if (entries.length === 7) return entries;
  ensureSchedule(userId);
  return db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as WorkScheduleEntry[];
};

const workingDatesBetween = (start: string, end: string, schedule: WorkScheduleEntry[]) => {
  const map = new Map(schedule.map((entry) => [entry.weekday, entry.minutes]));
  const startParts = toDateParts(start);
  const endParts = toDateParts(end);
  const cursor = new Date(Date.UTC(startParts.year, startParts.month - 1, startParts.day));
  const endDate = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day));
  const results: string[] = [];
  while (cursor.getTime() <= endDate.getTime()) {
    const weekday = (cursor.getUTCDay() + 6) % 7;
    const minutes = map.get(weekday) ?? 0;
    if (minutes > 0) {
      results.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return results;
};

const computeDayWorkMinutes = (bookings: Booking[]) => {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
  );
  let workedMs = 0;
  let firstIn: number | null = null;
  let lastOut: number | null = null;
  let totalBreakMs = 0;

  let previousOut: number | null = null;

  sorted.forEach((booking) => {
    const clockIn = new Date(booking.clock_in).getTime();
    if (Number.isNaN(clockIn)) return;
    if (firstIn === null) {
      firstIn = clockIn;
    }

    if (previousOut !== null) {
      const gap = clockIn - previousOut;
      if (gap > 0) {
        totalBreakMs += gap;
      }
    }

    if (booking.clock_out) {
      const clockOut = new Date(booking.clock_out).getTime();
      if (!Number.isNaN(clockOut) && clockOut > clockIn) {
        workedMs += clockOut - clockIn;
        lastOut = lastOut ? Math.max(lastOut, clockOut) : clockOut;
        previousOut = clockOut;
      }
    }
  });

  if (firstIn === null || lastOut === null) {
    return 0;
  }

  const spanMinutes = Math.max(lastOut - firstIn, 0) / 60000;
  const breakMinutes = totalBreakMs / 60000;
  if (spanMinutes <= 360) {
    return Math.round(workedMs / 60000);
  }

  const requiredPause = Math.min(30, spanMinutes - 360);
  const countedBreak = breakMinutes >= 30 ? requiredPause : breakMinutes;
  const autoDeduction = Math.max(requiredPause - countedBreak, 0);
  const adjusted = Math.max(workedMs / 60000 - autoDeduction, 0);
  return Math.round(adjusted);
};

const computeFlexBalance = (userId: number) => {
  ensureSchedule(userId);
  ensureSettingsRow(userId);
  const schedule = scheduleForUser(userId);
  const planMap = new Map(schedule.map((entry) => [entry.weekday, entry.minutes]));
  const bookings = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY clock_in ASC')
    .all(userId) as Booking[];
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ?')
    .all(userId) as Absence[];

  const bookingsByDay = new Map<string, Booking[]>();
  bookings.forEach((booking) => {
    const key = dateKey(booking.clock_in);
    const list = bookingsByDay.get(key) ?? [];
    list.push(booking);
    bookingsByDay.set(key, list);
  });

  const absenceMap = new Map<string, Absence[]>();
  absences.forEach((absence) => {
    const days = workingDatesBetween(absence.start_date, absence.end_date, schedule);
    days.forEach((day) => {
      const list = absenceMap.get(day) ?? [];
      list.push(absence);
      absenceMap.set(day, list);
    });
  });

  const dayKeys = new Set<string>([...bookingsByDay.keys(), ...absenceMap.keys()]);
  let plannedTotal = 0;
  let workedTotal = 0;

  dayKeys.forEach((dayKey) => {
    const weekday = weekdayFromDate(dayKey);
    const planned = planMap.get(weekday) ?? 0;
    const baseWork = computeDayWorkMinutes(bookingsByDay.get(dayKey) ?? []);
    const absencesForDay = absenceMap.get(dayKey) ?? [];

    let creditVacation = 0;
    let topUpOther = 0;

    absencesForDay.forEach((absence) => {
      const factor = absence.duration === 'half' ? 0.5 : 1;
      const target = Math.round(planned * factor);
      if (absence.type === 'vacation') {
        creditVacation += target;
      } else {
        const covered = baseWork + creditVacation + topUpOther;
        const topUp = Math.max(target - covered, 0);
        topUpOther += topUp;
      }
    });

    const totalForDay = baseWork + creditVacation + topUpOther;
    if (planned > 0 || totalForDay > 0 || absencesForDay.length > 0) {
      plannedTotal += planned;
      workedTotal += totalForDay;
    }
  });

  const adjustmentRow = db
    .prepare('SELECT flex_adjust_minutes, flex_enabled FROM user_settings WHERE user_id = ?')
    .get(userId) as { flex_adjust_minutes?: number; flex_enabled?: number } | undefined;
  const adjustment = adjustmentRow?.flex_adjust_minutes ?? 0;
  const enabled = Boolean(adjustmentRow?.flex_enabled ?? 0);
  return { balanceMinutes: workedTotal - plannedTotal + adjustment, plannedTotal, workedTotal, adjustment, enabled };
};

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

const selfSettingsSchema = z.object({
  language: z.enum(['de', 'en']),
  week_start: z.enum(['monday', 'sunday']),
  time_format: z.enum(['24h', '12h']),
});

router.get('/me/settings', (req: AuthRequest, res) => {
  ensureSettingsRow(req.user!.id);
  const settings = db
    .prepare(
      'SELECT language, week_start, time_format, vacation_allowance FROM user_settings WHERE user_id = ?'
    )
    .get(req.user!.id) as
    | {
        language: string;
        week_start: string | null;
        time_format: string | null;
        vacation_allowance: number;
      }
    | undefined;
  if (!settings) {
    return res.status(404).json({ message: 'Einstellungen nicht gefunden' });
  }
  res.json({
    language: settings.language,
    week_start: settings.week_start ?? 'monday',
    time_format: settings.time_format ?? '24h',
    vacation_allowance: settings.vacation_allowance,
  });
});

router.patch('/me/settings', (req: AuthRequest, res) => {
  const parsed = selfSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureSettingsRow(req.user!.id);
  db.prepare(
    `UPDATE user_settings
     SET language = ?, week_start = ?, time_format = ?
     WHERE user_id = ?`
  ).run(parsed.data.language, parsed.data.week_start, parsed.data.time_format, req.user!.id);
  res.json({ message: 'Einstellungen gespeichert' });
});

router.get('/me/schedule', (req: AuthRequest, res) => {
  ensureSchedule(req.user!.id);
  const schedule = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(req.user!.id);
  res.json({ days: schedule });
});

router.get('/me/flex', (req: AuthRequest, res) => {
  const { balanceMinutes, plannedTotal, workedTotal, adjustment, enabled } = computeFlexBalance(req.user!.id);
  res.json({ balanceMinutes, plannedMinutes: plannedTotal, workedMinutes: workedTotal, adjustment, enabled });
});

router.use(authorize(['admin', 'hr']));

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['employee', 'lead', 'hr', 'admin']).optional().default('employee'),
  vacationAllowance: z.number().min(0).max(80).optional(),
  birth_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  personnel_number: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  phone: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  address: z.string().max(180).optional().or(z.literal('')).transform((value) => value || undefined),
  city: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  postal_code: z.string().max(30).optional().or(z.literal('')).transform((value) => value || undefined),
  location: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  department: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  work_model_id: z.number().int().optional(),
  start_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  end_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  note: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
});

router.get('/', (req: AuthRequest, res) => {
  const search = typeof req.query.q === 'string' ? `%${req.query.q}%` : '%';
  const users = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.location, up.department, up.start_date, up.end_date, up.work_model_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id != ? AND (u.name LIKE ? OR u.email LIKE ? OR IFNULL(up.personnel_number,'') LIKE ?)
       ORDER BY u.name ASC`
    )
    .all(req.user!.id, search, search, search) as (Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
      personnel_number?: string | null;
    })[];
  res.json(users.map((user) => toUserPayload(user)));
});

router.post('/', (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { name, email, password, role, vacationAllowance, ...profile } = parsed.data;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) {
    return res.status(409).json({ message: 'E-Mail bereits vorhanden' });
  }
  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)');
  const result = stmt.run(name, email, passwordHash, role);
  const createdUserId = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO user_settings (user_id, vacation_allowance) VALUES (?, ?)').run(
    createdUserId,
    vacationAllowance ?? 30
  );
  ensureProfileRow(createdUserId);
  ensureSchedule(createdUserId);
  if (Object.values(profile).some((value) => value !== undefined)) {
    db.prepare(
      `UPDATE user_profiles
       SET birth_date = ?, personnel_number = ?, phone = ?, address = ?, city = ?, postal_code = ?, note = ?,
           location = ?, department = ?, start_date = ?, end_date = ?, work_model_id = COALESCE(?, work_model_id)
       WHERE user_id = ?`
    ).run(
      profile.birth_date ?? null,
      profile.personnel_number ?? null,
      profile.phone ?? null,
      profile.address ?? null,
      profile.city ?? null,
      profile.postal_code ?? null,
      profile.note ?? null,
      profile.location ?? null,
      profile.department ?? null,
      profile.start_date ?? null,
      profile.end_date ?? null,
      profile.work_model_id ?? null,
      createdUserId
    );
  }
  const created = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.location, up.department, up.start_date, up.end_date, up.work_model_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(result.lastInsertRowid) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
      personnel_number?: string | null;
    };
  res.status(201).json(toUserPayload(created));
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
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.location, up.department, up.start_date, up.end_date, up.work_model_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
      personnel_number?: string | null;
    };
  res.json(toUserPayload(updated));
});

const userUpdateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(['employee', 'lead', 'hr', 'admin']),
  location: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  department: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  start_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  end_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  work_model_id: z.number().int().optional(),
  active: z.boolean().optional(),
});

const flexConfigSchema = z.object({
  enabled: z.boolean(),
  adjustment: z.number().int().optional(),
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
  if (parsed.data.active !== undefined) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(parsed.data.active ? 1 : 0, userId);
  }
  db.prepare(
    `UPDATE user_profiles
     SET location = COALESCE(?, location),
         department = COALESCE(?, department),
         start_date = COALESCE(?, start_date),
         end_date = COALESCE(?, end_date),
         work_model_id = COALESCE(?, work_model_id)
     WHERE user_id = ?`
  ).run(
    parsed.data.location ?? null,
    parsed.data.department ?? null,
    parsed.data.start_date ?? null,
    parsed.data.end_date ?? null,
    parsed.data.work_model_id ?? null,
    userId
  );
  const updated = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.location, up.department, up.start_date, up.end_date, up.work_model_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
      personnel_number?: string | null;
    };
  res.json(toUserPayload(updated));
});

const adminSettingsSchema = z.object({
  vacation_allowance: z.number().min(0).max(80),
});

const profileSchema = z.object({
  birth_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  personnel_number: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  phone: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  address: z.string().max(180).optional().or(z.literal('')).transform((value) => value || undefined),
  city: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  postal_code: z.string().max(30).optional().or(z.literal('')).transform((value) => value || undefined),
  note: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
});

const scheduleSchema = z.object({
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        minutes: z.number().int().min(0).max(1440),
      })
    )
    .length(7),
});

router.patch('/:id/settings', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = adminSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureSettingsRow(userId);
  db.prepare('UPDATE user_settings SET vacation_allowance = ? WHERE user_id = ?').run(
    parsed.data.vacation_allowance,
    userId
  );
  const updated = db
    .prepare(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'> & {
      active: number;
      vacation_allowance: number;
    };
  res.json(toUserPayload(updated));
});

router.get('/:id/profile', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  ensureProfileRow(userId);
  const profile = db
    .prepare(
      `SELECT birth_date, personnel_number, phone, address, city, postal_code, note
       FROM user_profiles WHERE user_id = ?`
    )
    .get(userId);
  if (!profile) {
    return res.status(404).json({ message: 'Profil nicht gefunden' });
  }
  res.json(profile);
});

router.patch('/:id/profile', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureProfileRow(userId);
  db.prepare(
    `UPDATE user_profiles
     SET birth_date = ?, personnel_number = ?, phone = ?, address = ?, city = ?, postal_code = ?, note = ?
     WHERE user_id = ?`
  ).run(
    parsed.data.birth_date ?? null,
    parsed.data.personnel_number ?? null,
    parsed.data.phone ?? null,
    parsed.data.address ?? null,
    parsed.data.city ?? null,
    parsed.data.postal_code ?? null,
    parsed.data.note ?? null,
    userId
  );
  const profile = db
    .prepare(
      `SELECT birth_date, personnel_number, phone, address, city, postal_code, note
       FROM user_profiles WHERE user_id = ?`
    )
    .get(userId);
  res.json(profile);
});

router.get('/:id/schedule', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  ensureSchedule(userId);
  const schedule = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId);
  res.json({ days: schedule });
});

router.put('/:id/schedule', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const tx = db.transaction((payload: typeof parsed.data) => {
    db.prepare('DELETE FROM work_schedules WHERE user_id = ?').run(userId);
    const insert = db.prepare('INSERT INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
    payload.days.forEach((day) => insert.run(userId, day.weekday, day.minutes));
  });
  tx(parsed.data);
  const schedule = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId);
  res.json({ days: schedule });
});

router.get('/:id/flex', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const { balanceMinutes, plannedTotal, workedTotal, adjustment, enabled } = computeFlexBalance(userId);
  res.json({ balanceMinutes, plannedMinutes: plannedTotal, workedMinutes: workedTotal, adjustment, enabled });
});

router.patch('/:id/flex', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  const parsed = flexConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureSettingsRow(userId);
  const adjustment = parsed.data.adjustment ??
    (db.prepare('SELECT flex_adjust_minutes FROM user_settings WHERE user_id = ?').get(userId) as { flex_adjust_minutes?: number }
      | undefined)?.flex_adjust_minutes ?? 0;
  db.prepare('UPDATE user_settings SET flex_enabled = ?, flex_adjust_minutes = ? WHERE user_id = ?').run(
    parsed.data.enabled ? 1 : 0,
    adjustment,
    userId
  );
  const { balanceMinutes, plannedTotal, workedTotal } = computeFlexBalance(userId);
  res.json({ balanceMinutes, plannedMinutes: plannedTotal, workedMinutes: workedTotal, adjustment, enabled: parsed.data.enabled });
});

export default router;
