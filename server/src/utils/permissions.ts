import db from '../db';
import { Role } from '../types';

export function managedDepartments(userId: number): number[] {
  const rows = db
    .prepare("SELECT department_id FROM department_members WHERE user_id = ? AND role IN ('lead','hr')")
    .all(userId) as { department_id: number }[];
  return rows.map((row) => row.department_id);
}

export function userDepartments(userId: number): number[] {
  const rows = db
    .prepare('SELECT department_id FROM department_members WHERE user_id = ?')
    .all(userId) as { department_id: number }[];
  return rows.map((row) => row.department_id);
}

export function canManageUser(actorId: number, actorRole: Role, targetUserId: number) {
  if (actorRole === 'admin' || actorRole === 'hr') return true;
  if (actorRole !== 'lead') return false;
  if (actorId === targetUserId) return false;
  const owned = managedDepartments(actorId);
  if (owned.length === 0) return false;
  const targetDepartments = userDepartments(targetUserId);
  return targetDepartments.some((deptId) => owned.includes(deptId));
}
