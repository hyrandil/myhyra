import { useMemo } from 'react';
import { useMyAbsences, useMyVacationSummary } from '../hooks/useSettings';

export function VacationSummaryCard() {
  const { data: summary, isLoading } = useMyVacationSummary();
  const { data: absences } = useMyAbsences();
  const upcoming = useMemo(() => {
    if (!absences) {
      return [];
    }
    const today = new Date().toISOString().slice(0, 10);
    return absences
      .filter((absence) => (absence.days?.[0] ?? absence.start_date) >= today)
      .slice(0, 5);
  }, [absences]);

  const progress = summary && summary.allowance > 0 ? Math.min(summary.used / summary.allowance, 1) : 0;

  return (
    <div className="rounded-md bg-white p-6 shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Urlaub & Abwesenheiten</p>
          <h3 className="text-xl font-semibold text-slate-900">Persönlicher Überblick</h3>
        </div>
        {summary && (
          <div className="text-right">
            <p className="text-sm text-slate-500">Verfügbar</p>
            <p className="text-lg font-semibold text-slate-900">{summary.remaining.toFixed(1)} Tage</p>
          </div>
        )}
      </div>
      {isLoading || !summary ? (
        <p className="mt-4 text-sm text-slate-500">Berechne Urlaubsstand...</p>
      ) : (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Verbraucht</span>
              <span>
                {summary.used.toFixed(1)} / {summary.allowance.toFixed(1)} Tage
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${progress * 100}%` }}
              ></div>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <p className="text-xs uppercase tracking-wide text-slate-500">Bevorstehende Abwesenheiten</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Keine geplanten Einträge.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {upcoming.map((absence) => (
                  <li key={absence.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {absence.start_date === absence.end_date
                          ? new Date(absence.start_date).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })
                          : `${new Date(absence.start_date).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })} – ${new Date(absence.end_date).toLocaleDateString('de-DE', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}`}
                      </p>
                      <p className="text-xs uppercase text-slate-500">{absence.type === 'vacation' ? 'Urlaub' : absence.type}</p>
                    </div>
                    <span className="text-xs rounded-full border border-slate-200 px-2 py-0.5">
                      {absence.duration === 'half' ? '½ Tag' : '1 Tag'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
