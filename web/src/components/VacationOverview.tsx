import { useVacationSummary } from '../hooks/useSettings';

export function VacationOverview() {
  const { data, isLoading } = useVacationSummary();

  return (
    <div className="rounded-md bg-white p-4 shadow text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Gesamturlaubsübersicht</h3>
          <p className="text-xs text-slate-500">Verfügbare Kontingente im Vergleich zu bereits gebuchten Tagen.</p>
        </div>
        <span className="text-xs rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Admin</span>
      </div>
      {isLoading || !data ? (
        <p className="mt-4 text-slate-500">Berechne Urlaubsstände...</p>
      ) : (
        <div className="mt-4 overflow-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead>
              <tr className="text-xs uppercase text-slate-500">
                <th className="py-2 text-left">Mitarbeiter</th>
                <th className="py-2 text-left">E-Mail</th>
                <th className="py-2 text-right">Kontingent</th>
                <th className="py-2 text-right">Genutzt</th>
                <th className="py-2 text-right">Rest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.user_id}>
                  <td className="py-2 font-semibold text-slate-900">{row.name}</td>
                  <td className="py-2 text-slate-500">{row.email}</td>
                  <td className="py-2 text-right">{row.allowance.toFixed(1)} Tage</td>
                  <td className="py-2 text-right text-rose-600">{row.used.toFixed(1)} Tage</td>
                  <td className="py-2 text-right font-semibold text-emerald-600">{row.remaining.toFixed(1)} Tage</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
