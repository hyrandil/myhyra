import assert from 'assert';
import { computeDayWorkMinutes, computeDayWorkStats } from '../services/timeService';
import { TimeEntry } from '../types';

const sample = (overrides: Partial<TimeEntry>): TimeEntry => {
  const base: TimeEntry = {
    id: overrides.id ?? 0,
    user_id: overrides.user_id ?? 1,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    type: overrides.type ?? 'CLOCK_IN',
    source: overrides.source ?? 'WEB',
    lat: overrides.lat ?? null,
    lng: overrides.lng ?? null,
  };
  if (overrides.created_at) {
    base.created_at = overrides.created_at;
  }
  return base;
};

const straightShift: TimeEntry[] = [
  sample({ id: 1, timestamp: '2024-01-01T08:00:00Z', type: 'CLOCK_IN' }),
  sample({ id: 2, timestamp: '2024-01-01T16:30:00Z', type: 'CLOCK_OUT' }),
];

assert.equal(computeDayWorkMinutes(straightShift), 480, '8.5h Schicht bucht 30min Pause automatisch');

const withBreak: TimeEntry[] = [
  sample({ id: 1, timestamp: '2024-01-01T08:00:00Z', type: 'CLOCK_IN' }),
  sample({ id: 2, timestamp: '2024-01-01T12:00:00Z', type: 'BREAK_START' }),
  sample({ id: 3, timestamp: '2024-01-01T12:45:00Z', type: 'BREAK_END' }),
  sample({ id: 4, timestamp: '2024-01-01T16:00:00Z', type: 'CLOCK_OUT' }),
];

assert.equal(computeDayWorkMinutes(withBreak), 435, 'Echte Pause mindert die automatische Anrechnung');

const longShift: TimeEntry[] = [
  sample({ id: 1, timestamp: '2024-01-01T08:00:00Z', type: 'CLOCK_IN' }),
  sample({ id: 2, timestamp: '2024-01-01T18:00:00Z', type: 'CLOCK_OUT' }),
];

assert.equal(computeDayWorkMinutes(longShift), 555, '10h Schicht zieht 45min automatisch ab');

const stats = computeDayWorkStats(straightShift);
assert.equal(stats.autoDeduction, 30, 'Automatische Pause wird transparent ausgewiesen');

const splitShift: TimeEntry[] = [
  sample({ id: 1, timestamp: '2024-01-02T08:00:00Z', type: 'CLOCK_IN' }),
  sample({ id: 2, timestamp: '2024-01-02T12:00:00Z', type: 'CLOCK_OUT' }),
  sample({ id: 3, timestamp: '2024-01-02T13:00:00Z', type: 'CLOCK_IN' }),
  sample({ id: 4, timestamp: '2024-01-02T17:00:00Z', type: 'CLOCK_OUT' }),
];

assert.equal(computeDayWorkMinutes(splitShift), 480, 'Unterbrechungen >=45min erfüllen die Pausenpflicht');

console.log('timeService tests passed');
