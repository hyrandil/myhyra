import { Router } from 'express';
import db from '../db';
import { authorize, AuthRequest, requireAuth } from '../auth';

const router = Router();

router.use(requireAuth);
router.use(authorize(['admin', 'hr']));

router.get('/', (req: AuthRequest, res) => {
  const q = String(req.query.q || '').trim();
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  const limit = Math.min(Number(req.query.limit) || 200, 500);

  const filters: string[] = [];
  const params: any[] = [];

  if (userId && Number.isFinite(userId)) {
    filters.push('(al.actor_id = ? OR al.target_user_id = ?)');
    params.push(userId, userId);
  }
  if (q) {
    filters.push('(al.action LIKE ? OR al.detail LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT al.*, actor.name as actor_name, target.name as target_name
         FROM audit_logs al
         LEFT JOIN users actor ON actor.id = al.actor_id
         LEFT JOIN users target ON target.id = al.target_user_id
         ${where}
         ORDER BY al.created_at DESC
         LIMIT ${limit}`
    )
    .all(...params) as any[];

  res.json(
    rows.map((row) => ({
      id: row.id,
      actor_id: row.actor_id,
      actor_name: row.actor_name,
      target_user_id: row.target_user_id,
      target_name: row.target_name,
      action: row.action,
      detail: row.detail,
      created_at: row.created_at,
    }))
  );
});

export default router;
