import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar } from '../components/Calendar';
import {
  createAbsenceForUser,
  createManualTimeEntry,
  deleteAbsenceForUser,
  fetchAbsenceKinds,
  fetchDaily,
  fetchDailyForUser,
  fetchDayEntriesForUser,
  fetchEmployees,
  fetchUserFlex,
  fetchVacationOverview,
  updateTimeEntry,
  deleteTimeEntry,
  updateUserFlex,
  updateUserVacationAdjustment,
  fetchAuditLogs,
} from '../api';
import { useAuth } from '../AuthProvider';
import { AbsenceKind, DailySummary, DayDetail, Employee, TimeEntry, VacationOverviewItem } from '../types';
import { useIsMobile } from '../hooks/useIsMobile';

export function TimesPage() {
  const { user, hasRole } = useAuth();
  const isMobile = useIsMobile();
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
  const [absenceStartTime, setAbsenceStartTime] = useState('');
  const [absenceEndTime, setAbsenceEndTime] = useState('');
  const [absenceType, setAbsenceType] = useState('');
  const [absenceDuration, setAbsenceDuration] = useState<'full' | 'half' | 'hours'>('full');
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);

  const formatDateGerman = (value?: string | null) => {
    if (!value) return '';
    const d = new Date(`${value}T00:00:00Z`);
    return d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' });
  };

  const monthLabel = useMemo(() => {
    const base = new Date(`${month}-01T00:00:00Z`);
    return base.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' });
  }, [month]);

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
    hasRole('admin', 'hr', 'lead') ? user?.id ?? null : user?.id ?? null
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

  const formatLocalTime = (value: string) => {
    if (!value) return '';
    const match = value.replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2})/);
    if (match) {
      return `${match[2]}:${match[3]}`;
    }
    const date = new Date(value);
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const parseLogDetail = (detail?: string | null) => {
    if (!detail) return null;
    try {
      return JSON.parse(detail) as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  const { data: employees } = useQuery({
    queryKey: ['employees', 'all'],
    queryFn: () => fetchEmployees(),
    enabled: enableManagement,
  });

  const { data: absenceKindsData } = useQuery<AbsenceKind[]>({
    queryKey: ['absence', 'kinds'],
    queryFn: fetchAbsenceKinds,
  });
  const defaultAbsenceKinds: AbsenceKind[] = [
    { code: 'vacation', label: 'Urlaub', counts_as_work: true, allow_full: true, allow_half: true },
    { code: 'sick', label: 'Krank', counts_as_work: true, allow_full: true, allow_half: true },
    { code: 'remote', label: 'Remote', counts_as_work: true, allow_full: true, allow_half: true },
    { code: 'other', label: 'Nicht im Haus', counts_as_work: false, allow_full: true, allow_half: true },
  ];
  const absenceOptions = absenceKindsData && absenceKindsData.length > 0 ? absenceKindsData : defaultAbsenceKinds;

  useEffect(() => {
    if (enableManagement && employees && employees.length > 0 && !targetUser && user?.id) {
      setTargetUser(user.id);
    }
  }, [enableManagement, employees, targetUser, user?.id]);

  useEffect(() => {
    if (!absenceType && absenceOptions.length > 0) {
      setAbsenceType(absenceOptions[0]!.code);
    }
  }, [absenceOptions, absenceType]);

  const selectedKind = absenceOptions.find((k) => k.code === absenceType);

  useEffect(() => {
    if (!selectedKind) return;
    if (!selectedKind.allow_full && absenceDuration === 'full') {
      setAbsenceDuration(selectedKind.allow_half ? 'half' : selectedKind.allow_hourly ? 'hours' : 'full');
    }
    if (!selectedKind.allow_half && absenceDuration === 'half') {
      setAbsenceDuration(selectedKind.allow_hourly ? 'hours' : 'full');
    }
    if (absenceDuration === 'hours' && !selectedKind.allow_hourly) {
      setAbsenceDuration(selectedKind.allow_full ? 'full' : 'half');
    }
  }, [selectedKind, absenceDuration]);

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
  const dayDetail = useQuery<DayDetail>({
    queryKey: ['dayEntries', selectedUserId, selectedDate],
    queryFn: () => fetchDayEntriesForUser(selectedUserId!, selectedDate!),
    enabled: enableManagement && Boolean(selectedUserId && selectedDate),
  });

  const flexInfo = useQuery({
    queryKey: ['flex', selectedUserId],
    queryFn: () => fetchUserFlex(selectedUserId!),
    enabled: Boolean(selectedUserId && hasRole('admin')),
  });

  const flexHistory = useQuery({
    queryKey: ['flex-history', selectedUserId],
    queryFn: () => fetchAuditLogs({ userId: selectedUserId!, q: 'flex.adjust' }),
    enabled: Boolean(selectedUserId && hasRole('admin')),
  });

  const vacationHistory = useQuery({
    queryKey: ['vacation-history', selectedUserId],
    queryFn: () => fetchAuditLogs({ userId: selectedUserId!, q: 'vacation.adjust' }),
    enabled: Boolean(selectedUserId && hasRole('admin')),
  });

  const [flexAdjustmentHours, setFlexAdjustmentHours] = useState('');
  const [vacationAdjustmentDays, setVacationAdjustmentDays] = useState('');

  const adjustFlexMutation = useMutation({
    mutationFn: (payload: { userId: number; adjustmentMinutes: number; enabled: boolean }) =>
      updateUserFlex(payload.userId, { enabled: payload.enabled, adjustment: payload.adjustmentMinutes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flex', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
    },
  });

  const adjustVacationMutation = useMutation({
    mutationFn: (payload: { userId: number; delta: number }) =>
      updateUserVacationAdjustment(payload.userId, { delta: payload.delta }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacation-overview'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-history', selectedUserId] });
    },
  });

  const requestAbsence = useMemo(() => {
    return dayDetail.data?.absences?.find((a) => a.source === 'request');
  }, [dayDetail.data]);

  const hasManualAbsence = useMemo(() => {
    return (dayDetail.data?.absences ?? []).some((a) => a.source !== 'request');
  }, [dayDetail.data]);

  const requestBlocksAbsence = requestAbsence?.duration === 'full';
  const requestHalfDay = requestAbsence?.duration === 'half';
  const absenceFormDisabled = Boolean(requestBlocksAbsence);

  useEffect(() => {
    if (requestHalfDay && absenceDuration !== 'half') {
      setAbsenceDuration('half');
    }
  }, [absenceDuration, requestHalfDay]);

  const isSelfSelection = selectedUserId === user?.id;

  const timeline = useMemo(
    () => {
      if (!dayDetail.data) return [] as Array<{ kind: 'entry'; entry: TimeEntry } | { kind: 'auto'; minutes: number }>;
      const items: Array<{ kind: 'entry'; entry: TimeEntry } | { kind: 'auto'; minutes: number }> = dayDetail.data.entries.map(
        (entry) => ({ kind: 'entry', entry })
      );
      if (dayDetail.data.autoBreakMinutes && dayDetail.data.autoBreakMinutes > 0) {
        items.push({ kind: 'auto', minutes: dayDetail.data.autoBreakMinutes });
      }
      return items;
    },
    [dayDetail.data]
  );

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
        acc.flex += d.flex; // sum of day deltas (fallback if flexBalance missing)
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

  const absenceLegend = [
    ...absenceOptions,
    { code: 'holiday', label: 'Feiertag', counts_as_work: true },
  ];

  const { data: vacationOverview } = useQuery<VacationOverviewItem[]>({
    queryKey: ['vacation-overview'],
    queryFn: fetchVacationOverview,
  });

  const selectedVacation = useMemo(() => {
    if (!vacationOverview) return null;
    const target = selectedUserId ?? user?.id ?? null;
    if (!target) return null;
    const entry = vacationOverview.find((item: VacationOverviewItem) => item.userId === target);
    if (entry) return entry;
    return {
      userId: target,
      name: '',
      email: '',
      allowance: 0,
      used: 0,
      planned: 0,
      remaining: 0,
    };
  }, [selectedUserId, user?.id, vacationOverview]);

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
      type: 'CLOCK_IN' | 'CLOCK_OUT';
      location?: { lat?: number; lng?: number };
    }) => createManualTimeEntry(selectedUserId!, { timestamp, type, location }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-overview'] });
      queryClient.invalidateQueries({ queryKey: ['dayEntries', selectedUserId, selectedDate] });
    },
  });

  const manualAbsence = useMutation({
    mutationFn: ({
      start_date,
      end_date,
      type,
      duration,
      start_time,
      end_time,
    }: { start_date: string; end_date: string; type: string; duration: 'full' | 'half' | 'hours'; start_time?: string; end_time?: string }) =>
      createAbsenceForUser(selectedUserId!, {
        start_date,
        end_date,
        type,
        duration: duration === 'hours' ? 'full' : duration,
        ...(start_time && end_time ? { start_time, end_time } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily', month, selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['vacation-overview'] });
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
    mutationFn: ({ entryId, timestamp, type }: { entryId: number; timestamp: string; type: 'CLOCK_IN' | 'CLOCK_OUT' }) =>
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
      timestamp: String(form.get('timestamp') || manualTimestamp),
      type: (form.get('type') as 'CLOCK_IN' | 'CLOCK_OUT') ?? 'CLOCK_IN',
    });
    e.currentTarget.reset();
    if (selectedDate) setManualTimestamp(`${selectedDate}T09:00`);
  };

  const onManualAbsence = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedUserId || !absenceType) return;
    if (requestBlocksAbsence) return;
    const payload: any = {
      start_date: absenceStart,
      end_date: absenceEnd,
      type: absenceType,
      duration: requestHalfDay ? 'half' : absenceDuration,
    };
    if (absenceDuration === 'hours') {
      payload.start_time = absenceStartTime;
      payload.end_time = absenceEndTime;
    }
    manualAbsence.mutate(payload);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Monat</p>
          <h2 className="text-2xl font-semibold">{monthLabel}</h2>
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
                {user && (
                  <option value={user.id}>{user.name} (Ich)</option>
                )}
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

      <div className="grid gap-5 items-start xl:grid-cols-[2.4fr,1fr] w-full">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Kalender</h3>
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
                absenceKinds={absenceLegend}
                compactStatus={isMobile}
                hideStatusMessages={isMobile}
              />
            )}
          </div>

          {enableManagement && selectedDate && (
            <div className="card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Buchungen am {formatDateGerman(selectedDate)}</h3>
                  <p className="text-sm text-slate-500">Einzelne Stempel bearbeiten oder löschen.</p>
                </div>
                {dayDetail.isFetching && <span className="text-xs text-slate-500">Aktualisiere…</span>}
              </div>
              {dayDetail.data?.inconsistent ? (
                <div className="p-2 rounded bg-amber-100 text-amber-800 text-sm">Inkonsistente Buchung erkannt (mehrfache Kommen/Gehen in Folge).</div>
              ) : null}
              {requestAbsence ? (
                <div className="p-2 rounded bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  Diese Abwesenheit stammt aus einem Antrag und kann hier nicht manuell entfernt werden.
                  {requestHalfDay
                    ? ' Für den freien Halbtag sind nur ergänzende Halbtags-Einträge möglich.'
                    : ' Bitte einen Stornierungsantrag stellen.'}
                </div>
              ) : null}
              {timeline.length ? (
                <div className="space-y-2">
                  {timeline.map((item, idx) => {
                    if (item.kind === 'auto') {
                      return (
                        <div
                          key={`auto-${idx}`}
                          className="border border-dashed border-slate-300 rounded-lg p-3 text-sm bg-slate-50"
                        >
                          Automatische Pause (−{item.minutes} Minuten) wurde zwischen den Buchungen berücksichtigt.
                        </div>
                      );
                    }
                    const entry = item.entry;
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
                              {formatLocalTime(entry.timestamp)} – {labels[entry.type]}
                            </p>
                            <p className="text-xs text-slate-500">Quelle: {entry.source}</p>
                            {mapUrl && canEditTarget && (
                              <a className="text-xs text-sky-600 hover:underline" href={mapUrl} target="_blank" rel="noreferrer">
                                Standort öffnen (Google Maps)
                              </a>
                            )}
                          </div>
                          {canEditTarget ? (
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
                          ) : (
                            <span className="text-xs text-slate-500">Nur Leserechte</span>
                          )}
                        </div>
                        {isEditing ? (
                          <form
                            className="grid md:grid-cols-3 gap-2 text-sm"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const data = new FormData(e.currentTarget);
                              const ts = String(data.get('timestamp'));
                              updateEntryMutation.mutate({
                                entryId: entry.id,
                                timestamp: ts,
                                type: (data.get('type') as 'CLOCK_IN' | 'CLOCK_OUT') ?? 'CLOCK_IN',
                              });
                              setEditingEntryId(null);
                            }}
                          >
                            <div>
                              <label className="text-xs text-slate-500">Zeitpunkt</label>
                              <input
                                name="timestamp"
                                type="datetime-local"
                                defaultValue={local}
                                className="input w-full"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">Typ</label>
                              <select
                                name="type"
                                defaultValue={entry.type === 'CLOCK_IN' ? 'CLOCK_IN' : 'CLOCK_OUT'}
                                className="input w-full"
                              >
                                <option value="CLOCK_IN">Kommen</option>
                                <option value="CLOCK_OUT">Gehen</option>
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
                  Abwesenheiten: {dayDetail.data.absences.map((a: any) => a.label || a.note || a.type).join(', ')}
                  {dayDetail.data.pending ? ' (Antrag offen)' : ''}
                </p>
              ) : null}
            </div>
          )}

          {enableManagement && canEditTarget && (
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Zeitnachtrag</h3>
                </div>
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
                  </select>
                  <button className="btn-primary" type="submit" disabled={manualTime.isPending}>
                    Speichern
                  </button>
                </form>
              </div>

              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Abwesenheit eintragen</h3>
                </div>
                <>
                  <form
                    className={`space-y-2 ${absenceFormDisabled ? 'opacity-60 pointer-events-none' : ''}`}
                    onSubmit={onManualAbsence}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm text-slate-600">Von</label>
                        <input
                          name="start_date"
                          type="date"
                          className="input"
                          required
                          value={absenceStart}
                          onChange={(e) => setAbsenceStart(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-600">Bis</label>
                        <input
                          name="end_date"
                          type="date"
                          className="input"
                          required
                          value={absenceEnd}
                          onChange={(e) => setAbsenceEnd(e.target.value)}
                        />
                      </div>
                    </div>
                    <label className="block text-sm text-slate-600">Art</label>
                    <select
                      name="type"
                      className="input w-full"
                      value={absenceType}
                      onChange={(e) => setAbsenceType(e.target.value)}
                    >
                      {absenceOptions.map((kind) => (
                        <option key={kind.code} value={kind.code}>
                          {kind.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-3 items-center text-sm">
                      <label className="text-slate-600">Umfang</label>
                      <label className="flex items-center gap-1 text-slate-700">
                        <input
                          type="radio"
                          name="duration"
                          value="full"
                          checked={absenceDuration === 'full'}
                          disabled={absenceFormDisabled || requestHalfDay || (selectedKind ? selectedKind.allow_full === false : false)}
                          onChange={() => setAbsenceDuration('full')}
                        />{' '}
                        Ganzer Tag
                      </label>
                      <label className="flex items-center gap-1 text-slate-700">
                        <input
                          type="radio"
                          name="duration"
                          value="half"
                          checked={absenceDuration === 'half'}
                          disabled={absenceFormDisabled || (selectedKind ? selectedKind.allow_half === false : false)}
                          onChange={() => setAbsenceDuration('half')}
                        />{' '}
                        Halber Tag
                      </label>
                      {selectedKind?.allow_hourly && (
                        <label className="flex items-center gap-1 text-slate-700">
                          <input
                            type="radio"
                            name="duration"
                            value="hours"
                            checked={absenceDuration === 'hours'}
                            disabled={absenceFormDisabled || requestHalfDay}
                            onChange={() => setAbsenceDuration('hours')}
                          />{' '}
                          Stundenweise
                        </label>
                      )}
                    </div>
                    {absenceDuration === 'hours' && (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          name="start_time"
                          type="time"
                          required
                          className="input"
                          value={absenceStartTime}
                          onChange={(e) => setAbsenceStartTime(e.target.value)}
                        />
                        <input
                          name="end_time"
                          type="time"
                          required
                          className="input"
                          value={absenceEndTime}
                          onChange={(e) => setAbsenceEndTime(e.target.value)}
                        />
                      </div>
                    )}
                    <button className="btn-primary" type="submit" disabled={manualAbsence.isPending || absenceFormDisabled}>
                      Eintragen
                    </button>
                  </form>
                  {requestAbsence && requestBlocksAbsence && (
                    <p className="text-xs text-slate-600">
                      Dieser Tag ist über einen Antrag gebucht. Bitte nutzen Sie einen Stornierungsantrag, um Änderungen
                      vorzunehmen.
                    </p>
                  )}
                  {requestAbsence && requestHalfDay && (
                    <p className="text-xs text-slate-600">
                      Es ist bereits ein halber Tag über einen Antrag gebucht. Für den zweiten Halbtag können Sie nur
                      Halbtags-Einträge ergänzen.
                    </p>
                  )}
                  {days[selectedDate ?? '']?.absences?.length ? (
                    <div className="space-y-1">
                      <button
                        className="text-sm text-rose-700 border border-rose-200 bg-rose-50 rounded-md px-3 py-2 font-semibold disabled:opacity-60"
                        type="button"
                        onClick={() => {
                          if (!selectedDate || !selectedUserId) return;
                          deleteAbsence.mutate({ start_date: selectedDate, end_date: selectedDate });
                        }}
                        disabled={deleteAbsence.isPending || !hasManualAbsence}
                      >
                        Abwesenheit am ausgewählten Tag löschen
                      </button>
                      {requestAbsence && (
                        <p className="text-xs text-slate-600">
                          Antrag-basierte Einträge bleiben bestehen; nur manuelle Abwesenheiten werden entfernt.
                        </p>
                      )}
                    </div>
                  ) : null}
                </>
              </div>
            </div>
          )}
          </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Monatsübersicht</h3>
              {selectedDate && <p className="text-sm text-slate-500">Ausgewählt: {formatDateGerman(selectedDate)}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs uppercase text-slate-500">Arbeitszeit</p>
                <p className="text-xl font-semibold">{formatHours(totals.worked)}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs uppercase text-slate-500">Sollzeit</p>
                <p className="text-xl font-semibold">{formatHours(totals.planned)}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 col-span-2">
                <p className="text-xs uppercase text-slate-500">Gleitzeit</p>
                <p className={`text-xl font-semibold ${flexBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatHours(flexBalance)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Urlaubsübersicht</h3>
            </div>
            {selectedVacation ? (
              <div className="space-y-2 text-sm">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs uppercase text-slate-500">Kontingent</p>
                  <p className="text-xl font-semibold">{selectedVacation.allowance.toFixed(2)} Tage</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs uppercase text-slate-500">Genommen</p>
                  <p className="text-xl font-semibold">{selectedVacation.used.toFixed(2)} Tage</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs uppercase text-slate-500">Geplant</p>
                  <p className="text-xl font-semibold">{selectedVacation.planned.toFixed(2)} Tage</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs uppercase text-slate-500">Verbleibend</p>
                  <p className="text-xl font-semibold text-emerald-700">{selectedVacation.remaining.toFixed(2)} Tage</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Noch keine Urlaubsdaten verfügbar.</p>
            )}
          </div>

          {hasRole('admin') && selectedUserId && (
            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Gleitzeit anpassen</h3>
                <p className="text-sm text-slate-500">Nur Administratoren können Gleitzeitwerte manuell ändern.</p>
              </div>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedUserId) return;
                  const delta = Number(flexAdjustmentHours);
                  if (Number.isNaN(delta)) return;
                  const current = flexInfo.data?.adjustment ?? 0;
                  const enabled = flexInfo.data?.enabled ?? true;
                  adjustFlexMutation.mutate({
                    userId: selectedUserId,
                    adjustmentMinutes: current + Math.round(delta * 60),
                    enabled,
                  });
                  setFlexAdjustmentHours('');
                }}
              >
                <div className="text-sm text-slate-600">
                  Aktueller Stand: {formatHours(flexInfo.data?.balanceMinutes ?? 0)}
                </div>
                <label className="text-sm text-slate-600">Stunden hinzufügen/abziehen</label>
                <input
                  type="number"
                  step="0.25"
                  className="input"
                  placeholder="z. B. 1,5 oder -0,5"
                  value={flexAdjustmentHours}
                  onChange={(e) => setFlexAdjustmentHours(e.target.value)}
                />
                <button className="btn-primary" type="submit" disabled={adjustFlexMutation.isPending}>
                  Gleitzeit anpassen
                </button>
              </form>
              <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Historie anzeigen
                </summary>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {(flexHistory.data ?? []).length === 0 && <p>Keine Einträge vorhanden.</p>}
                  {(flexHistory.data ?? []).map((entry) => {
                    const detail = parseLogDetail(entry.detail);
                    const previous = typeof detail?.previous === 'number' ? detail.previous : null;
                    const next = typeof detail?.next === 'number' ? detail.next : null;
                    const enabled = typeof detail?.enabled === 'boolean' ? detail.enabled : null;
                    return (
                      <div key={entry.id} className="flex flex-col gap-1 rounded-md bg-white p-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{new Date(entry.created_at).toLocaleString('de-DE')}</span>
                          <span>{entry.actor_name ?? 'System'}</span>
                        </div>
                        <div className="text-sm text-slate-700">
                          {previous !== null && next !== null && (
                            <span>
                              Anpassung: {formatHours(previous)} → {formatHours(next)}
                            </span>
                          )}
                          {enabled !== null && (
                            <span className="ml-2 text-xs text-slate-500">
                              ({enabled ? 'aktiviert' : 'deaktiviert'})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}

          {hasRole('admin') && selectedUserId && (
            <div className="card p-4 space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Urlaubstage anpassen</h3>
                <p className="text-sm text-slate-500">
                  Änderungen wirken auf den verfügbaren Resturlaub (inkl. Übertrag aus dem Vorjahr).
                </p>
              </div>
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!selectedUserId) return;
                  const delta = Number(vacationAdjustmentDays);
                  if (Number.isNaN(delta)) return;
                  adjustVacationMutation.mutate({ userId: selectedUserId, delta });
                  setVacationAdjustmentDays('');
                }}
              >
                <div className="text-sm text-slate-600">
                  Aktueller Stand: {selectedVacation ? selectedVacation.remaining.toFixed(2) : '0.00'} Tage
                </div>
                <label className="text-sm text-slate-600">Tage hinzufügen/abziehen</label>
                <input
                  type="number"
                  step="0.5"
                  className="input"
                  placeholder="z. B. 2 oder -1"
                  value={vacationAdjustmentDays}
                  onChange={(e) => setVacationAdjustmentDays(e.target.value)}
                />
                <button className="btn-primary" type="submit" disabled={adjustVacationMutation.isPending}>
                  Urlaubstage anpassen
                </button>
              </form>
              <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Historie anzeigen
                </summary>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  {(vacationHistory.data ?? []).length === 0 && <p>Keine Einträge vorhanden.</p>}
                  {(vacationHistory.data ?? []).map((entry) => {
                    const detail = parseLogDetail(entry.detail);
                    const previous = typeof detail?.previous === 'number' ? detail.previous : null;
                    const delta = typeof detail?.delta === 'number' ? detail.delta : null;
                    const next = typeof detail?.next === 'number' ? detail.next : null;
                    return (
                      <div key={entry.id} className="flex flex-col gap-1 rounded-md bg-white p-2">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{new Date(entry.created_at).toLocaleString('de-DE')}</span>
                          <span>{entry.actor_name ?? 'System'}</span>
                        </div>
                        <div className="text-sm text-slate-700">
                          {previous !== null && next !== null && (
                            <span>
                              Anpassung: {previous.toFixed(2)} → {next.toFixed(2)} Tage
                            </span>
                          )}
                          {delta !== null && (
                            <span className="ml-2 text-xs text-slate-500">
                              (Δ {delta >= 0 ? '+' : ''}
                              {delta.toFixed(2)} Tage)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
