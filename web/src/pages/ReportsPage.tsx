import { useQuery } from '@tanstack/react-query';
import { fetchAttendance } from '../api';

export function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['reports', 'attendance'], queryFn: () => fetchAttendance() });

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Reports</p>
          <h2 className="text-2xl font-semibold">Anwesenheits- & Urlaubsstatistik</h2>
          <p className="text-sm text-slate-500">Gefiltert wie in timeCard 10 – kompakte Tabelle</p>
        </div>
      </div>

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
    </div>
  );
}
