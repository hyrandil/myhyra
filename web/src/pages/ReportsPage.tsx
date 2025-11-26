import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadAttendanceCsv, downloadAttendanceXlsx, fetchAttendance } from '../api';

export function ReportsPage() {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const { data, isLoading } = useQuery({
    queryKey: ['reports', 'attendance', month],
    queryFn: () => fetchAttendance(month),
  });

  const maxPresence = useMemo(() => {
    return Math.max(...((data?.rows ?? []).map((r) => r.presenceDays) || [1]));
  }, [data]);

  const triggerDownload = async (kind: 'csv' | 'xlsx') => {
    const blob = kind === 'csv' ? await downloadAttendanceCsv(month) : await downloadAttendanceXlsx(month);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${month}.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Reports</p>
          <h2 className="text-2xl font-semibold">Anwesenheits- &amp; Urlaubsstatistik</h2>
          <p className="text-sm text-slate-500">Zeitraum wählbar, Export als CSV/Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-slate-600">Monat:</label>
          <input
            type="month"
            className="input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button className="btn-ghost" onClick={() => triggerDownload('csv')}>CSV Export</button>
          <button className="btn-primary" onClick={() => triggerDownload('xlsx')}>Excel Export</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          {isLoading && <p className="text-sm text-slate-500">Lade…</p>}
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Name</th>
                  <th>Präsenz</th>
                  <th>Urlaubstage</th>
                  <th>Krank</th>
                  <th>Remote</th>
                  <th>Sonstige</th>
                  <th>Resturlaub</th>
                </tr>
              </thead>
              <tbody>
                {(data?.rows ?? []).map((row) => (
                  <tr key={row.user_id} className="border-b hover:bg-slate-50">
                    <td className="py-2 font-medium">{row.name}</td>
                    <td>{row.presenceDays}</td>
                    <td>{row.vacationDays}</td>
                    <td>{row.sickDays}</td>
                    <td>{row.remoteDays}</td>
                    <td>{row.otherAbsences}</td>
                    <td>{row.remainingVacation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data?.rows ?? []).length === 0 && <p className="text-sm text-slate-500 mt-2">Keine Daten vorhanden.</p>}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="text-lg font-semibold">Visualisierung</h3>
          <p className="text-sm text-slate-500">Vergleich Präsenz- und Abwesenheitstage.</p>
          <div className="space-y-2">
            {(data?.rows ?? []).map((row) => {
              const presenceWidth = maxPresence ? Math.round((row.presenceDays / maxPresence) * 100) : 0;
              const vacationWidth = Math.min(100, Math.round(row.vacationDays * 4));
              return (
                <div key={row.user_id} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{row.name}</span>
                    <span>{row.presenceDays} Tage</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-2 bg-emerald-500" style={{ width: `${presenceWidth}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Urlaub: {row.vacationDays}</span>
                    <span>Krank: {row.sickDays}</span>
                    <span>Remote: {row.remoteDays}</span>
                  </div>
                  <div className="h-2 rounded-full bg-amber-100 overflow-hidden">
                    <div className="h-2 bg-amber-500" style={{ width: `${vacationWidth}%` }}></div>
                  </div>
                </div>
              );
            })}
            {(data?.rows ?? []).length === 0 && <p className="text-sm text-slate-500">Keine Daten vorhanden.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
