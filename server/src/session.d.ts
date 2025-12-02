import 'express-session';
import { Role } from './types';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    role?: Role;
  }
}
