import { Request, Response, NextFunction } from 'express';
import type { Session } from 'express-session';
import db from './db';
import type { User, Role } from './types';

type AuthSession = Session & {
  userId?: number;
  role?: Role;
};

export interface AuthRequest extends Request {
  session: AuthSession;
  user?: User;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const session = req.session as AuthSession;

  if (!session.userId) {
    return res.status(401).json({ message: 'Nicht eingeloggt' });
  }

  const user = db
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(session.userId) as User | undefined;

  if (!user) {
    return res.status(401).json({ message: 'Benutzer nicht gefunden' });
  }

  if (!user.active) {
    return res.status(403).json({ message: 'Dieser Zugang wurde deaktiviert' });
  }

  req.user = user;
  next();
};

export const authorize = (roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const session = req.session as AuthSession;
    const role = session.role ?? req.user?.role;

    if (!role || !roles.includes(role)) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }

    next();
  };
};
