import { Router } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import db from '../db';
import { authorize, requireAuth, AuthRequest } from '../auth';
import { logAction } from '../utils/logger';

const router = Router();

const terminalCreateSchema = z.object({
  name: z.string().min(1),
});

const terminalUpdateSchema = z.object({
  active: z.boolean(),
});

const terminalEntrySchema = z.object({
  rfid: z.string().min(1),
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT']).optional(),
});

const terminalStatusSchema = z.object({
  rfid: z.string().min(1),
});

const terminalByKey = (apiKey?: string | null) => {
  if (!apiKey) return null;
  return db
    .prepare('SELECT id, name, api_key, active FROM terminal_keys WHERE api_key = ?')
    .get(apiKey) as { id: number; name: string; api_key: string; active: number } | undefined;
};

const findUserByRfid = (rfid: string) => {
  return db
    .prepare(
      `SELECT u.id, u.name, u.first_name, u.last_name
       FROM users u
       JOIN user_profiles up ON up.user_id = u.id
       WHERE up.rfid_code = ? AND u.active = 1`
    )
    .get(rfid) as { id: number; name: string; first_name?: string | null; last_name?: string | null } | undefined;
};

const resolveUserName = (user: { name: string; first_name?: string | null; last_name?: string | null }) => {
  return `${[user.first_name, user.last_name].filter(Boolean).join(' ') || user.name}`;
};

const getNextAction = (userId: number) => {
  const lastEntry = db
    .prepare('SELECT type FROM time_entries WHERE user_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1')
    .get(userId) as { type: 'CLOCK_IN' | 'CLOCK_OUT' } | undefined;
  if (!lastEntry || lastEntry.type === 'CLOCK_OUT') {
    return { nextAction: 'CLOCK_IN' as const, lastAction: lastEntry?.type ?? null };
  }
  return { nextAction: 'CLOCK_OUT' as const, lastAction: lastEntry.type };
};

router.get('/', requireAuth, authorize(['admin']), (req: AuthRequest, res) => {
  const rows = db
    .prepare('SELECT id, name, api_key, active, last_seen_at, created_at FROM terminal_keys ORDER BY name ASC')
    .all() as {
    id: number;
    name: string;
    api_key: string;
    active: number;
    last_seen_at?: string | null;
    created_at?: string;
  }[];
  const now = Date.now();
  const terminals = rows.map((row) => {
    const lastSeen = row.last_seen_at ? new Date(row.last_seen_at).getTime() : null;
    const isOnline = Boolean(row.active) && lastSeen !== null && now - lastSeen <= 5 * 60 * 1000;
    return {
      id: row.id,
      name: row.name,
      apiKey: row.api_key,
      active: Boolean(row.active),
      lastSeenAt: row.last_seen_at ?? undefined,
      createdAt: row.created_at,
      status: isOnline ? 'online' : 'offline',
    };
  });
  res.json({ terminals });
});

router.post('/', requireAuth, authorize(['admin']), (req: AuthRequest, res) => {
  const parsed = terminalCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const apiKey = crypto.randomBytes(24).toString('hex');
  const result = db
    .prepare('INSERT INTO terminal_keys (name, api_key, active) VALUES (?, ?, 1)')
    .run(parsed.data.name, apiKey);
  logAction(req.user!.id, 'terminal.create', req.user!.id, { terminalId: result.lastInsertRowid });
  res.status(201).json({ id: result.lastInsertRowid, name: parsed.data.name, apiKey, active: true });
});

router.patch('/:id', requireAuth, authorize(['admin']), (req: AuthRequest, res) => {
  const terminalId = Number(req.params.id);
  if (Number.isNaN(terminalId)) {
    return res.status(400).json({ message: 'Ungültige Terminal-ID' });
  }
  const parsed = terminalUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const result = db
    .prepare('UPDATE terminal_keys SET active = ? WHERE id = ?')
    .run(parsed.data.active ? 1 : 0, terminalId);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Terminal nicht gefunden' });
  }
  res.json({ id: terminalId, active: parsed.data.active });
});

router.post('/entry', (req, res) => {
  const apiKey = req.header('x-api-key');
  const terminal = terminalByKey(apiKey);
  if (!terminal || !terminal.active) {
    return res.status(401).json({ message: 'Terminal nicht autorisiert' });
  }
  const parsed = terminalEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const user = findUserByRfid(parsed.data.rfid);
  if (!user) {
    return res.status(404).json({ message: 'RFID nicht gefunden' });
  }
  const { nextAction } = getNextAction(user.id);
  const action = nextAction;
  const timestamp = new Date().toISOString();
  db.prepare('INSERT INTO time_entries (user_id, timestamp, type, source) VALUES (?, ?, ?, ?)').run(
    user.id,
    timestamp,
    action,
    'TERMINAL'
  );
  db.prepare('UPDATE terminal_keys SET last_seen_at = ? WHERE id = ?').run(timestamp, terminal.id);
  res.json({
    ok: true,
    action,
    user: {
      id: user.id,
      name: resolveUserName(user),
    },
    timestamp,
  });
});

router.get('/status', (req, res) => {
  const apiKey = req.header('x-api-key');
  const terminal = terminalByKey(apiKey);
  if (!terminal || !terminal.active) {
    return res.status(401).json({ message: 'Terminal nicht autorisiert' });
  }
  const parsed = terminalStatusSchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errors: parsed.error.format() });
  }
  const user = findUserByRfid(parsed.data.rfid);
  if (!user) {
    return res.status(404).json({ message: 'RFID nicht gefunden' });
  }
  const { nextAction, lastAction } = getNextAction(user.id);
  const timestamp = new Date().toISOString();
  db.prepare('UPDATE terminal_keys SET last_seen_at = ? WHERE id = ?').run(timestamp, terminal.id);
  res.json({
    ok: true,
    nextAction,
    lastAction,
    user: {
      id: user.id,
      name: resolveUserName(user),
    },
  });
});

export default router;
