import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createManualTimeEntry, deleteTimeEntry, fetchInconsistentDays, updateTimeEntry } from '../api';
import { InconsistentDay, TimeEntry } from '../types';

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatLocal(ts: string) {
  const [_, timePart] = ts.split(' ');
  const [hour = '00', minute = '00'] = (timePart ?? '').split(':');
  return `${hour}:${minute}`;
}

function toLocalInput(ts: string) {
  const [datePart, timePart] = ts.split(' ');
  if (!datePart || !timePart) return '';
  const [hour, minute] = timePart.split(':');
  return `${datePart}T${hour}:${minute}`;
}

export function InconsistentPage() {
  const [filter, setFilter] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const inconsistencies = useQuery({
    queryKey: ['inconsistent'],
    queryFn: () => fetchInconsistentDays(),
  });

  const updateEntry = useMutation({
    mutationFn: ({ entryId, timestamp, type }: { entryId: number; timestamp: string; type: 'CLOCK_IN' | 'CLOCK_OUT' }) =>
      updateTimeEntry(entryId, { timestamp, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inconsistent'] });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (entryId: number) => deleteTimeEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inconsistent'] });
    },
  });

  const createEntry = useMutation({
    mutationFn: (payload: { userId: number; timestamp: string; type: 'CLOCK_IN' | 'CLOCK_OUT' }) =>
      createManualTimeEntry(payload.userId, { timestamp: payload.timestamp, type: payload.type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inconsistent'] });
      setAddingFor(null);
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Qualitätssicherung</p>
            <h1 className="text-2xl font-semibold text-slate-900">Inkonsistente Buchungen</h1>
            <p className="text-sm text-slate-500">Alle offenen Inkonsistenzen bis gestern, filterbar nach Name.</p>
          </div>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter nach Name"
            className="input max-w-xs"
          />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        {inconsistencies.isLoading && <p className="text-sm text-slate-500">Lade Daten…</p>}
        {inconsistencies.isSuccess && inconsistencies.data.length === 0 && (
          <p className="text-sm text-emerald-700">Keine inkonsistenten Buchungen.</p>
        )}
        {inconsistencies.isSuccess && inconsistencies.data.length > 0 && (
          <div className="space-y-3">
            {inconsistencies.data
              .filter((row: InconsistentDay) =>
                filter.trim() ? row.user.toLowerCase().includes(filter.toLowerCase()) : true
              )
              .map((row: InconsistentDay) => {
              return (
                <div key={`${row.user_id}-${row.date}`} className="border border-rose-200 rounded-lg p-3 bg-rose-50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs uppercase text-rose-700 font-semibold">Inkonsistenz</p>
                      <p className="font-semibold">{row.user}</p>
                      <p className="text-sm text-slate-600">{formatDate(row.date)}</p>
                    </div>
                    <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded">Bearbeitung empfohlen</span>
                  </div>
                  <div className="space-y-2">
                    {row.entries.map((entry) => {
                      const localDefault = toLocalInput(entry.timestamp);
                      const isEditing = editingId === entry.id;
                      const defaultType: 'CLOCK_IN' | 'CLOCK_OUT' = entry.type === 'CLOCK_IN' ? 'CLOCK_IN' : 'CLOCK_OUT';
                      return (
                        <div key={entry.id} className="bg-white border border-rose-200 rounded-md p-2">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-semibold">{formatLocal(entry.timestamp)} – {entry.type === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}</p>
                              <p className="text-xs text-slate-500">Quelle: {entry.source}</p>
                            </div>
                            <div className="flex gap-2 items-center">
                              <button
                                className="text-xs underline text-slate-700"
                                onClick={() => setEditingId(isEditing ? null : entry.id)}
                              >
                                {isEditing ? 'Abbrechen' : 'Ändern'}
                              </button>
                              <button
                                className="text-xs text-rose-700"
                                onClick={() => deleteEntry.mutate(entry.id)}
                                disabled={deleteEntry.isPending}
                              >
                                Löschen
                              </button>
                            </div>
                          </div>
                          {isEditing && (
                          <form
                            className="grid md:grid-cols-3 gap-2 mt-2 text-sm"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const data = new FormData(e.currentTarget);
                                const ts = String(data.get('timestamp'));
                                updateEntry.mutate({
                                  entryId: entry.id,
                                  timestamp: ts,
                                  type: (data.get('type') as 'CLOCK_IN' | 'CLOCK_OUT') ?? 'CLOCK_IN',
                                });
                                setEditingId(null);
                              }}
                          >
                              <div>
                                <label className="text-xs text-slate-500">Zeitpunkt</label>
                                <input name="timestamp" type="datetime-local" defaultValue={localDefault} className="input w-full" />
                              </div>
                              <div>
                                <label className="text-xs text-slate-500">Typ</label>
                                <select name="type" defaultValue={defaultType} className="input w-full">
                                  <option value="CLOCK_IN">Kommen</option>
                                  <option value="CLOCK_OUT">Gehen</option>
                                </select>
                              </div>
                              <div className="flex items-end">
                                <button className="btn-primary w-full" type="submit" disabled={updateEntry.isPending}>
                                  Speichern
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      );
                    })}
                    <div className="bg-white border border-rose-200 rounded-md p-3">
                      <div className="flex items-center justify-between text-sm">
                        <p className="font-semibold">Neue Buchung hinzufügen</p>
                        <button
                          className="text-xs underline"
                          onClick={() =>
                            setAddingFor(addingFor === `${row.user_id}-${row.date}` ? null : `${row.user_id}-${row.date}`)
                          }
                        >
                          {addingFor === `${row.user_id}-${row.date}` ? 'Schließen' : 'Öffnen'}
                        </button>
                      </div>
                      {addingFor === `${row.user_id}-${row.date}` && (
                        <form
                          className="grid md:grid-cols-3 gap-2 mt-2 text-sm"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const data = new FormData(e.currentTarget);
                            const ts = String(data.get('timestamp'));
                            createEntry.mutate({
                              userId: row.user_id,
                              timestamp: ts,
                              type: (data.get('type') as 'CLOCK_IN' | 'CLOCK_OUT') ?? 'CLOCK_IN',
                            });
                          }}
                        >
                          <div>
                            <label className="text-xs text-slate-500">Zeitpunkt</label>
                            <input
                              name="timestamp"
                              type="datetime-local"
                              defaultValue={`${row.date}T08:00`}
                              className="input w-full"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Typ</label>
                            <select name="type" className="input w-full">
                              <option value="CLOCK_IN">Kommen</option>
                              <option value="CLOCK_OUT">Gehen</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button className="btn-primary w-full" type="submit" disabled={createEntry.isPending}>
                              Speichern
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
