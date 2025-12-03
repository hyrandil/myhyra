import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_FILE } from './config';

const dbDir = path.dirname(DATABASE_FILE);
fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(DATABASE_FILE);

db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT,
  last_name TEXT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('employee', 'lead', 'hr', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holiday_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  duration TEXT NOT NULL CHECK(duration IN ('full','half')) DEFAULT 'full',
  source TEXT NOT NULL DEFAULT 'imported',
  UNIQUE(profile_id, date, name),
  FOREIGN KEY(profile_id) REFERENCES holiday_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  clock_in DATETIME NOT NULL,
  clock_out DATETIME,
  clock_in_lat REAL,
  clock_in_lng REAL,
  clock_out_lat REAL,
  clock_out_lng REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS work_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  monday INTEGER NOT NULL DEFAULT 480,
  tuesday INTEGER NOT NULL DEFAULT 480,
  wednesday INTEGER NOT NULL DEFAULT 480,
  thursday INTEGER NOT NULL DEFAULT 480,
  friday INTEGER NOT NULL DEFAULT 480,
  saturday INTEGER NOT NULL DEFAULT 0,
  sunday INTEGER NOT NULL DEFAULT 0,
  pause_after_minutes INTEGER NOT NULL DEFAULT 360,
  pause_duration_minutes INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'de',
  week_start TEXT NOT NULL DEFAULT 'monday',
  time_format TEXT NOT NULL DEFAULT '24h',
  flex_enabled INTEGER NOT NULL DEFAULT 0,
  flex_adjust_minutes INTEGER NOT NULL DEFAULT 0,
  vacation_allowance REAL NOT NULL DEFAULT 30,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS absences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  date TEXT,
  type TEXT NOT NULL,
  duration TEXT NOT NULL CHECK(duration IN ('full','half')),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS absence_kinds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  counts_as_work INTEGER NOT NULL DEFAULT 1,
  allow_full INTEGER NOT NULL DEFAULT 1,
  allow_half INTEGER NOT NULL DEFAULT 1,
  allow_hourly INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY,
  location TEXT,
  department TEXT,
  work_model_id INTEGER,
  holiday_profile_id INTEGER,
  tracking_start_date TEXT,
  start_date TEXT,
  end_date TEXT,
  birth_date TEXT,
  personnel_number TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  note TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(work_model_id) REFERENCES work_models(id),
  FOREIGN KEY(holiday_profile_id) REFERENCES holiday_profiles(id)
);

CREATE TABLE IF NOT EXISTS work_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, weekday),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('CLOCK_IN','CLOCK_OUT','BREAK_START','BREAK_END')),
  source TEXT NOT NULL CHECK(source IN ('WEB','APP','TERMINAL')) DEFAULT 'WEB',
  lat REAL,
  lng REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS department_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('member','lead','hr')) DEFAULT 'member',
  UNIQUE(department_id, user_id),
  FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS absence_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('vacation','sick','remote','other')),
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
  comment TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  cancel_reason TEXT,
  canceled INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
`);

type TableColumn = { name: string };
const ensureTableColumn = (table: string, name: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info('${table}')`).all() as TableColumn[];
  const exists = columns.some((column) => column.name === name);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    return false;
  }
  return true;
};

ensureTableColumn('bookings', 'clock_in_lat', 'clock_in_lat REAL');
ensureTableColumn('bookings', 'clock_in_lng', 'clock_in_lng REAL');
ensureTableColumn('bookings', 'clock_out_lat', 'clock_out_lat REAL');
ensureTableColumn('bookings', 'clock_out_lng', 'clock_out_lng REAL');
ensureTableColumn('users', 'first_name', 'first_name TEXT');
ensureTableColumn('users', 'last_name', 'last_name TEXT');
ensureTableColumn('user_profiles', 'tracking_start_date', 'tracking_start_date TEXT');
ensureTableColumn('users', 'active', 'active INTEGER NOT NULL DEFAULT 1');
ensureTableColumn('users', 'role', "role TEXT NOT NULL DEFAULT 'employee'");
ensureTableColumn('user_settings', 'week_start', "week_start TEXT NOT NULL DEFAULT 'monday'");
ensureTableColumn('user_settings', 'time_format', "time_format TEXT NOT NULL DEFAULT '24h'");
ensureTableColumn('user_settings', 'flex_enabled', 'flex_enabled INTEGER NOT NULL DEFAULT 0');
ensureTableColumn('user_settings', 'flex_adjust_minutes', 'flex_adjust_minutes INTEGER NOT NULL DEFAULT 0');
db.prepare("UPDATE user_settings SET week_start = 'monday' WHERE week_start IS NULL").run();
db.prepare("UPDATE user_settings SET time_format = '24h' WHERE time_format IS NULL").run();
db.prepare('UPDATE user_settings SET flex_enabled = 0 WHERE flex_enabled IS NULL').run();
db.prepare('UPDATE user_settings SET flex_adjust_minutes = 0 WHERE flex_adjust_minutes IS NULL').run();
db.exec(`INSERT OR IGNORE INTO user_settings (user_id) SELECT id FROM users;`);
ensureTableColumn('absences', 'start_date', 'start_date TEXT');
ensureTableColumn('absences', 'end_date', 'end_date TEXT');
db.prepare('UPDATE absences SET start_date = date WHERE start_date IS NULL').run();
db.prepare('UPDATE absences SET end_date = date WHERE end_date IS NULL').run();
ensureTableColumn('absences', 'start_time', 'start_time TEXT');
ensureTableColumn('absences', 'end_time', 'end_time TEXT');
ensureTableColumn('absences', 'minutes_override', 'minutes_override INTEGER');
ensureTableColumn('user_profiles', 'location', 'location TEXT');
ensureTableColumn('user_profiles', 'department', 'department TEXT');
ensureTableColumn('user_profiles', 'work_model_id', 'work_model_id INTEGER');
// Ensure legacy databases receive holiday profile support even if they were created
// before the column existed. The helper already adds the column when missing, and the
// defensive try/catch covers environments where partial migrations left the schema in
// an unexpected state.
try {
  ensureTableColumn(
    'user_profiles',
    'holiday_profile_id',
    'holiday_profile_id INTEGER REFERENCES holiday_profiles(id)'
  );
} catch (err) {
  const message = err instanceof Error ? err.message : '';
  if (!message.toLowerCase().includes('duplicate column')) {
    db.exec('ALTER TABLE user_profiles ADD COLUMN holiday_profile_id INTEGER');
  }
}
ensureTableColumn('absence_requests', 'cancel_requested', 'cancel_requested INTEGER NOT NULL DEFAULT 0');
ensureTableColumn('absence_requests', 'cancel_reason', 'cancel_reason TEXT');
ensureTableColumn('absence_requests', 'canceled', 'canceled INTEGER NOT NULL DEFAULT 0');
ensureTableColumn('absence_requests', 'comment', 'comment TEXT');
ensureTableColumn('user_profiles', 'start_date', 'start_date TEXT');
ensureTableColumn('user_profiles', 'end_date', 'end_date TEXT');
const absenceKindCount = db.prepare('SELECT COUNT(*) as count FROM absence_kinds').get() as { count: number };
if (absenceKindCount.count === 0) {
  db.exec(`
    INSERT INTO absence_kinds (code, label, counts_as_work, allow_full, allow_half, allow_hourly)
    VALUES
      ('vacation', 'Urlaub', 1, 1, 1, 0),
      ('sick', 'Krankheit', 1, 1, 1, 1),
      ('remote', 'Remote', 1, 1, 1, 0),
      ('other', 'Sonstige', 0, 1, 1, 0),
      ('flex', 'Gleitzeit', 0, 1, 1, 1)
  `);
}

function ensureAdminUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL) as
    | { id: number }
    | undefined;
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  if (!existing) {
    const result = db
      .prepare(
        'INSERT INTO users (name, first_name, last_name, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)'
      )
      .run('Administrator', 'Administrator', '', ADMIN_EMAIL, passwordHash, 'admin');
    return Number(result.lastInsertRowid);
  }

  db.prepare(
    'UPDATE users SET password_hash = ?, role = ?, active = 1, name = ?, first_name = ?, last_name = ? WHERE id = ?'
  ).run(
    passwordHash,
    'admin',
    'Administrator',
    'Administrator',
    '',
    existing.id
  );
  return existing.id;
}

const defaultSchedule = [480, 480, 480, 480, 480, 0, 0];

function ensureDefaultWorkModel() {
  const existing = db.prepare('SELECT id FROM work_models WHERE name = ?').get('Standard 40h') as
    | { id: number }
    | undefined;
  if (!existing) {
    db.prepare(
      `INSERT INTO work_models (name, monday, tuesday, wednesday, thursday, friday, saturday, sunday, pause_after_minutes, pause_duration_minutes)
       VALUES ('Standard 40h', 480, 480, 480, 480, 480, 0, 0, 360, 30)`
    ).run();
  }
}

function ensureProfile(userId: number) {
  const defaultModel = db.prepare('SELECT id FROM work_models ORDER BY id ASC LIMIT 1').get() as
    | { id: number }
    | undefined;
  db.prepare('INSERT OR IGNORE INTO user_profiles (user_id, work_model_id) VALUES (?, ?)').run(
    userId,
    defaultModel?.id ?? null
  );
}

function ensureSchedule(userId: number) {
  const existing = db.prepare('SELECT COUNT(1) as count FROM work_schedules WHERE user_id = ?').get(userId) as {
    count: number;
  };
  if (existing?.count === 7) {
    return;
  }
  const insert = db.prepare('INSERT OR IGNORE INTO work_schedules (user_id, weekday, minutes) VALUES (?, ?, ?)');
  defaultSchedule.forEach((minutes, weekday) => insert.run(userId, weekday, minutes));
}

ensureDefaultWorkModel();

const adminId = ensureAdminUser();

const userIds = db.prepare('SELECT id FROM users').all() as { id: number }[];
userIds.forEach((row) => {
  ensureProfile(row.id);
  ensureSchedule(row.id);
});

db.exec(`
CREATE TABLE IF NOT EXISTS time_correction_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  handled_by INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(handled_by) REFERENCES users(id) ON DELETE SET NULL
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS time_correction_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('CLOCK_IN','CLOCK_OUT')),
  action TEXT NOT NULL CHECK(action IN ('add','delete','replace')) DEFAULT 'add',
  entry_id INTEGER,
  FOREIGN KEY(request_id) REFERENCES time_correction_requests(id) ON DELETE CASCADE
);
`);

// Backfill newer columns on older databases
const correctionColumns = db.prepare("PRAGMA table_info('time_correction_entries')").all() as { name: string }[];
const hasAction = correctionColumns.some((col) => col.name === 'action');
const hasEntryId = correctionColumns.some((col) => col.name === 'entry_id');
if (!hasAction) {
  db.exec("ALTER TABLE time_correction_entries ADD COLUMN action TEXT NOT NULL DEFAULT 'add'");
}
if (!hasEntryId) {
  db.exec('ALTER TABLE time_correction_entries ADD COLUMN entry_id INTEGER');
}

if (adminId) {
  ensureProfile(adminId);
  ensureSchedule(adminId);
}

export default db;
