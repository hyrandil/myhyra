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
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'admin')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  type TEXT NOT NULL CHECK(type IN ('vacation','sick','remote','other')),
  duration TEXT NOT NULL CHECK(duration IN ('full','half')),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INTEGER PRIMARY KEY,
  birth_date TEXT,
  personnel_number TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  note TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS work_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  weekday INTEGER NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id, weekday),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

type TableColumn = { name: string };
const ensureTableColumn = (table: string, name: string, definition: string) => {
  const columns = db.prepare(`PRAGMA table_info('${table}')`).all() as TableColumn[];
  const exists = columns.some((column) => column.name === name);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
};

ensureTableColumn('bookings', 'clock_in_lat', 'REAL');
ensureTableColumn('bookings', 'clock_in_lng', 'REAL');
ensureTableColumn('bookings', 'clock_out_lat', 'REAL');
ensureTableColumn('bookings', 'clock_out_lng', 'REAL');
ensureTableColumn('users', 'active', 'INTEGER NOT NULL DEFAULT 1');
ensureTableColumn('user_settings', 'week_start', "TEXT NOT NULL DEFAULT 'monday'");
ensureTableColumn('user_settings', 'time_format', "TEXT NOT NULL DEFAULT '24h'");
ensureTableColumn('user_settings', 'flex_enabled', 'INTEGER NOT NULL DEFAULT 0');
ensureTableColumn('user_settings', 'flex_adjust_minutes', 'INTEGER NOT NULL DEFAULT 0');
db.prepare("UPDATE user_settings SET week_start = 'monday' WHERE week_start IS NULL").run();
db.prepare("UPDATE user_settings SET time_format = '24h' WHERE time_format IS NULL").run();
db.prepare('UPDATE user_settings SET flex_enabled = 0 WHERE flex_enabled IS NULL').run();
db.prepare('UPDATE user_settings SET flex_adjust_minutes = 0 WHERE flex_adjust_minutes IS NULL').run();
db.exec(`INSERT OR IGNORE INTO user_settings (user_id) SELECT id FROM users;`);
ensureTableColumn('absences', 'start_date', 'TEXT');
ensureTableColumn('absences', 'end_date', 'TEXT');
db.prepare('UPDATE absences SET start_date = date WHERE start_date IS NULL').run();
db.prepare('UPDATE absences SET end_date = date WHERE end_date IS NULL').run();

function ensureAdminUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!existing) {
    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare(
      'INSERT INTO users (name, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)'
    ).run('Administrator', ADMIN_EMAIL, passwordHash, 'admin');
  }
}

const defaultSchedule = [480, 480, 480, 480, 480, 0, 0];

function ensureProfile(userId: number) {
  db.prepare('INSERT OR IGNORE INTO user_profiles (user_id) VALUES (?)').run(userId);
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

const userIds = db.prepare('SELECT id FROM users').all() as { id: number }[];
userIds.forEach((row) => {
  ensureProfile(row.id);
  ensureSchedule(row.id);
});

ensureAdminUser();
const adminRow = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL) as { id: number } | undefined;
if (adminRow) {
  ensureProfile(adminRow.id);
  ensureSchedule(adminRow.id);
}

export default db;
