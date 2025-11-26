import { TimeEntry } from '../types';

const MS_IN_MINUTE = 60000;

export function computeDayWorkMinutes(entries: TimeEntry[]) {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  let currentIn: number | null = null;
  let workMs = 0;
  let breakMs = 0;
  let firstIn: number | null = null;
  let lastOut: number | null = null;

  sorted.forEach((entry) => {
    const ts = new Date(entry.timestamp).getTime();
    if (Number.isNaN(ts)) return;

    if (entry.type === 'CLOCK_IN' || entry.type === 'BREAK_END') {
      if (lastOut !== null) {
        breakMs += Math.max(ts - lastOut, 0);
      }
      currentIn = ts;
      lastOut = null;
      if (firstIn === null) firstIn = ts;
    }

    if (entry.type === 'BREAK_START' || entry.type === 'CLOCK_OUT') {
      if (currentIn !== null) {
        workMs += Math.max(ts - currentIn, 0);
      }
      currentIn = null;
      lastOut = ts;
      if (firstIn === null) firstIn = ts;
    }
  });

  const spanMinutes = firstIn && lastOut ? Math.max(lastOut - firstIn, 0) / MS_IN_MINUTE : 0;
  const workedMinutes = workMs / MS_IN_MINUTE;
  const recordedBreakMinutes = breakMs / MS_IN_MINUTE;

  if (spanMinutes <= 360) {
    return Math.round(workedMinutes);
  }

  const longShift = spanMinutes >= 540;
  const maxPause = longShift ? 45 : 30;
  const requiredPause = Math.min(maxPause, spanMinutes - 360);
  const countedBreak = Math.min(recordedBreakMinutes, maxPause);
  const deduction = Math.max(requiredPause - countedBreak, 0);
  return Math.round(Math.max(workedMinutes - deduction, 0));
}

export function computeDelta(plannedMinutes: number, workedMinutes: number) {
  return workedMinutes - plannedMinutes;
}

