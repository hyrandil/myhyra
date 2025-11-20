import { Router } from 'express';
import db from '../db';
import { authenticate, authorize } from '../auth';

const router = Router();

router.use(authenticate);
router.use(authorize(['admin']));

const monthRegex = /^\d{4}-\d{2}$/;

router.get('/attendance', (req, res) => {
  const monthParam = typeof req.query.month === 'string' && monthRegex.test(req.query.month)
    ? req.query.month
    : undefined;
  const today = new Date();
  const fallbackMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const month = monthParam ?? fallbackMonth;

  const bookings = db
    .prepare(
      `SELECT user_id, DATE(clock_in) as work_day FROM bookings
       WHERE strftime('%Y-%m', clock_in) = ?
       GROUP BY user_id, work_day`
    )
    .all(month) as { user_id: number; work_day: string }[];

  const absences = db
    .prepare('SELECT user_id, date, type, duration FROM absences WHERE substr(date, 1, 7) = ?')
    .all(month) as { user_id: number; date: string; type: string; duration: 'full' | 'half' }[];

  const settings = db
    .prepare('SELECT user_id, vacation_allowance FROM user_settings')
    .all() as { user_id: number; vacation_allowance: number }[];

  const users = db
    .prepare('SELECT id, name, email FROM users ORDER BY name ASC')
    .all() as { id: number; name: string; email: string }[];

  const allowanceMap = new Map(settings.map((item) => [item.user_id, item.vacation_allowance]));
  const presenceMap = new Map<number, Set<string>>();
  bookings.forEach((row) => {
    if (!presenceMap.has(row.user_id)) {
      presenceMap.set(row.user_id, new Set());
    }
    presenceMap.get(row.user_id)!.add(row.work_day);
  });

  type AbsenceBucket = {
    vacation: number;
    sick: number;
    remote: number;
    other: number;
  };
  const absenceMap = new Map<number, AbsenceBucket>();

  const addAbsence = (userId: number, type: string, duration: 'full' | 'half') => {
    if (!absenceMap.has(userId)) {
      absenceMap.set(userId, { vacation: 0, sick: 0, remote: 0, other: 0 });
    }
    const bucket = absenceMap.get(userId)!;
    const days = duration === 'half' ? 0.5 : 1;
    switch (type) {
      case 'vacation':
        bucket.vacation += days;
        break;
      case 'sick':
        bucket.sick += days;
        break;
      case 'remote':
        bucket.remote += days;
        break;
      default:
        bucket.other += days;
    }
  };

  absences.forEach((row) => addAbsence(row.user_id, row.type, row.duration));

  const rows = users.map((user) => {
    const presenceDays = presenceMap.get(user.id)?.size ?? 0;
    const absenceBucket = absenceMap.get(user.id) ?? { vacation: 0, sick: 0, remote: 0, other: 0 };
    const allowance = allowanceMap.get(user.id) ?? 0;
    const usedVacation = absenceBucket.vacation;
    return {
      user_id: user.id,
      name: user.name,
      email: user.email,
      presenceDays,
      vacationDays: absenceBucket.vacation,
      sickDays: absenceBucket.sick,
      remoteDays: absenceBucket.remote,
      otherAbsences: absenceBucket.other,
      remainingVacation: Math.max(allowance - usedVacation, 0),
    };
  });

  res.json({ month, rows });
});

export default router;
