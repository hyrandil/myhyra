import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from '../components/Calendar';
import {
  createAbsenceForUser,
  createManualTimeEntry,
  deleteAbsenceForUser,
  fetchDaily,
  fetchDailyForUser,
  fetchDayEntriesForUser,
  fetchEmployees,
  updateTimeEntry,
  deleteTimeEntry,
} from '../api';
import { useAuth } from '../AuthProvider';
import { DailySummary, Employee, TimeEntry } from '../types';

export function TimesPage() {
  const { user, hasRole } = useAuth();
  const labels: Record<TimeEntry['type'], string> = {
    CLOCK_IN: 'Kommen',
    CLOCK_OUT: 'Gehen',
    BREAK_START: 'Pause starten',
    BREAK_END: 'Pause beenden',
  };
  const queryClient = useQueryClient();
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [manualTimestamp, setManualTimestamp] = useState('');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedDate) {
      const today = new Date();
      const key = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(
        today.getUTCDate()
      ).padStart(2, '0')}`;
      setSelectedDate(key);
      setManualTimestamp(`${key}T09:00`);
    }
  }, [selectedDate]);
  const [targetUser, setTargetUser] = useState<number | null>(() =>
    hasRole('admin', 'hr', 'lead') ? null : user?.id ?? null
  );
  const selectedUserId = targetUser ?? user?.id ?? null;
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

  const { data, isLoading } = useQuery<{ month: string; days: Record<string, DailySummary>; flexBalance?: number }>({
    queryKey: ['daily', month, selectedUserId, enableManagement ? 'manager' : 'self'],
    queryFn: () => {
      if (enableManagement && selectedUserId && selectedUserId !== user?.id) {
        return fetchDailyForUser(selectedUserId, month);
      }
      return fetchDaily(month);
    },
    enabled: Boolean(selectedUserId),
  });
  const days = data?.days ?? {};
  const dayDetail = useQuery({
    queryKey: ['dayEntries', selectedUserId, selectedDate],
    queryFn: () => fetchDayEntriesForUser(selectedUserId!, selectedDate!),
    enabled: enableManagement && Boolean(selectedUserId && selectedDate),
  });

  const canEditTarget = useMemo(() => {
    if (!enableManagement || !selectedUserId) return false;
    if (hasRole('admin', 'hr')) return true;
    return selectedUserId !== user?.id;
  }, [enableManagement, hasRole, selectedUserId, user?.id]);

  const totals = useMemo(() => {
    return Object.values(days).reduce<{ worked: number; planned: number; flex: number }>(
      (acc, d) => {
        acc.worked += d.worked;
        acc.planned += d.planned;
        acc.flex = d.flex; // latest value is month-to-date balance
        return acc;
      },
      { worked: 0, planned: 0, flex: 0 }
    );
  }, [days]);
  const flexBalance = data?.flexBalance ?? totals.flex;

  const goto = (delta: number) => {
    const base = new Date(`${month}-01T00:00:00Z`);
    base.setUTCMonth(base.getUTCMonth() + delta);
    setMonth(`${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`);
    setSelectedDate(null);
  };

  useEffect(() => {
    if (selectedDate) {
      setManualTimestamp(`${selectedDate}T09:00`);
      setAbsenceStart(selectedDate);
      setAbsenceEnd(selectedDate);
    }
  }, [selectedDate]);

  const manualTime = useMutation({
    mutationFn: ({
      timestamp,
      type,
      location,
    }: {
      timestamp: string;
      type: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END';
      location?: { lat?: number; lng?: number };
    }) => createManualTimeEntry(selectedUserId!, { timestamp, type, location }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['dayEntries', selectedUserId, selectedDate] });
    },
  });

  const manualAbsence = useMutation({
    mutationFn: ({ start_date, end_date, type, duration }: { start_date: string; end_date: string; type: string; duration: 'full' | 'half' }) =>
      createAbsenceForUser(selectedUserId!, { start_date, end_date, type, duration }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['dayEntries', selectedUserId, selectedDate] });
    },
  });

  const deleteAbsence = useMutation({
    mutationFn: ({ start_date, end_date }: { start_date: string; end_date: string }) =>
      deleteAbsenceForUser(selectedUserId!, start_date, end_date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['dayEntries', selectedUserId, selectedDate] });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, timestamp, type }: { entryId: number; timestamp: string; type: TimeEntry['type'] }) =>
      updateTimeEntry(entryId, { timestamp, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dayEntries', selectedUserId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => deleteTimeEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dayEntries', selectedUserId, selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
    },
  });

  const onManualTime = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUserId) return;
    const form = new FormData(e.currentTarget);
    manualTime.mutate({
      timestamp: `${form.get('timestamp') || manualTimestamp}${String(form.get('timestamp') || manualTimestamp).toString().endsWith('Z') ? '' : 'Z'}`,
      type: form.get('type') as any,
      location: {
        lat: form.get('lat') ? Number(form.get('lat')) : undefined,
        lng: form.get('lng') ? Number(form.get('lng')) : undefined,
      },
    });
    e.currentTarget.reset();
    if (selectedDate) setManualTimestamp(`${selectedDate}T09:00`);
  };

  const onManualAbsence = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUserId) return;
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
              <div className="flex gap-3 text-xs text-slate-600 items-center">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-900"></span> korrekt
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-600"></span> offen
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500"></span> Urlaub
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-500"></span> Nicht im Haus
                </span>
              </div>
            </div>
            {isLoading ? (
            <p className="text-sm text-slate-500">Lade…</p>
          ) : (
            <Calendar
              month={month}
              days={days}
              selectedDate={selectedDate}
              onSelect={(value) => {
                setSelectedDate(value);
                setManualTimestamp(`${value}T09:00`);
              }}
            />
          )}
        </div>
        {enableManagement && selectedDate && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Buchungen am {selectedDate}</h3>
                <p className="text-sm text-slate-500">Einzelne Stempel bearbeiten oder löschen.</p>
              </div>
              {dayDetail.isFetching && <span className="text-xs text-slate-500">Aktualisiere…</span>}
            </div>
            {dayDetail.data?.entries?.length ? (
              <div className="space-y-2">
                {dayDetail.data.entries.map((entry) => {
                  const local = entry.timestamp.replace('Z', '');
                  const mapUrl =
                    entry.lat && entry.lng
                      ? `https://www.google.com/maps?q=${entry.lat},${entry.lng}`
                      : null;
                  const isEditing = editingEntryId === entry.id;
                  return (
                    <div key={entry.id} className="border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="space-y-1">
                          <p className="font-semibold">
                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                            – {labels[entry.type]}
                          </p>
                          <p className="text-xs text-slate-500">Quelle: {entry.source}</p>
                          {mapUrl && (
                            <a className="text-xs text-sky-600 hover:underline" href={mapUrl} target="_blank" rel="noreferrer">
                              Standort öffnen (Google Maps)
                            </a>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <button
                            className="text-xs text-slate-700 underline"
                            onClick={() => setEditingEntryId(isEditing ? null : entry.id)}
                          >
                            {isEditing ? 'Abbrechen' : 'Ändern'}
                          </button>
                          <button
                            className="text-rose-600 text-xs"
                            onClick={() => deleteEntryMutation.mutate(entry.id)}
                            disabled={deleteEntryMutation.isPending}
                          >
                            Löschen
                          </button>
                        </div>
                      </div>
                      {isEditing ? (
                        <form
                          className="grid md:grid-cols-3 gap-2 text-sm"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const data = new FormData(e.currentTarget);
                            const ts = String(data.get('timestamp'));
                            const withZ = ts.endsWith('Z') ? ts : `${ts}Z`;
                            updateEntryMutation.mutate({
                              entryId: entry.id,
                              timestamp: withZ,
                              type: data.get('type') as TimeEntry['type'],
                            });
                            setEditingEntryId(null);
                          }}
                        >
                          <div>
                            <label className="text-xs text-slate-500">Zeitpunkt</label>
                            <input name="timestamp" type="datetime-local" defaultValue={local} className="input w-full" required />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Typ</label>
                            <select name="type" defaultValue={entry.type} className="input w-full">
                              <option value="CLOCK_IN">Kommen</option>
                              <option value="CLOCK_OUT">Gehen</option>
                              <option value="BREAK_START">Pause starten</option>
                              <option value="BREAK_END">Pause beenden</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button className="btn-primary w-full" type="submit" disabled={updateEntryMutation.isPending}>
                              Aktualisieren
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Keine Buchungen am ausgewählten Tag.</p>
            )}
            {dayDetail.data?.absences?.length ? (
              <p className="text-sm text-slate-600">
                Abwesenheiten: {dayDetail.data.absences.map((a: any) => a.type).join(', ')}
                {dayDetail.data.pending ? ' (Antrag offen)' : ''}
              </p>
            ) : null}
          </div>
        )}
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Monatsübersicht (Auswahl)</h3>
            {selectedDate && <p className="text-sm text-slate-500">Ausgewählt: {selectedDate}</p>}
          </div>
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
              <p className="text-xs uppercase text-slate-500">Gleitzeit</p>
              <p className={`text-xl font-semibold ${flexBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatHours(flexBalance)}
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
              <input
                name="timestamp"
                type="datetime-local"
                required
                className="input w-full"
                value={manualTimestamp}
                onChange={(e) => setManualTimestamp(e.target.value)}
              />
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
                <input
                  name="start_date"
                  type="date"
                  required
                  className="input"
                  value={absenceStart}
                  onChange={(e) => setAbsenceStart(e.target.value)}
                />
                <input
                  name="end_date"
                  type="date"
                  required
                  className="input"
                  value={absenceEnd}
                  onChange={(e) => setAbsenceEnd(e.target.value)}
                />
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
            {days[selectedDate ?? '']?.absences?.length ? (
              <button
                className="btn-ghost text-sm text-rose-600"
                type="button"
                onClick={() => {
                  if (!selectedDate || !selectedUserId) return;
                  deleteAbsence.mutate({ start_date: selectedDate, end_date: selectedDate });
                }}
                disabled={deleteAbsence.isPending}
              >
                Abwesenheit am ausgewählten Tag löschen
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
