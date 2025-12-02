import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe!123';
export const DATABASE_FILE =
  process.env.DATABASE_FILE || path.resolve(process.cwd(), 'data', 'time_tracking.db');
export const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-session-secret-change-me';
const defaultOrigin = 'http://localhost:5173';
const originsEnv =
  process.env.WEB_ORIGINS || process.env.WEB_ORIGIN || defaultOrigin;

export const WEB_ORIGINS = originsEnv
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
// Backwards compatible single origin (first in list)
export const WEB_ORIGIN = WEB_ORIGINS[0] || defaultOrigin;
