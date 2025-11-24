import { useQuery } from '@tanstack/react-query';
import { fetchAttendance } from '../api';

export function ReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['reports', 'attendance'], queryFn: () => fetchAttendance() });

  return (
    <div className="bg-white shadow rounded p-4">
      <h2 className="font-semibold mb-2">Berichte</h2>
      {isLoading && <p className="text-sm text-slate-500">Lade…</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            <th>Name</th>
            <th>Präsenz</th>
            <th>Urlaubstage</th>
            <th>Krank</th>
            <th>Remote</th>
            <th>Sonstige</th>
          </tr>
        </thead>
        <tbody>
          {(data?.rows ?? []).map((row) => (
            <tr key={row.user_id} className="border-t">
              <td>{row.name}</td>
              <td>{row.presenceDays}</td>
              <td>{row.vacationDays}</td>
              <td>{row.sickDays}</td>
              <td>{row.remoteDays}</td>
              <td>{row.otherAbsences}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
