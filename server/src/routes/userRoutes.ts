import { Router } from 'express';
import db from '../db';
import { authenticate, authorize } from '../auth';
import type { User } from '../types';

const router = Router();

router.use(authenticate, authorize(['admin']));

router.get('/', (_req, res) => {
  const users = db
    .prepare("SELECT id, name, email, role, created_at FROM users WHERE role = 'user' ORDER BY name ASC")
    .all() as Pick<User, 'id' | 'name' | 'email' | 'role' | 'created_at'>[];
  res.json(users);
});

export default router;
