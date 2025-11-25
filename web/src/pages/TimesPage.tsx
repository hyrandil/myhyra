import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from '../components/Calendar';
import {
  createAbsenceForUser,
  createManualTimeEntry,
  fetchDaily,
  fetchDailyForUser,
  fetchEmployees,
} from '../api';
import { useAuth } from '../AuthProvider';
import { DailySummary, Employee } from '../types';

export function TimesPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [targetUser, setTargetUser] = useState<number | null>(() =>
    hasRole('admin', 'hr', 'lead') ? null : user?.id ?? null
  );
  const enableManagement = hasRole('admin', 'hr', 'lead');

  const formatHours = (minutes: number) => {
    const sign = minutes < 0 ? '-' : '';
    const abs = Math.abs(minutes);
    const hrs = Math.floor(abs / 60);
    const mins = abs % 60;
    return `${sign}${hrs}h ${String(mins).padStart(2, '0')}m`;
  };

  const { data: employees } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => fetchEmployees(),
    enabled: enableManagement,
  });

  useEffect(() => {
    if (enableManagement && employees && employees.length > 0 && !targetUser) {
      const firstOther = employees.find((emp) => emp.id !== user?.id) ?? employees[0];
      setTargetUser(firstOther.id);
    }
  }, [enableManagement, employees, targetUser, user?.id]);

  const { data, isLoading } = useQuery<{ month: string; days: Record<string, DailySummary> }>({
    queryKey: ['daily', month, targetUser, enableManagement ? 'manager' : 'self'],
    queryFn: () => {
      if (enableManagement && targetUser && targetUser !== user?.id) {
        return fetchDailyForUser(targetUser, month);
      }
      return fetchDaily(month);
    },
    enabled: Boolean(targetUser),
  });
  const days = data?.days ?? {};

  const canEditTarget = useMemo(() => {
    if (!enableManagement || !targetUser) return false;
    if (hasRole('admin', 'hr')) return true;
    return targetUser !== user?.id;
  }, [enableManagement, hasRole, targetUser, user?.id]);

  const totals = useMemo(() => {
    return Object.values(days).reduce<{ worked: number; planned: number }>(
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

  const manualTime = useMutation({
    mutationFn: ({
      timestamp,
      type,
      location,
    }: {
      timestamp: string;
      type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
      location?: { lat?: number; lng?: number };
    }) => createManualTimeEntry(targetUser!, { timestamp, type, location }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'daily' && q.queryKey.includes(targetUser),
      }),
  });

  const manualAbsence = useMutation({
    mutationFn: ({ start_date, end_date, type, duration }: { start_date: string; end_date: string; type: string; duration: 'full' | 'half' }) =>
      createAbsenceForUser(targetUser!, { start_date, end_date, type, duration }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'daily' && q.queryKey.includes(targetUser),
      }),
  });

  const onManualTime = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetUser) return;
    const form = new FormData(e.currentTarget);
    manualTime.mutate({
      timestamp: `${form.get('timestamp')}`,
      type: form.get('type') as any,
      location: {
        lat: form.get('lat') ? Number(form.get('lat')) : undefined,
        lng: form.get('lng') ? Number(form.get('lng')) : undefined,
      },
    });
    e.currentTarget.reset();
  };

  const onManualAbsence = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetUser) return;
    const form = new FormData(e.currentTarget);
    manualAbsence.mutate({
      start_date: String(form.get('start_date')),
      end_date: String(form.get('end_date')),
      type: String(form.get('type')),
      duration: (form.get('duration') as 'full' | 'half') ?? 'full',
    });
    e.currentTarget.reset();
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

      {enableManagement && (
        <div className="card p-4 space-y-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase text-slate-500">Ziel</p>
              <h3 className="text-lg font-semibold">Kalender &amp; Zeiten</h3>
            </div>
            <div className="flex gap-2 items-center">
              <label className="text-sm text-slate-600">Mitarbeiter:</label>
              <select
                className="input"
                value={targetUser ?? ''}
                onChange={(e) => setTargetUser(Number(e.target.value))}
              >
                {(employees as Employee[] | undefined)?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.personnelNumber || emp.email})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

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
          <h3 className="text-lg font-semibold">Monatsübersicht (ausgewählter Mitarbeitender)</h3>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs uppercase text-slate-500">Arbeitszeit</p>
              <p className="text-xl font-semibold">{formatHours(totals.worked)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs uppercase text-slate-500">Sollzeit</p>
              <p className="text-xl font-semibold">{formatHours(totals.planned)}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 md:col-span-1 col-span-2">
              <p className="text-xs uppercase text-slate-500">Delta</p>
              <p
                className={`text-xl font-semibold ${
                  totals.worked - totals.planned >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatHours(totals.worked - totals.planned)}
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Werte beziehen sich ausschließlich auf den ausgewählten Mitarbeitenden und werden automatisch neu geladen,
            sobald eine andere Person gewählt wird.
          </p>
        </div>
      </div>

      {enableManagement && canEditTarget && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card p-4 space-y-3">
            <h3 className="text-lg font-semibold">Zeitnachtrag</h3>
            <form className="space-y-2" onSubmit={onManualTime}>
              <label className="block text-sm text-slate-600">Zeitpunkt</label>
              <input name="timestamp" type="datetime-local" required className="input w-full" />
              <label className="block text-sm text-slate-600">Typ</label>
              <select name="type" className="input w-full">
                <option value="CLOCK_IN">Kommen</option>
                <option value="CLOCK_OUT">Gehen</option>
                <option value="BREAK_START">Pause starten</option>
                <option value="BREAK_END">Pause beenden</option>
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="lat" className="input" placeholder="Lat (optional)" />
                <input name="lng" className="input" placeholder="Lng (optional)" />
              </div>
              <button className="btn-primary" type="submit" disabled={manualTime.isPending}>
                Speichern
              </button>
            </form>
          </div>

          <div className="card p-4 space-y-3">
            <h3 className="text-lg font-semibold">Abwesenheit eintragen</h3>
            <form className="space-y-2" onSubmit={onManualAbsence}>
              <div className="grid grid-cols-2 gap-2">
                <input name="start_date" type="date" required className="input" />
                <input name="end_date" type="date" required className="input" />
              </div>
              <select name="type" className="input w-full">
                <option value="vacation">Urlaub</option>
                <option value="sick">Krank</option>
                <option value="remote">Remote</option>
                <option value="other">Sonstige</option>
              </select>
              <div className="flex gap-3 items-center text-sm">
                <label className="text-slate-600">Umfang</label>
                <label className="flex items-center gap-1 text-slate-700">
                  <input type="radio" name="duration" value="full" defaultChecked /> Ganzer Tag
                </label>
                <label className="flex items-center gap-1 text-slate-700">
                  <input type="radio" name="duration" value="half" /> Halber Tag
                </label>
              </div>
              <button className="btn-primary" type="submit" disabled={manualAbsence.isPending}>
                Eintragen
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
