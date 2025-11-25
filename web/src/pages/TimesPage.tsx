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
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Monat</p>
          <h2 className="text-2xl font-semibold">{month}</h2>
          <p className="text-sm text-slate-500">Kompakte Kalenderansicht mit Statusfarben</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => goto(-1)}>← Vorheriger</button>
          <button className="btn-ghost" onClick={() => goto(1)}>Nächster →</button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Kalender</h3>
            <div className="flex gap-2 text-xs text-slate-600 items-center">
              <span className="h-2 w-2 rounded-full bg-slate-900"></span> korrekt
              <span className="h-2 w-2 rounded-full bg-rose-600"></span> offen/krank
              <span className="h-2 w-2 rounded-full bg-amber-500"></span> Urlaub
            </div>
          </div>
          {isLoading ? <p className="text-sm text-slate-500">Lade…</p> : <Calendar month={month} days={days} />}
        </div>
        <div className="card p-4 space-y-3">
          <h3 className="text-lg font-semibold">Monatsübersicht</h3>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs uppercase text-slate-500">Arbeitszeit</p>
              <p className="text-xl font-semibold">{totals.worked} Min</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs uppercase text-slate-500">Sollzeit</p>
              <p className="text-xl font-semibold">{totals.planned} Min</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 md:col-span-1 col-span-2">
              <p className="text-xs uppercase text-slate-500">Delta</p>
              <p className={`text-xl font-semibold ${totals.worked - totals.planned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totals.worked - totals.planned} Min
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm max-h-80 overflow-auto">
            {Object.entries(days).map(([date, summary]) => (
              <div key={date} className="flex justify-between border-b pb-1">
                <span className="font-medium">{date}</span>
                <span className={summary.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {summary.delta >= 0 ? '+' : ''}
                  {summary.delta}m
                </span>
              </div>
            ))}
            {Object.keys(days).length === 0 && <p className="text-slate-500 text-sm">Keine Daten für diesen Monat.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
