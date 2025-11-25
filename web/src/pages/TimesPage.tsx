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
import { Employee } from '../types';

export function TimesPage() {
  const { user, hasRole } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [targetUser, setTargetUser] = useState<number | null>(user?.id ?? null);
  const enableManagement = hasRole('admin', 'hr', 'lead');

  const { data: employees } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => fetchEmployees(),
    enabled: enableManagement,
  });

  useEffect(() => {
    if (enableManagement && employees && employees.length > 0 && !targetUser) {
      setTargetUser(employees[0].id);
    }
  }, [enableManagement, employees, targetUser]);

  const { data, isLoading } = useQuery({
    queryKey: ['daily', month, targetUser],
    queryFn: () => {
      if (enableManagement && targetUser && targetUser !== user?.id) {
        return fetchDailyForUser(targetUser, month);
      }
      return fetchDaily(month);
    },
    enabled: Boolean(targetUser),
  });
  const days = data?.days ?? {};

  const totals = useMemo(() => {
    return Object.values(days).reduce(
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily', month, targetUser] }),
  });

  const manualAbsence = useMutation({
    mutationFn: ({ start_date, end_date, type, duration }: { start_date: string; end_date: string; type: string; duration: 'full' | 'half' }) =>
      createAbsenceForUser(targetUser!, { start_date, end_date, type, duration }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['daily', month, targetUser] }),
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
          <h3 className="text-lg font-semibold">Monatsübersicht</h3>
          <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs uppercase text-slate-500">Arbeitszeit</p>
              <p className="text-xl font-semibold">{totals.worked} Min</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xs uppercase text-slate-500">Sollzeit</p>
              <p className="text-xl font-semibold">{totals.planned} Min</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 md:col-span-1 col-span-2">
              <p className="text-xs uppercase text-slate-500">Delta</p>
              <p className={`text-xl font-semibold ${totals.worked - totals.planned >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {totals.worked - totals.planned} Min
              </p>
            </div>
          </div>
          <div className="space-y-2 text-sm max-h-80 overflow-auto">
            {Object.entries(days).map(([date, summary]) => (
              <div key={date} className="flex justify-between border-b pb-1">
                <span className="font-medium">{date}</span>
                <span className={summary.delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {summary.delta >= 0 ? '+' : ''}
                  {summary.delta}m
                </span>
              </div>
            ))}
            {Object.keys(days).length === 0 && <p className="text-slate-500 text-sm">Keine Daten für diesen Monat.</p>}
          </div>
        </div>
      </div>

      {enableManagement && (
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
