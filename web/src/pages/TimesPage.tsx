import { useQuery } from '@tanstack/react-query';
import { fetchDaily } from '../api';

export function TimesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['daily'], queryFn: () => fetchDaily() });
  const days = data?.days ?? {};

  return (
    <div className="bg-white shadow rounded p-4">
      <h2 className="text-lg font-semibold mb-3">Monatsübersicht</h2>
      {isLoading && <p className="text-sm text-slate-500">Lade…</p>}
      <div className="grid grid-cols-1 gap-2">
        {Object.entries(days).map(([date, summary]) => (
          <div key={date} className="flex justify-between border-b pb-1 text-sm">
            <div>
              <p className="font-medium">{date}</p>
              {summary.absences.length > 0 && (
                <p className="text-xs text-amber-600">Abwesenheit: {summary.absences.join(', ')}</p>
              )}
            </div>
            <div className="text-right">
              <p>{summary.worked} / {summary.planned} Min</p>
              <p className={summary.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                Δ {summary.delta} Min
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
