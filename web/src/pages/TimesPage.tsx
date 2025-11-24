import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDaily } from '../api';
import { Calendar } from '../components/Calendar';

export function TimesPage() {
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const { data, isLoading } = useQuery({ queryKey: ['daily', month], queryFn: () => fetchDaily(month) });
  const days = data?.days ?? {};

  const totals = useMemo(() => {
    return Object.values(days).reduce(
      (acc, d) => {
        acc.worked += d.worked;
        acc.planned += d.planned;
        return acc;
      },
      { worked: 0, planned: 0 }
    );
  }, [days]);

  const goto = (delta: number) => {
    const base = new Date(`${month}-01T00:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + delta);
    setMonth(`${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Monat</p>
          <h2 className="text-xl font-semibold">{month}</h2>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1 border rounded" onClick={() => goto(-1)}>←</button>
          <button className="px-3 py-1 border rounded" onClick={() => goto(1)}>→</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 bg-white shadow rounded p-4">
          <h3 className="text-lg font-semibold mb-3">Kalender</h3>
          {isLoading ? <p className="text-sm text-slate-500">Lade…</p> : <Calendar month={month} days={days} />}
        </div>
        <div className="bg-white shadow rounded p-4">
          <h3 className="text-lg font-semibold mb-3">Summen</h3>
          <p className="text-sm">Arbeitszeit: {totals.worked} Min</p>
          <p className="text-sm">Sollzeit: {totals.planned} Min</p>
          <p className={`text-sm ${totals.worked - totals.planned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            Delta: {totals.worked - totals.planned} Min
          </p>
          <div className="mt-3 space-y-2 text-sm">
            {Object.entries(days).map(([date, summary]) => (
              <div key={date} className="flex justify-between border-b pb-1">
                <span>{date}</span>
                <span className={summary.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {summary.delta >= 0 ? '+' : ''}{summary.delta}m
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
