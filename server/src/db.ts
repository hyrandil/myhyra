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
`);

type TableColumn = { name: string };
const bookingColumns = db.prepare("PRAGMA table_info('bookings')").all() as TableColumn[];
const ensureColumn = (name: string, definition: string) => {
  const exists = bookingColumns.some((column) => column.name === name);
  if (!exists) {
    db.exec(`ALTER TABLE bookings ADD COLUMN ${definition}`);
  }
};

ensureColumn('clock_in_lat', 'REAL');
ensureColumn('clock_in_lng', 'REAL');
ensureColumn('clock_out_lat', 'REAL');
ensureColumn('clock_out_lng', 'REAL');

function ensureAdminUser() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(ADMIN_EMAIL);
  if (!existing) {
    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    db.prepare(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)' 
    ).run('Administrator', ADMIN_EMAIL, passwordHash, 'admin');
  }
}

ensureAdminUser();

export default db;
