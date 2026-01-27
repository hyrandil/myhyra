import type { Booking } from '../types';

export interface DaySummary {
  workMinutes: number;
  breakMinutes: number;
}

export interface DayBucket {
  dateKey: string;
  displayDate: Date;
  bookings: Booking[];
  summary: DaySummary;
}

export interface CalendarDay {
  key: string;
  date: Date;
  isCurrentMonth: boolean;
}

export function formatMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.max(totalMinutes % 60, 0);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function getDateKey(date: Date) {
  return date.toLocaleDateString('sv-SE');
}

export function getDateKeyFromISO(isoString: string) {
  return getDateKey(new Date(isoString));
}

export function calculateDaySummary(bookings: Booking[]): DaySummary {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
  );
  let workMs = 0;
  let firstIn: number | null = null;
  let lastOut: number | null = null;
  let breakMs = 0;
  let previousOut: number | null = null;
  for (const booking of sorted) {
    const clockIn = new Date(booking.clock_in).getTime();
    if (Number.isNaN(clockIn)) continue;
    if (firstIn === null) {
      firstIn = clockIn;
    }
    if (previousOut !== null) {
      const gap = clockIn - previousOut;
      if (gap > 0) {
        breakMs += gap;
      }
    }
    if (booking.clock_out) {
      const clockOut = new Date(booking.clock_out).getTime();
      if (!Number.isNaN(clockOut) && clockOut > clockIn) {
        workMs += clockOut - clockIn;
        lastOut = lastOut ? Math.max(lastOut, clockOut) : clockOut;
        previousOut = clockOut;
      }
    }
  }
  const span = firstIn !== null && lastOut !== null ? Math.max(lastOut - firstIn, 0) : 0;
  const spanMinutes = span / 60000;
  if (spanMinutes <= 360) {
    return {
      workMinutes: Math.round(workMs / 60000),
      breakMinutes: Math.round(breakMs / 60000),
    };
  }

  const breakMinutes = breakMs / 60000;
  const requiredPause = Math.min(30, spanMinutes - 360);
  const countedBreak = breakMinutes >= 30 ? requiredPause : breakMinutes;
  const autoDeduction = Math.max(requiredPause - countedBreak, 0);
  const adjustedWork = Math.max(workMs / 60000 - autoDeduction, 0);

  return {
    workMinutes: Math.round(adjustedWork),
    breakMinutes: Math.round(breakMinutes),
  };
}

export function groupBookingsByDay(bookings: Booking[]) {
  const buckets: Record<string, DayBucket> = {};
  for (const booking of bookings) {
    const key = getDateKeyFromISO(booking.clock_in);
    if (!buckets[key]) {
      const dayDate = new Date(booking.clock_in);
      buckets[key] = {
        dateKey: key,
        displayDate: new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()),
        bookings: [],
        summary: { workMinutes: 0, breakMinutes: 0 },
      };
    }
    buckets[key].bookings.push(booking);
  }
  for (const bucket of Object.values(buckets)) {
    bucket.bookings.sort(
      (a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()
    );
    bucket.summary = calculateDaySummary(bucket.bookings);
  }
  return buckets;
}

export function buildCalendarDays(currentMonth: Date): CalendarDay[] {
  const firstOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const mondayIndex = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(firstOfMonth);
  start.setDate(firstOfMonth.getDate() - mondayIndex);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: getDateKey(date),
      date,
      isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
    };
  });
}
