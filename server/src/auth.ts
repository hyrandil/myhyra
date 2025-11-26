import { Request, Response, NextFunction } from 'express';
import db from './db';
import { Role } from './types';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: Role;
  };
}

function applyNoCacheHeaders(res: Response) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) {
    return res.redirect('/login');
  }
  const user = db
    .prepare('SELECT id, role, active FROM users WHERE id = ?')
    .get(userId) as { id: number; role: Role; active: number } | undefined;
  if (!user || !user.active) {
    req.session.destroy(() => undefined);
    res.clearCookie('sid');
    return res.redirect('/login');
  }
  req.user = { id: user.id, role: user.role };
  applyNoCacheHeaders(res);
  next();
}

export function authorize(roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }
    next();
  };
}
