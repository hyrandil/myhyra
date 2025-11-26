import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from '../components/Calendar';
import { fetchDailyOverview, fetchPublicDepartments } from '../api';
import { DailySummary } from '../types';

function transformDays(days: Record<string, DailySummary>): Record<string, DailySummary> {
  const next: Record<string, DailySummary> = {};
  Object.entries(days).forEach(([key, summary]) => {
    const hasHoliday = summary.absences.some((a) => a.toLowerCase().includes('feiertag'));
    const hasVacation = summary.absences.some((a) => a.toLowerCase().includes('urlaub'));
    const hasAnyAbsence = summary.absences.length > 0;
    next[key] = {
      ...summary,
      absences: hasHoliday ? ['Feiertag'] : hasVacation ? ['Urlaub'] : hasAnyAbsence ? ['Nicht im Haus'] : [],
      status: hasHoliday ? 'holiday' : hasVacation ? 'vacation' : hasAnyAbsence ? 'away' : summary.status,
    };
  });
  return next;
}

export function OverviewCalendarPage() {
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [departmentFilter, setDepartmentFilter] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments', 'public'],
    queryFn: fetchPublicDepartments,
  });

  const { data, isLoading } = useQuery<{ month: string; days: Record<string, DailySummary> }>({
    queryKey: ['overview', month, departmentFilter],
    queryFn: () => fetchDailyOverview(month, departmentFilter || undefined),
    enabled: true,
  });

  const transformed = useMemo(() => {
    return transformDays(data?.days ?? {});
  }, [data?.days]);

  const goto = (delta: number) => {
    const base = new Date(`${month}-01T00:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + delta);
    setMonth(`${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Abteilungsübersicht</p>
          <h2 className="text-2xl font-semibold">Urlaubskalender</h2>
          <p className="text-sm text-slate-500">Zeigt geplante Urlaube, alle anderen Abwesenheiten als "Nicht im Haus".</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => goto(-1)}>← Vorheriger</button>
          <button className="btn-ghost" onClick={() => goto(1)}>Nächster →</button>
        </div>
      </div>

      <div className="card p-4 grid gap-3 md:grid-cols-3 items-end">
        <div className="space-y-2">
          <label className="text-sm text-slate-600">Abteilung</label>
          <select
            className="input"
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">Alle Mitarbeitenden</option>
            {(departments ?? []).map((dept) => (
              <option key={dept.id} value={String(dept.id)}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-slate-500 md:col-span-2">
          Auswahl nach Abteilungen oder alle Mitarbeitenden. Tage lassen sich anklicken, um zu sehen, wer abwesend ist.
        </p>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Kalender</h3>
          <div className="flex gap-3 text-xs text-slate-600 items-center">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500"></span> Feiertag
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span> Urlaub
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-500"></span> Nicht im Haus
            </span>
          </div>
        </div>
        {isLoading || !data ? (
          <p className="text-sm text-slate-500">Lade…</p>
        ) : (
          <Calendar month={month} days={transformed} maskAbsences={false} hideDetails={false} absencesOnly />
        )}
      </div>
    </div>
  );
}
