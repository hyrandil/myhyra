import { TimeEntry } from '../types';

const MS_IN_MINUTE = 60000;

function parseTimestamp(ts: string) {
  const [datePart, timePartRaw] = ts.replace('T', ' ').split(' ');
  if (!datePart) return 0;
  const [year, month, day] = datePart.split('-').map((v) => Number(v));
  const [hour, minute, second] = (timePartRaw ?? '00:00:00').split(':').map((v) => Number(v));
  return Date.UTC(year || 0, (month || 1) - 1, day || 1, hour || 0, minute || 0, Number.isFinite(second) ? second : 0);
}

export function computeDayWorkStats(entries: TimeEntry[]) {
  const sorted = [...entries].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  let currentIn: number | null = null;
  let workMs = 0;
  let breakMs = 0;
  let firstIn: number | null = null;
  let lastOut: number | null = null;

  sorted.forEach((entry) => {
    const ts = parseTimestamp(entry.timestamp);
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
  const workedMinutesRaw = workMs / MS_IN_MINUTE;
  const recordedBreakMinutes = breakMs / MS_IN_MINUTE;

  const baseRequirement = Math.min(Math.max(workedMinutesRaw - 360, 0), 30);
  const longRequirement = Math.min(Math.max(workedMinutesRaw - 540, 0), 15);
  const requiredPause = baseRequirement + longRequirement;
  const autoDeduction = Math.max(requiredPause - recordedBreakMinutes, 0);
  const effective = Math.max(workedMinutesRaw - autoDeduction, 0);

  return {
    workedMinutes: Math.round(effective),
    autoDeduction: Math.round(autoDeduction),
    recordedBreakMinutes: Math.round(recordedBreakMinutes),
    spanMinutes: Math.round(spanMinutes),
  };
}

export function computeDayWorkMinutes(entries: TimeEntry[]) {
  return computeDayWorkStats(entries).workedMinutes;
}

export function computeDelta(plannedMinutes: number, workedMinutes: number) {
  return workedMinutes - plannedMinutes;
}

