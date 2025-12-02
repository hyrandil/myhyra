import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteTimeEntry, fetchInconsistentDays, updateTimeEntry } from '../api';
import { InconsistentDay, TimeEntry } from '../types';

function formatDate(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatUtc(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function InconsistentPage() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(
    `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const inconsistencies = useQuery({
    queryKey: ['inconsistent', month],
    queryFn: () => fetchInconsistentDays(month),
  });

  const updateEntry = useMutation({
    mutationFn: ({ entryId, timestamp, type }: { entryId: number; timestamp: string; type: TimeEntry['type'] }) =>
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Qualitätssicherung</p>
          <h1 className="text-2xl font-bold">Inkonsistente Buchungen</h1>
          <p className="text-sm text-slate-600">Prüfe und korrigiere widersprüchliche Kommen/Gehen-Einträge.</p>
        </div>
        <label className="text-sm text-slate-600 flex items-center gap-2">
          Monat
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input"
          />
        </label>
      </div>

      <div className="card p-4 space-y-3">
        {inconsistencies.isLoading && <p className="text-sm text-slate-500">Lade Daten…</p>}
        {inconsistencies.isSuccess && inconsistencies.data.length === 0 && (
          <p className="text-sm text-emerald-700">Keine inkonsistenten Buchungen im ausgewählten Zeitraum.</p>
        )}
        {inconsistencies.isSuccess && inconsistencies.data.length > 0 && (
          <div className="space-y-3">
            {inconsistencies.data.map((row: InconsistentDay) => {
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
                      const localDefault = entry.timestamp.replace('Z', '');
                      const isEditing = editingId === entry.id;
                      return (
                        <div key={entry.id} className="bg-white border border-rose-200 rounded-md p-2">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <p className="font-semibold">{formatUtc(entry.timestamp)} – {entry.type === 'CLOCK_IN' ? 'Kommen' : entry.type === 'CLOCK_OUT' ? 'Gehen' : entry.type === 'BREAK_START' ? 'Pause starten' : 'Pause beenden'}</p>
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
                                const withZ = ts.endsWith('Z') ? ts : `${ts}Z`;
                                updateEntry.mutate({
                                  entryId: entry.id,
                                  timestamp: withZ,
                                  type: data.get('type') as TimeEntry['type'],
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
                                <select name="type" defaultValue={entry.type} className="input w-full">
                                  <option value="CLOCK_IN">Kommen</option>
                                  <option value="CLOCK_OUT">Gehen</option>
                                  <option value="BREAK_START">Pause starten</option>
                                  <option value="BREAK_END">Pause beenden</option>
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
