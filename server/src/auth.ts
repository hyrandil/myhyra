import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config';
import { Role } from './types';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: Role;
  };
}

export function signToken(payload: { id: number; role: Role }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ message: 'Fehlendes Authorization Header' });
  }
  const token = header.replace('Bearer ', '');
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: Role };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Ungültiges Token' });
  }
}

export function authorize(roles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Keine Berechtigung' });
    }
    next();
  };
}
