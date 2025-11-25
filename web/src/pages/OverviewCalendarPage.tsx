import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar } from '../components/Calendar';
import { fetchDaily, fetchDailyForUser, fetchDailyOverview, fetchEmployees } from '../api';
import { useAuth } from '../AuthProvider';
import { DailySummary, Employee } from '../types';

function transformDays(days: Record<string, DailySummary>): Record<string, DailySummary> {
  const next: Record<string, DailySummary> = {};
  Object.entries(days).forEach(([key, summary]) => {
    const hasVacation = summary.absences.some((a) => a.toLowerCase().includes('urlaub'));
    const hasAnyAbsence = summary.absences.length > 0;
    next[key] = {
      ...summary,
      absences: hasVacation ? ['Urlaub'] : hasAnyAbsence ? ['Nicht im Haus'] : [],
      status: hasVacation ? 'vacation' : hasAnyAbsence ? 'away' : summary.status,
    };
  });
  return next;
}

export function OverviewCalendarPage() {
  const auth = useAuth();
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const enableManagement = auth.hasRole('lead', 'hr', 'admin');

  const { data: employees } = useQuery({
    queryKey: ['employees', 'overview'],
    queryFn: () => fetchEmployees(),
    enabled: enableManagement,
  });

  const visibleEmployees: Employee[] = useMemo(() => {
    if (!enableManagement && auth.user) return [{ ...auth.user, active: true } as Employee];
    const list = employees ?? [];
    if (!departmentFilter) return list;
    return list.filter((e) => (e.department || '').toLowerCase().includes(departmentFilter.toLowerCase()));
  }, [auth.user, departmentFilter, enableManagement, employees]);

  useEffect(() => {
    if (enableManagement && visibleEmployees.length > 0 && !selectedUser) {
      setSelectedUser(visibleEmployees[0].id);
    }
  }, [enableManagement, selectedUser, visibleEmployees]);

  const { data, isLoading } = useQuery<{ month: string; days: Record<string, DailySummary> }>({
    queryKey: ['overview', month, selectedUser, departmentFilter, enableManagement ? 'managed' : 'self'],
    queryFn: () => {
      if (!enableManagement) {
        return fetchDailyOverview(month, departmentFilter || undefined);
      }
      if (selectedUser && selectedUser !== auth.user?.id) {
        return fetchDailyForUser(selectedUser, month);
      }
      return fetchDaily(month);
    },
    enabled: enableManagement ? Boolean(selectedUser) : true,
  });

  const transformed = useMemo(() => {
    if (enableManagement) return data?.days ?? {};
    return transformDays(data?.days ?? {});
  }, [data?.days, enableManagement]);

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

      {enableManagement ? (
        <div className="card p-4 grid gap-3 md:grid-cols-3 items-end">
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm text-slate-600">Mitarbeiter</label>
            <select
              className="input"
              value={selectedUser ?? ''}
              onChange={(e) => setSelectedUser(Number(e.target.value))}
            >
              {(visibleEmployees ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.personnelNumber || emp.email})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-600">Abteilung filtern</label>
            <input
              className="input"
              placeholder="z.B. Vertrieb"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="card p-4 grid gap-3 md:grid-cols-3 items-end">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm text-slate-600">Ansicht</label>
            <select
              className="input"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="">Alle Mitarbeitenden</option>
              {auth.user?.department && <option value={auth.user.department}>Abteilung: {auth.user.department}</option>}
            </select>
          </div>
          <p className="text-sm text-slate-500">
            Urlaubsübersicht ohne Details. Andere Abwesenheiten erscheinen gesammelt als "Nicht im Haus".
          </p>
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Kalender</h3>
          <div className="flex gap-3 text-xs text-slate-600 items-center">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500"></span> Urlaub
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-500"></span> Nicht im Haus
            </span>
          </div>
        </div>
        {isLoading || (!enableManagement && !data) || (enableManagement && !selectedUser) ? (
          <p className="text-sm text-slate-500">Lade…</p>
        ) : (
          <Calendar month={month} days={transformed} maskAbsences={!enableManagement} hideDetails={!enableManagement} />
        )}
      </div>
    </div>
  );
}
