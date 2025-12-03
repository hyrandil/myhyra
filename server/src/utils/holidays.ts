import { addDays, calculateEaster } from './time';

export type Holiday = { date: string; name: string; duration: 'full' | 'half' };

const stateExtras: Record<string, { fixed?: string[]; easterOffset?: { days: number; name: string }[] }> = {
  BW: { fixed: ['01-06'], easterOffset: [{ days: 60, name: 'Fronleichnam' }] },
  BY: { fixed: ['01-06', '08-15'], easterOffset: [{ days: 60, name: 'Fronleichnam' }] },
  BE: { fixed: [], easterOffset: [] },
  BB: { fixed: ['10-31'], easterOffset: [] },
  HB: { fixed: [], easterOffset: [] },
  HH: { fixed: [], easterOffset: [] },
  HE: { fixed: [], easterOffset: [{ days: 60, name: 'Fronleichnam' }] },
  MV: { fixed: ['10-31'], easterOffset: [] },
  NI: { fixed: ['10-31'], easterOffset: [] },
  NW: { fixed: [], easterOffset: [{ days: 60, name: 'Fronleichnam' }] },
  RP: { fixed: [], easterOffset: [{ days: 60, name: 'Fronleichnam' }] },
  SL: { fixed: ['08-15'], easterOffset: [{ days: 60, name: 'Fronleichnam' }] },
  SN: { fixed: ['11-16'], easterOffset: [] },
  ST: { fixed: ['01-06', '10-31'], easterOffset: [] },
  SH: { fixed: [], easterOffset: [] },
  TH: { fixed: ['10-31'], easterOffset: [] },
};

const germanFixed = [
  { date: '01-01', name: 'Neujahr' },
  { date: '05-01', name: 'Tag der Arbeit' },
  { date: '10-03', name: 'Tag der Deutschen Einheit' },
  { date: '12-25', name: '1. Weihnachtsfeiertag' },
  { date: '12-26', name: '2. Weihnachtsfeiertag' },
];

export function buildHolidayList(state: string, year: number): Holiday[] {
  const easterSunday = calculateEaster(year);
  const easterBased = [
    { days: -2, name: 'Karfreitag' },
    { days: 1, name: 'Ostermontag' },
    { days: 39, name: 'Christi Himmelfahrt' },
    { days: 50, name: 'Pfingstmontag' },
  ];
  const extras = stateExtras[state] ?? { fixed: [], easterOffset: [] };

  const holidays: Holiday[] = [];

  germanFixed.forEach((item) => {
    holidays.push({
      name: item.name,
      date: `${year}-${item.date}`,
      duration: 'full',
    });
  });

  extras.fixed?.forEach((date) => {
    holidays.push({ name: 'Landesfeiertag', date: `${year}-${date}`, duration: 'full' });
  });

  [...easterBased, ...(extras.easterOffset ?? [])].forEach((offset) => {
    const target = addDays(easterSunday, offset.days);
    holidays.push({
      name: offset.name,
      date: target.toISOString().slice(0, 10),
      duration: 'full',
    });
  });

  return holidays;
}
