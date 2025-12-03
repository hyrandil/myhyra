import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createAbsenceRequest,
  fetchAbsenceKinds,
  fetchMyAbsenceRequests,
  requestAbsenceCancellation,
  createTimeCorrectionRequest,
  fetchMyCorrections,
  fetchDayEntriesForUser,
} from '../api';
import { useAuth } from '../AuthProvider';
import { AbsenceRequest, TimeCorrectionRequest, DayDetail } from '../types';

export type RequestView = 'hub' | 'absence' | 'correction' | 'storno';

export function RequestsPage({ view = 'hub' }: { view?: RequestView }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [correctionRows, setCorrectionRows] = useState<
    { time: string; type: 'CLOCK_IN' | 'CLOCK_OUT'; action?: 'add' | 'delete' | 'replace'; entryId?: number | null }[]
  >([{ time: '', type: 'CLOCK_IN', action: 'add' }]);
  const [correctionDate, setCorrectionDate] = useState('');

  const refreshCalendars = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0]);
        return key === 'absence' || key === 'time' || key === 'overview' || key === 'reports';
      },
    });
  };

  const kinds = useQuery({ queryKey: ['absence', 'kinds'], queryFn: fetchAbsenceKinds });
  const myRequests = useQuery({ queryKey: ['absence', 'mine'], queryFn: fetchMyAbsenceRequests });
  const myCorrections = useQuery({ queryKey: ['corrections', 'mine'], queryFn: fetchMyCorrections });
  const dayEntries = useQuery<DayDetail | undefined>({
    queryKey: ['corrections', 'day', correctionDate, auth.user?.id],
    enabled: Boolean(correctionDate && auth.user?.id),
    queryFn: () => fetchDayEntriesForUser(auth.user!.id, correctionDate!),
  });

  const createMutation = useMutation({
    mutationFn: createAbsenceRequest,
    onSuccess: () => refreshCalendars(),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => requestAbsenceCancellation(id, reason),
    onSuccess: () => refreshCalendars(),
  });

  const correctionCreate = useMutation({
    mutationFn: createTimeCorrectionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corrections'] });
      refreshCalendars();
    },
  });

  const handleRequestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      start_date: String(form.get('start_date')),
      end_date: String(form.get('end_date')),
      type: String(form.get('type')),
      comment: String(form.get('comment') || ''),
    });
    e.currentTarget.reset();
  };

  const handleCancelSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const id = Number(form.get('request_id'));
    if (!Number.isFinite(id)) return;
    cancelMutation.mutate({ id, reason: String(form.get('reason') || '') });
    e.currentTarget.reset();
  };

  const handleCorrectionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const date = String(form.get('date'));
    const entries = correctionRows
      .filter((row) => row.time || row.action === 'delete')
      .map((row) => ({
        timestamp: `${date}T${row.time || '00:00'}`,
        type: row.type,
        action: row.action ?? 'add',
        entry_id: row.entryId ?? undefined,
      }));
    correctionCreate.mutate({ date, note: String(form.get('note') || ''), entries });
    e.currentTarget.reset();
    setCorrectionRows([{ time: '', type: 'CLOCK_IN', action: 'add' }]);
    setCorrectionDate('');
  };

  const cancelable = (myRequests.data ?? []).filter(
    (req) => req.status === 'approved' && !req.cancel_requested && !req.canceled
  );

  const statusMeta = (status: AbsenceRequest['status'] | TimeCorrectionRequest['status']) => {
    switch (status) {
      case 'approved':
        return { label: 'Genehmigt', className: 'badge bg-emerald-100 text-emerald-700' };
      case 'rejected':
        return { label: 'Abgelehnt', className: 'badge bg-rose-100 text-rose-700' };
      case 'canceled':
        return { label: 'Storniert', className: 'badge bg-slate-200 text-slate-700' };
      default:
        return { label: 'Offen', className: 'badge bg-amber-100 text-amber-700' };
    }
  };

  if (view === 'hub') {
    return (
      <div className="space-y-4">
        <div className="card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-slate-500">Anträge</p>
            <h2 className="text-2xl font-semibold">Wähle eine Antragsart</h2>
            <p className="text-sm text-slate-500">Schnellzugriff auf Abwesenheit, Korrektur oder Stornierung.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Link to="/antraege/abwesenheit" className="card p-4 hover:border-sky-200 hover:shadow">
            <p className="text-xs uppercase text-slate-500">Abwesenheit</p>
            <h3 className="text-lg font-semibold">Abwesenheitsantrag</h3>
            <p className="text-sm text-slate-600">Urlaub, Krank oder andere Abwesenheiten beantragen.</p>
          </Link>
          <Link to="/antraege/korrektur" className="card p-4 hover:border-sky-200 hover:shadow">
            <p className="text-xs uppercase text-slate-500">Zeiten</p>
            <h3 className="text-lg font-semibold">Korrekturantrag</h3>
            <p className="text-sm text-slate-600">Fehlende Kommen/Gehen-Buchungen nachreichen.</p>
          </Link>
          <Link to="/antraege/storno" className="card p-4 hover:border-sky-200 hover:shadow">
            <p className="text-xs uppercase text-slate-500">Stornierung</p>
            <h3 className="text-lg font-semibold">Stornierungsantrag</h3>
            <p className="text-sm text-slate-600">Genehmigte Abwesenheiten zurückziehen.</p>
          </Link>
          {auth.hasRole('lead', 'hr', 'admin') && (
            <Link to="/antraege/genehmigungen" className="card p-4 hover:border-sky-200 hover:shadow">
              <p className="text-xs uppercase text-slate-500">Genehmigung</p>
              <h3 className="text-lg font-semibold">Genehmigungsliste</h3>
              <p className="text-sm text-slate-600">Alle offenen Anträge gesammelt prüfen.</p>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const header = (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <p className="text-xs uppercase text-slate-500">Anträge</p>
        <h2 className="text-2xl font-semibold">
          {view === 'absence'
            ? 'Abwesenheitsanträge'
            : view === 'correction'
            ? 'Korrekturanträge'
            : 'Stornierungsanträge'}
        </h2>
        <p className="text-sm text-slate-500">Verwalte deine Vorgänge oder genehmige als Führungskraft.</p>
      </div>
      <Link to="/antraege" className="btn-ghost border border-slate-200">Zur Übersicht</Link>
    </div>
  );

  return (
    <div className="space-y-4">
      {header}

      {view === 'absence' && (
        <>
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Abwesenheitsantrag stellen</h3>
              <p className="text-xs text-slate-500">Für Mitarbeitende</p>
            </div>
            <form className="grid gap-3" onSubmit={handleRequestSubmit}>
              <div className="grid sm:grid-cols-2 gap-2">
                <label className="text-xs text-slate-500 uppercase">Von
                  <input type="date" name="start_date" required className="input" />
                </label>
                <label className="text-xs text-slate-500 uppercase">Bis
                  <input type="date" name="end_date" required className="input" />
                </label>
              </div>
              <select name="type" className="input" required>
                <option value="">Abwesenheitstyp</option>
                {(kinds.data ?? []).map((kind: any) => (
                  <option key={kind.code} value={kind.code}>
                    {kind.label}
                  </option>
                ))}
              </select>
              <textarea name="comment" className="input" placeholder="Kommentar (optional)" />
              <button className="btn-primary w-full" type="submit" disabled={createMutation.isPending}>
                Antrag stellen
              </button>
            </form>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold mb-2">Eigene Abwesenheitsanträge</h3>
            <div className="grid md:grid-cols-2 gap-3">
              {(myRequests.data ?? []).map((req) => (
                <div key={req.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{req.start_date} – {req.end_date}</p>
                    <span className={statusMeta(req.status).className}>{statusMeta(req.status).label}</span>
                  </div>
                  <p className="text-sm text-slate-600">{req.type}</p>
                  {req.cancel_requested && <p className="text-xs text-amber-600">Stornierung angefragt</p>}
                  {req.canceled && <p className="text-xs text-emerald-700">Storniert</p>}
                  {req.comment && <p className="text-xs text-slate-500">{req.comment}</p>}
                </div>
              ))}
              {(myRequests.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine Anträge vorhanden.</p>}
            </div>
            {auth.hasRole('lead', 'hr', 'admin') && (
              <p className="text-xs text-slate-500 mt-3">
                Genehmigungen findest du jetzt gebündelt in der <Link className="text-sky-700 underline" to="/antraege/genehmigungen">Genehmigungsliste</Link>.
              </p>
            )}
          </div>
        </>
      )}

      {view === 'storno' && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Stornierungsantrag</h3>
            <p className="text-xs text-slate-500">Genehmigte Abwesenheiten zurückziehen</p>
          </div>
          <form className="grid gap-3" onSubmit={handleCancelSubmit}>
            <select name="request_id" className="input" required>
              <option value="">Genehmigten Antrag auswählen</option>
              {cancelable.map((req) => (
                <option key={req.id} value={req.id}>
                  {req.start_date} – {req.end_date} ({req.type})
                </option>
              ))}
            </select>
            <textarea name="reason" className="input" placeholder="Begründung (optional)" />
            <button className="btn-primary" type="submit" disabled={cancelMutation.isPending}>
              Storno anfragen
            </button>
          </form>
          {cancelable.length === 0 && <p className="text-sm text-slate-500">Keine genehmigten Abwesenheiten verfügbar.</p>}
        </div>
      )}

      {view === 'correction' && (
        <>
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Korrekturantrag stellen</h3>
              <p className="text-xs text-slate-500">Arbeitszeit korrigieren</p>
            </div>
            <form className="grid gap-3" onSubmit={handleCorrectionSubmit}>
              <label className="text-xs text-slate-500 uppercase">Datum
                <input
                  type="date"
                  name="date"
                  required
                  className="input"
                  value={correctionDate}
                  onChange={(e) => setCorrectionDate(e.target.value)}
                />
              </label>
              <textarea name="note" className="input" placeholder="Kommentar (optional)" />
              {correctionDate && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Buchungen am {correctionDate}</p>
                    {dayEntries.isLoading && <span className="text-xs text-slate-500">Lade …</span>}
                  </div>
                  <div className="space-y-2">
                    {(dayEntries.data?.entries ?? [])
                      .filter((entry) => entry.type === 'CLOCK_IN' || entry.type === 'CLOCK_OUT')
                      .map((entry) => {
                        const time = new Date(entry.timestamp).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        });
                        const entryType = entry.type as 'CLOCK_IN' | 'CLOCK_OUT';
                        return (
                          <div
                            key={entry.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2"
                          >
                            <div>
                              <p className="font-medium">{entryType === 'CLOCK_IN' ? 'Kommen' : 'Gehen'} · {time}</p>
                              <p className="text-xs text-slate-500">Quelle: {entry.source ?? 'n/a'}</p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                className="btn-ghost border border-slate-200"
                                onClick={() =>
                                  setCorrectionRows((prev) => [
                                    ...prev,
                                    { time, type: entryType, action: 'replace', entryId: entry.id },
                                  ])
                                }
                                disabled={!correctionDate}
                              >
                                Zeit anpassen
                              </button>
                              <button
                                type="button"
                                className="btn-ghost border border-rose-200 text-rose-700"
                                onClick={() =>
                                  setCorrectionRows((prev) => [
                                    ...prev,
                                    { time, type: entryType, action: 'delete', entryId: entry.id },
                                  ])
                                }
                                disabled={!correctionDate}
                              >
                                Löschen
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {(dayEntries.data?.entries ?? []).length === 0 && (
                      <p className="text-xs text-slate-500">Keine Buchungen an diesem Tag gefunden.</p>
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {correctionRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                    <select
                      value={row.action ?? 'add'}
                      onChange={(e) =>
                        setCorrectionRows((prev) =>
                          prev.map((r, i) =>
                            i === idx
                              ? { ...r, action: e.target.value as 'add' | 'delete' | 'replace' }
                              : r
                          )
                        )
                      }
                      className="input"
                    >
                      <option value="add">Neu</option>
                      <option value="replace" disabled={!row.entryId}>
                        Ersetzen
                      </option>
                      <option value="delete" disabled={!row.entryId}>
                        Löschen
                      </option>
                    </select>
                    <select
                      value={row.type}
                      onChange={(e) =>
                        setCorrectionRows((prev) => prev.map((r, i) => (i === idx ? { ...r, type: e.target.value as any } : r)))
                      }
                      className="input"
                      disabled={row.action === 'delete'}
                    >
                      <option value="CLOCK_IN">Kommen</option>
                      <option value="CLOCK_OUT">Gehen</option>
                    </select>
                    <input
                      type="time"
                      value={row.time}
                      onChange={(e) =>
                        setCorrectionRows((prev) => prev.map((r, i) => (i === idx ? { ...r, time: e.target.value } : r)))
                      }
                      className="input"
                      required={row.action !== 'delete'}
                      disabled={row.action === 'delete'}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost border border-slate-200"
                        onClick={() => setCorrectionRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))}
                        disabled={correctionRows.length === 1}
                      >
                        Entfernen
                      </button>
                      {idx === correctionRows.length - 1 && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => setCorrectionRows((prev) => [...prev, { time: '', type: 'CLOCK_IN' }])}
                        >
                          Weitere Zeit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn-primary w-full" type="submit" disabled={correctionCreate.isPending}>
                Korrektur einreichen
              </button>
            </form>
          </div>

          <div className="card p-4 space-y-2">
            <h3 className="font-semibold">Meine Korrekturen</h3>
            <div className="space-y-2">
              {(myCorrections.data ?? []).map((item: TimeCorrectionRequest) => (
                <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{item.date}</p>
                    <span className={statusMeta(item.status).className}>{statusMeta(item.status).label}</span>
                  </div>
                  {item.note && <p className="text-xs text-slate-600 mt-1">{item.note}</p>}
                  {item.entries?.length ? (
                    <ul className="mt-1 text-xs text-slate-600 space-y-0.5">
                      {item.entries.map((entry: any, idx: number) => (
                        <li key={`${entry.id ?? idx}-${entry.timestamp}`}>
                          {new Date(entry.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                          {entry.type === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
              {(myCorrections.data ?? []).length === 0 && <p className="text-slate-500 text-sm">Keine Korrekturen vorhanden.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AbsenceRequestsPage() {
  return <RequestsPage view="absence" />;
}

export function CorrectionRequestsPage() {
  return <RequestsPage view="correction" />;
}

export function CancellationRequestsPage() {
  return <RequestsPage view="storno" />;
}
