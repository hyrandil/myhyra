import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db';
import { requireAuth, authorize, AuthRequest } from '../auth';
import { managedDepartments } from '../utils/permissions';
import { logAction } from '../utils/logger';
import type { User, Booking, Absence } from '../types';

const router = Router();
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const normalizeEmail = (email: string) => email.trim().toLowerCase();

const ensureSettingsRow = (userId: number) => {
  db.prepare('INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)').run(userId);
};

const userExists = (userId: number) => {
  return Boolean(db.prepare('SELECT id FROM users WHERE id = ?').get(userId));
};

const ensureProfileRow = (userId: number) => {
  if (!userExists(userId)) return;
  db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(userId);
};

const ensureSchedule = (userId: number) => {
  if (!userExists(userId)) return;
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

const seedScheduleVersion = (userId: number) => {
  ensureSchedule(userId);
  const versions = db
    .prepare('SELECT COUNT(1) as count FROM work_schedule_versions WHERE user_id = ?')
    .get(userId) as { count: number };
  if (versions?.count && versions.count > 0) return;

  const schedule = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId) as { weekday: number; minutes: number }[];
  const startRow = db
    .prepare('SELECT tracking_start_date FROM user_profiles WHERE user_id = ?')
    .get(userId) as { tracking_start_date?: string | null } | undefined;
  const validFrom = startRow?.tracking_start_date || '1970-01-01';
  const minutes = new Map(schedule.map((s) => [s.weekday, s.minutes]));
  db.prepare(
    `INSERT OR IGNORE INTO work_schedule_versions
      (user_id, valid_from, mon_minutes, tue_minutes, wed_minutes, thu_minutes, fri_minutes, sat_minutes, sun_minutes)
      VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    userId,
    validFrom,
    minutes.get(0) ?? 0,
    minutes.get(1) ?? 0,
    minutes.get(2) ?? 0,
    minutes.get(3) ?? 0,
    minutes.get(4) ?? 0,
    minutes.get(5) ?? 0,
    minutes.get(6) ?? 0
  );
};

const upsertHolidayProfileVersion = (userId: number, holidayProfileId?: number | null, validFrom?: string | null) => {
  if (!holidayProfileId) return;
  const effective = validFrom || '1970-01-01';
  db.prepare(
    `INSERT INTO holiday_profile_versions (user_id, holiday_profile_id, valid_from)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, valid_from) DO UPDATE SET holiday_profile_id = excluded.holiday_profile_id`
  ).run(userId, holidayProfileId, effective);
};

const plannedMinutesForDate = (userId: number, dateKey: string) => {
  seedScheduleVersion(userId);
  const versions = db
    .prepare('SELECT * FROM work_schedule_versions WHERE user_id = ? ORDER BY date(valid_from) DESC, id DESC')
    .all(userId) as any[];
  const target = versions.find((v) => v.valid_from <= dateKey) || versions[versions.length - 1];
  const minutesByWeekday = [
    target?.mon_minutes ?? 0,
    target?.tue_minutes ?? 0,
    target?.wed_minutes ?? 0,
    target?.thu_minutes ?? 0,
    target?.fri_minutes ?? 0,
    target?.sat_minutes ?? 0,
    target?.sun_minutes ?? 0,
  ];
  const weekday = weekdayFromDate(dateKey);
  return minutesByWeekday[weekday] ?? 0;
};

const getHolidayProfileId = (userId: number): number | null => {
  try {
    const row = db
      .prepare('SELECT holiday_profile_id FROM user_profiles WHERE user_id = ?')
      .get(userId) as { holiday_profile_id?: number | null } | undefined;
    return row?.holiday_profile_id ?? null;
  } catch (err) {
    console.error('Holiday profile column missing', err);
    return null;
  }
};

const getHolidaysForRange = (userId: number, startDate: string, endDate: string) => {
  const profileId = getHolidayProfileId(userId);
  if (!profileId) return [] as { date: string; name: string; duration: string }[];
  return db
    .prepare('SELECT date, name, duration FROM holidays WHERE profile_id = ? AND date BETWEEN ? AND ? ORDER BY date ASC')
    .all(profileId, startDate, endDate) as { date: string; name: string; duration: string }[];
};

const scheduleHistory = (userId: number) => {
  seedScheduleVersion(userId);
  const versions = db
    .prepare('SELECT * FROM work_schedule_versions WHERE user_id = ? ORDER BY date(valid_from) ASC, id ASC')
    .all(userId) as any[];
  return versions.map((version, idx) => {
    const next = versions[idx + 1];
    return {
      id: version.id,
      validFrom: version.valid_from,
      validTo: next ? new Date(new Date(`${next.valid_from}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10) : null,
      days: [
        { weekday: 0, minutes: version.mon_minutes },
        { weekday: 1, minutes: version.tue_minutes },
        { weekday: 2, minutes: version.wed_minutes },
        { weekday: 3, minutes: version.thu_minutes },
        { weekday: 4, minutes: version.fri_minutes },
        { weekday: 5, minutes: version.sat_minutes },
        { weekday: 6, minutes: version.sun_minutes },
      ],
    };
  });
};

const guardMissingUser = (userId: number, res: Response) => {
  if (!userExists(userId)) {
    res.status(404).json({ message: 'Nutzer nicht gefunden' });
    return true;
  }
  return false;
};

let holidayProfileColumnReady = false;
const ensureHolidayProfileColumn = () => {
  if (holidayProfileColumnReady) return;
  const hasColumn = db
    .prepare("SELECT name FROM pragma_table_info('user_profiles') WHERE name = 'holiday_profile_id'")
    .get() as { name: string } | undefined;
  if (!hasColumn) {
    try {
      db.exec('ALTER TABLE user_profiles ADD COLUMN holiday_profile_id INTEGER');
    } catch (err) {
      console.error('holiday_profile_id konnte nicht angelegt werden', err);
    }
  }
  holidayProfileColumnReady = true;
};

ensureHolidayProfileColumn();

const displayName = (first?: string | null, last?: string | null, fallback?: string) => {
  const combined = [first, last].filter(Boolean).join(' ').trim();
  return combined || fallback || '';
};

const toUserPayload = (
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at' | 'first_name' | 'last_name'> & {
    active: number;
    vacation_allowance?: number;
    personnel_number?: string | null;
    rfid_code?: string | null;
    flex_enabled?: number;
    location?: string | null;
    department?: string | null;
    require_location?: number | null;
    tracking_start_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    work_model_id?: number | null;
    holiday_profile_id?: number | null;
  }
) => ({
  id: user.id,
  name: displayName(user.first_name, user.last_name, user.name),
  firstName: user.first_name ?? undefined,
  lastName: user.last_name ?? undefined,
  email: user.email,
  role: user.role,
  created_at: user.created_at,
  active: Boolean(user.active),
  vacationAllowance: user.vacation_allowance ?? 0,
  personnelNumber: user.personnel_number ?? undefined,
  rfidCode: user.rfid_code ?? undefined,
  flexEnabled: Boolean(user.flex_enabled ?? 0),
  location: user.location ?? undefined,
  department: user.department ?? undefined,
  requireLocation: Boolean(user.require_location ?? 1),
  trackingStartDate: user.tracking_start_date ?? undefined,
  startDate: user.start_date ?? undefined,
  endDate: user.end_date ?? undefined,
  workModelId: user.work_model_id ?? undefined,
  holidayProfileId: user.holiday_profile_id ?? undefined,
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

  const longShift = spanMinutes >= 540;
  const maxPause = longShift ? 45 : 30;
  const requiredPause = Math.min(maxPause, spanMinutes - 360);
  const countedBreak = Math.min(breakMinutes, maxPause);
  const autoDeduction = Math.max(requiredPause - countedBreak, 0);
  const adjusted = Math.max(workedMs / 60000 - autoDeduction, 0);
  return Math.round(adjusted);
};

const computeFlexBalance = (userId: number) => {
  ensureSchedule(userId);
  seedScheduleVersion(userId);
  ensureSettingsRow(userId);
  const bookings = db
    .prepare('SELECT * FROM bookings WHERE user_id = ? ORDER BY clock_in ASC')
    .all(userId) as Booking[];
  const absences = db
    .prepare('SELECT * FROM absences WHERE user_id = ? ORDER BY start_date ASC')
    .all(userId) as Absence[];
  const trackingStartRow = db
    .prepare('SELECT tracking_start_date FROM user_profiles WHERE user_id = ?')
    .get(userId) as { tracking_start_date: string | null } | undefined;
  const trackingStartDate = trackingStartRow?.tracking_start_date
    ? new Date(`${trackingStartRow.tracking_start_date}T00:00:00Z`)
    : null;

  const bookingsByDay = new Map<string, Booking[]>();
  bookings.forEach((booking) => {
    const key = dateKey(booking.clock_in);
    const list = bookingsByDay.get(key) ?? [];
    list.push(booking);
    bookingsByDay.set(key, list);
  });

  const absenceMap = new Map<string, Absence[]>();

  const earliestBooking = bookings.length ? dateKey(bookings[0]!.clock_in) : null;
  const earliestAbsence = absences.length ? absences[0]!.start_date : null;
  const today = new Date();
  const endCursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const startCursor = (() => {
    const candidates = [trackingStartDate ? trackingStartDate.toISOString().slice(0, 10) : null, earliestBooking, earliestAbsence]
      .filter(Boolean) as string[];
    if (candidates.length === 0) return today.toISOString().slice(0, 10);
    return candidates.reduce((min, curr) => (curr < min ? curr : min));
  })();

  const holidayRows = getHolidaysForRange(userId, startCursor, endCursor.toISOString().slice(0, 10));
  const holidayDays = new Set(holidayRows.map((h) => h.date));
  absences.forEach((absence) => {
    let cursor = new Date(`${absence.start_date}T00:00:00Z`);
    const endDate = new Date(`${absence.end_date}T00:00:00Z`);
    while (cursor.getTime() <= endDate.getTime()) {
      const dayKey = cursor.toISOString().slice(0, 10);
      const planned = plannedMinutesForDate(userId, dayKey);
      if (planned > 0) {
        const isHoliday = holidayDays.has(dayKey);
        const isVacation = absence.type === 'vacation';
        if (!(isHoliday && isVacation)) {
          const list = absenceMap.get(dayKey) ?? [];
          list.push(absence);
          absenceMap.set(dayKey, list);
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  });

  let plannedTotal = 0;
  let workedTotal = 0;
  let flexCarry = 0;
  let cursor = new Date(`${startCursor}T00:00:00Z`);

  if (cursor.getTime() <= endCursor.getTime()) {
    while (cursor.getTime() <= endCursor.getTime()) {
      const dayKey = cursor.toISOString().slice(0, 10);
      const planned = plannedMinutesForDate(userId, dayKey);
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

      const inactiveBeforeTracking = trackingStartDate && cursor.getTime() < trackingStartDate.getTime();
      const effectivePlanned = inactiveBeforeTracking ? 0 : planned;
      const effectiveWorked = inactiveBeforeTracking ? 0 : baseWork + creditVacation + topUpOther;
      const delta = effectiveWorked - effectivePlanned;

      if (effectivePlanned > 0 || effectiveWorked > 0 || absencesForDay.length > 0) {
        plannedTotal += effectivePlanned;
        workedTotal += effectiveWorked;
        flexCarry += delta;
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  const adjustmentRow = db
    .prepare('SELECT flex_adjust_minutes, flex_enabled FROM user_settings WHERE user_id = ?')
    .get(userId) as { flex_adjust_minutes?: number; flex_enabled?: number } | undefined;
  const adjustment = adjustmentRow?.flex_adjust_minutes ?? 0;
  const enabled = Boolean(adjustmentRow?.flex_enabled ?? 0);
  return { balanceMinutes: flexCarry + adjustment, plannedTotal, workedTotal, adjustment, enabled };
};

router.use(requireAuth);

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

const selfPasswordSchema = z.object({
  current_password: z.string().min(6),
  next_password: z.string().min(6),
});

router.patch('/me/password', (req: AuthRequest, res) => {
  const parsed = selfPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user!.id) as
    | { id: number; password_hash: string }
    | undefined;
  if (!user) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  const valid = bcrypt.compareSync(parsed.data.current_password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ message: 'Aktuelles Passwort ist ungültig' });
  }
  const nextHash = bcrypt.hashSync(parsed.data.next_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(nextHash, user.id);
  res.json({ ok: true });
});

const baseUserSelect = `SELECT u.id, u.name, u.first_name, u.last_name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.rfid_code, up.location, up.department, up.require_location, up.tracking_start_date, up.start_date, up.end_date, up.work_model_id, up.holiday_profile_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id`;

router.get('/', (req: AuthRequest, res) => {
  const search = typeof req.query.q === 'string' ? `%${req.query.q}%` : '%';
  const filters = `AND (u.name LIKE ? OR u.email LIKE ? OR IFNULL(up.personnel_number,'') LIKE ?)`;

  if (req.user!.role === 'admin') {
    const users = db
      .prepare(
        `${baseUserSelect}
         WHERE u.id != ? ${filters}
         ORDER BY u.name ASC`
      )
      .all(req.user!.id, search, search, search) as (Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at' | 'first_name' | 'last_name'> & {
        active: number;
        vacation_allowance: number;
        personnel_number?: string | null;
      })[];
    return res.json(users.map((user) => toUserPayload(user)));
  }

  if (req.user!.role === 'lead') {
    const departments = managedDepartments(req.user!.id);
    if (departments.length === 0) return res.json([]);
    const placeholders = departments.map(() => '?').join(',');
    const users = db
      .prepare(
        `${baseUserSelect}
         WHERE u.id != ?
         AND u.id IN (SELECT user_id FROM department_members WHERE department_id IN (${placeholders}))
         ${filters}
         ORDER BY u.name ASC`
      )
      .all(req.user!.id, ...departments, search, search, search) as (Pick<
        User,
        'id' | 'name' | 'email' | 'role' | 'created_at' | 'first_name' | 'last_name'
      > & {
        active: number;
        vacation_allowance: number;
        personnel_number?: string | null;
      })[];
    return res.json(users.map((user) => toUserPayload(user)));
  }

  return res.status(403).json({ message: 'Keine Berechtigung' });
});

router.use(authorize(['admin']));

const userSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['employee', 'lead', 'admin']).optional().default('employee'),
  vacationAllowance: z.number().min(0).max(80).optional(),
  birth_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  personnel_number: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  rfid_code: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  phone: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  address: z.string().max(180).optional().or(z.literal('')).transform((value) => value || undefined),
  city: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  postal_code: z.string().max(30).optional().or(z.literal('')).transform((value) => value || undefined),
  location: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  department: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  require_location: z.boolean().optional(),
  work_model_id: z.number().int().optional(),
  holiday_profile_id: z.number().int().optional(),
  holiday_profile_valid_from: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  tracking_start_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  start_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  end_date: z
    .union([z.string().regex(dateRegex, 'Datum muss YYYY-MM-DD sein'), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  note: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
});

router.post('/', (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const { first_name, last_name, email, password, role, vacationAllowance, ...profile } = parsed.data;
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
       SET birth_date = ?, personnel_number = ?, rfid_code = ?, phone = ?, address = ?, city = ?, postal_code = ?, note = ?,
           location = ?, department = ?, require_location = COALESCE(?, require_location), tracking_start_date = ?, start_date = ?, end_date = ?, work_model_id = COALESCE(?, work_model_id),
           holiday_profile_id = COALESCE(?, holiday_profile_id)
       WHERE user_id = ?`
    ).run(
      profile.birth_date ?? null,
      profile.personnel_number ?? null,
      profile.rfid_code ?? null,
      profile.phone ?? null,
      profile.address ?? null,
      profile.city ?? null,
      profile.postal_code ?? null,
      profile.note ?? null,
      profile.location ?? null,
      profile.department ?? null,
      profile.require_location === undefined ? null : profile.require_location ? 1 : 0,
      profile.tracking_start_date ?? null,
      profile.start_date ?? null,
      profile.end_date ?? null,
      profile.work_model_id ?? null,
      profile.holiday_profile_id ?? null,
      createdUserId
    );
  }
  upsertHolidayProfileVersion(createdUserId, profile.holiday_profile_id, profile.holiday_profile_valid_from);
  const created = db
    .prepare(
      `SELECT u.id, u.name, u.first_name, u.last_name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.rfid_code, up.location, up.department, up.require_location, up.tracking_start_date, up.start_date, up.end_date, up.work_model_id, up.holiday_profile_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(result.lastInsertRowid) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at' | 'first_name' | 'last_name'> & {
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
      `SELECT u.id, u.name, u.first_name, u.last_name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.rfid_code, up.location, up.department, up.require_location, up.start_date, up.end_date, up.work_model_id, up.holiday_profile_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at' | 'first_name' | 'last_name'> & {
      active: number;
      vacation_allowance: number;
      personnel_number?: string | null;
    };
  res.json(toUserPayload(updated));
});

const userUpdateSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['employee', 'lead', 'admin']),
  personnel_number: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  rfid_code: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  location: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  department: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  require_location: z.boolean().optional(),
  tracking_start_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  start_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
  end_date: z
    .union([z.string().regex(dateRegex, 'Datum muss YYYY-MM-DD sein'), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value ? value : null)),
  work_model_id: z.number().int().optional(),
  active: z.boolean().optional(),
  holiday_profile_id: z.number().int().optional(),
  holiday_profile_valid_from: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
});

const flexConfigSchema = z.object({
  enabled: z.boolean(),
  adjustment: z.number().int().optional(),
});

const vacationAdjustmentSchema = z.object({
  delta: z.number(),
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
  const normalizedEmail = normalizeEmail(parsed.data.email);
  const duplicate = db
    .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
    .get(normalizedEmail, userId) as { id: number } | undefined;
  if (duplicate) {
    return res.status(409).json({ message: 'E-Mail ist bereits vergeben' });
  }
  const fullName = `${parsed.data.first_name} ${parsed.data.last_name}`.trim();
  const result = db
    .prepare('UPDATE users SET name = ?, first_name = ?, last_name = ?, email = ?, role = ? WHERE id = ?')
    .run(fullName, parsed.data.first_name, parsed.data.last_name, normalizedEmail, parsed.data.role, userId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Nutzer nicht gefunden' });
  }
  if (parsed.data.active !== undefined) {
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(parsed.data.active ? 1 : 0, userId);
  }
  if (parsed.data.end_date) {
    const endTs = new Date(`${parsed.data.end_date}T00:00:00Z`).getTime();
    if (endTs <= Date.now()) {
      db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(userId);
    }
  }
  db.prepare(
    `UPDATE user_profiles
     SET personnel_number = COALESCE(?, personnel_number),
         rfid_code = COALESCE(?, rfid_code),
         location = COALESCE(?, location),
         department = COALESCE(?, department),
         require_location = COALESCE(?, require_location),
         tracking_start_date = COALESCE(?, tracking_start_date),
         start_date = COALESCE(?, start_date),
         end_date = CASE WHEN ? THEN NULL WHEN ? IS NOT NULL THEN ? ELSE end_date END,
         work_model_id = COALESCE(?, work_model_id),
         holiday_profile_id = COALESCE(?, holiday_profile_id)
     WHERE user_id = ?`
  ).run(
    parsed.data.personnel_number ?? null,
    parsed.data.rfid_code ?? null,
    parsed.data.location ?? null,
    parsed.data.department ?? null,
    parsed.data.require_location === undefined ? null : parsed.data.require_location ? 1 : 0,
    parsed.data.tracking_start_date ?? null,
    parsed.data.start_date ?? null,
    parsed.data.end_date === null ? 1 : 0,
    parsed.data.end_date ?? null,
    parsed.data.end_date ?? null,
    parsed.data.work_model_id ?? null,
    parsed.data.holiday_profile_id ?? null,
    userId
  );
  if (parsed.data.holiday_profile_id) {
    upsertHolidayProfileVersion(userId, parsed.data.holiday_profile_id, parsed.data.holiday_profile_valid_from || parsed.data.tracking_start_date);
  }
  const updated = db
    .prepare(
      `SELECT u.id, u.name, u.first_name, u.last_name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled, up.personnel_number, up.rfid_code, up.location, up.department, up.require_location, up.tracking_start_date, up.start_date, up.end_date, up.work_model_id, up.holiday_profile_id
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       LEFT JOIN user_profiles up ON up.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at' | 'first_name' | 'last_name'> & {
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
  rfid_code: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  phone: z.string().max(80).optional().or(z.literal('')).transform((value) => value || undefined),
  address: z.string().max(180).optional().or(z.literal('')).transform((value) => value || undefined),
  city: z.string().max(120).optional().or(z.literal('')).transform((value) => value || undefined),
  postal_code: z.string().max(30).optional().or(z.literal('')).transform((value) => value || undefined),
  note: z.string().max(255).optional().or(z.literal('')).transform((value) => value || undefined),
  holiday_profile_id: z.number().int().optional(),
  tracking_start_date: z
    .string()
    .regex(dateRegex, 'Datum muss YYYY-MM-DD sein')
    .optional()
    .or(z.literal(''))
    .transform((value) => value || undefined),
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
  if (guardMissingUser(userId, res)) return;
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
      `SELECT u.id, u.name, u.first_name, u.last_name, u.email, u.role, u.created_at, u.active, IFNULL(us.vacation_allowance, 0) as vacation_allowance
       , IFNULL(us.flex_enabled, 0) as flex_enabled
       FROM users u
       LEFT JOIN user_settings us ON us.user_id = u.id
       WHERE u.id = ?`
    )
    .get(userId) as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at' | 'first_name' | 'last_name'> & {
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
  if (guardMissingUser(userId, res)) return;
  ensureProfileRow(userId);
  const profile = db
    .prepare(
      `SELECT birth_date, personnel_number, rfid_code, phone, address, city, postal_code, note, tracking_start_date
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
  if (guardMissingUser(userId, res)) return;
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureProfileRow(userId);
  db.prepare(
    `UPDATE user_profiles
     SET birth_date = ?, personnel_number = ?, rfid_code = ?, phone = ?, address = ?, city = ?, postal_code = ?, note = ?, tracking_start_date = ?
     WHERE user_id = ?`
  ).run(
    parsed.data.birth_date ?? null,
    parsed.data.personnel_number ?? null,
    parsed.data.rfid_code ?? null,
    parsed.data.phone ?? null,
    parsed.data.address ?? null,
    parsed.data.city ?? null,
    parsed.data.postal_code ?? null,
    parsed.data.note ?? null,
    parsed.data.tracking_start_date ?? null,
    userId
  );
  const profile = db
    .prepare(
      `SELECT birth_date, personnel_number, rfid_code, phone, address, city, postal_code, note
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
  if (guardMissingUser(userId, res)) return;
  seedScheduleVersion(userId);
  const schedule = db
    .prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC')
    .all(userId);
  res.json({ days: schedule, history: scheduleHistory(userId) });
});

router.put('/:id/schedule', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (guardMissingUser(userId, res)) return;
  const parsed = scheduleSchema.extend({ validFrom: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const tx = db.transaction((payload: typeof parsed.data) => {
    db.prepare('DELETE FROM work_schedules WHERE user_id = ?').run(userId);
    const insert = db.prepare('INSERT INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
    payload.days.forEach((day) => insert.run(userId, day.weekday, day.minutes));

    const versionStmt = db.prepare(
      `INSERT OR REPLACE INTO work_schedule_versions
        (user_id, valid_from, mon_minutes, tue_minutes, wed_minutes, thu_minutes, fri_minutes, sat_minutes, sun_minutes)
        VALUES (?,?,?,?,?,?,?,?,?)`
    );
    const minutes = new Map(payload.days.map((d) => [d.weekday, d.minutes]));
    const validFrom = payload.validFrom || new Date().toISOString().slice(0, 10);
    versionStmt.run(
      userId,
      validFrom,
      minutes.get(0) ?? 0,
      minutes.get(1) ?? 0,
      minutes.get(2) ?? 0,
      minutes.get(3) ?? 0,
      minutes.get(4) ?? 0,
      minutes.get(5) ?? 0,
      minutes.get(6) ?? 0
    );
  });
  tx(parsed.data);
  res.json({
    days: db.prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC').all(userId),
    history: scheduleHistory(userId),
  });
});

router.delete('/:id/schedule/latest', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (guardMissingUser(userId, res)) return;
  seedScheduleVersion(userId);
  const versions = db
    .prepare('SELECT * FROM work_schedule_versions WHERE user_id = ? ORDER BY date(valid_from) ASC, id ASC')
    .all(userId) as any[];
  if (versions.length <= 1) {
    return res.status(400).json({ message: 'Keine frühere Version vorhanden' });
  }
  const latest = versions[versions.length - 1];
  db.prepare('DELETE FROM work_schedule_versions WHERE id = ?').run(latest.id);
  const newCurrent = versions[versions.length - 2];
  const minutesByWeekday = [
    newCurrent.mon_minutes,
    newCurrent.tue_minutes,
    newCurrent.wed_minutes,
    newCurrent.thu_minutes,
    newCurrent.fri_minutes,
    newCurrent.sat_minutes,
    newCurrent.sun_minutes,
  ];
  const resetTx = db.transaction(() => {
    db.prepare('DELETE FROM work_schedules WHERE user_id = ?').run(userId);
    const insert = db.prepare('INSERT INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
    minutesByWeekday.forEach((minutes, idx) => insert.run(userId, idx, minutes));
  });
  resetTx();
  res.json({
    days: db.prepare('SELECT weekday, minutes FROM work_schedules WHERE user_id = ? ORDER BY weekday ASC').all(userId),
    history: scheduleHistory(userId),
  });
});

router.get('/:id/flex', (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (guardMissingUser(userId, res)) return;
  const { balanceMinutes, plannedTotal, workedTotal, adjustment, enabled } = computeFlexBalance(userId);
  res.json({ balanceMinutes, plannedMinutes: plannedTotal, workedMinutes: workedTotal, adjustment, enabled });
});

router.patch('/:id/flex', (req: AuthRequest, res: Response) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (guardMissingUser(userId, res)) return;
  const parsed = flexConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureSettingsRow(userId);
  const currentRow = db
    .prepare('SELECT flex_adjust_minutes FROM user_settings WHERE user_id = ?')
    .get(userId) as { flex_adjust_minutes?: number } | undefined;
  const currentAdjustment = currentRow?.flex_adjust_minutes ?? 0;
  const adjustment = parsed.data.adjustment ?? currentAdjustment;
  db.prepare('UPDATE user_settings SET flex_enabled = ?, flex_adjust_minutes = ? WHERE user_id = ?').run(
    parsed.data.enabled ? 1 : 0,
    adjustment,
    userId
  );
  if (adjustment !== currentAdjustment || parsed.data.enabled !== undefined) {
    logAction(req.user?.id ?? null, 'flex.adjust', userId, {
      previous: currentAdjustment,
      next: adjustment,
      enabled: parsed.data.enabled,
    });
  }
  const { balanceMinutes, plannedTotal, workedTotal } = computeFlexBalance(userId);
  res.json({ balanceMinutes, plannedMinutes: plannedTotal, workedMinutes: workedTotal, adjustment, enabled: parsed.data.enabled });
});

router.patch('/:id/vacation-adjust', authorize(['admin']), (req: AuthRequest, res: Response) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ message: 'Ungültige Nutzer-ID' });
  }
  if (guardMissingUser(userId, res)) return;
  const parsed = vacationAdjustmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  ensureSettingsRow(userId);
  const row = db
    .prepare('SELECT vacation_adjust_days FROM user_settings WHERE user_id = ?')
    .get(userId) as { vacation_adjust_days?: number } | undefined;
  const current = row?.vacation_adjust_days ?? 0;
  const next = current + parsed.data.delta;
  db.prepare('UPDATE user_settings SET vacation_adjust_days = ? WHERE user_id = ?').run(next, userId);
  logAction(req.user?.id ?? null, 'vacation.adjust', userId, {
    previous: current,
    delta: parsed.data.delta,
    next,
  });
  res.json({ adjustment: next });
});

export default router;
