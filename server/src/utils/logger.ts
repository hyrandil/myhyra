import db from '../db';

export function logAction(
  actorId: number | null,
  action: string,
  targetUserId?: number | null,
  detail?: string | Record<string, any>
) {
  try {
    const detailText =
      typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : null;
    db.prepare(
      'INSERT INTO audit_logs (actor_id, target_user_id, action, detail) VALUES (?, ?, ?, ?)' 
    ).run(actorId ?? null, targetUserId ?? null, action, detailText);
  } catch (error) {
    // logging must never crash primary flow
    console.error('logAction failed', error);
  }
}
