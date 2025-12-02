import { useState } from 'react';
import { useAttendanceReport } from '../hooks/useSettings';

function formatMonth(month: string) {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

export function AttendanceOverview() {
  const today = new Date();
  const initialMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState(initialMonth);
  const { data, isLoading } = useAttendanceReport(month);

  const changeMonth = (delta: number) => {
    const [year, m] = month.split('-').map((value) => Number(value));
    const target = new Date(year, m - 1 + delta, 1);
    setMonth(`${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="rounded-md bg-white p-4 shadow text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Anwesenheits- & Abwesenheitsübersicht</h3>
          <p className="text-xs text-slate-500">Vergleiche Stempelungen mit Urlaub, Krankheit und Remote-Tagen.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded border border-slate-200 px-2" onClick={() => changeMonth(-1)}>
            ←
          </button>
          <span className="text-sm font-semibold text-slate-800 min-w-[140px] text-center">{formatMonth(month)}</span>
          <button className="rounded border border-slate-200 px-2" onClick={() => changeMonth(1)}>
            →
          </button>
        </div>
      </div>
      {isLoading || !data ? (
        <p className="mt-4 text-slate-500">Lade Report...</p>
      ) : (
        <div className="mt-4 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="py-2 text-left">Mitarbeiter</th>
                <th className="py-2 text-right">Anwesende Tage</th>
                <th className="py-2 text-right">Urlaub</th>
                <th className="py-2 text-right">Krank</th>
                <th className="py-2 text-right">Remote</th>
                <th className="py-2 text-right">Sonstiges</th>
                <th className="py-2 text-right">Resturlaub</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.user_id}>
                  <td className="py-2 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-2 text-right">{row.presenceDays}</td>
                  <td className="py-2 text-right text-emerald-700">{row.vacationDays.toFixed(1)}</td>
                  <td className="py-2 text-right text-rose-600">{row.sickDays.toFixed(1)}</td>
                  <td className="py-2 text-right text-slate-600">{row.remoteDays.toFixed(1)}</td>
                  <td className="py-2 text-right text-slate-500">{row.otherAbsences.toFixed(1)}</td>
                  <td className="py-2 text-right font-semibold text-slate-900">{row.remainingVacation.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
