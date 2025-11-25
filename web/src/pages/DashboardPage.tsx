import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEntries, punch } from '../api';
import { TimeEntry } from '../types';

const labels: Record<TimeEntry['type'], string> = {
  CLOCK_IN: 'Kommen',
  CLOCK_OUT: 'Gehen',
  BREAK_START: 'Pause starten',
  BREAK_END: 'Pause Ende',
};

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['entries'], queryFn: fetchEntries });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Standortbestimmung wird von diesem Browser nicht unterstützt.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      () => setLocationError('Standort erforderlich zum Stempeln. Bitte Freigabe erteilen.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const mutate = useMutation({
    mutationFn: (vars: { type: TimeEntry['type']; location?: { lat: number; lng: number } }) =>
      punch(vars.type, vars.location),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries'] }),
  });

  const last = data?.[0];
  const isWorking = last && (last.type === 'CLOCK_IN' || last.type === 'BREAK_END');
  const isOnBreak = last?.type === 'BREAK_START';
  const mainAction: TimeEntry['type'] = !last || last.type === 'CLOCK_OUT' ? 'CLOCK_IN' : 'CLOCK_OUT';

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Zentrale Stempeluhr</p>
            <h1 className="text-2xl font-semibold text-slate-900">Status: {isOnBreak ? 'Pause' : isWorking ? 'Anwesend' : 'Abgemeldet'}</h1>
            <p className="text-sm text-slate-600">Letzte Aktion: {last ? labels[last.type] : '—'}</p>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <button
              className={`w-full md:w-40 h-14 rounded-lg font-semibold text-white shadow transition ${
                mainAction === 'CLOCK_IN' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
              } disabled:opacity-60`}
              disabled={
                mutate.isPending ||
                ((mainAction === 'CLOCK_IN' || mainAction === 'CLOCK_OUT') && (!location || !!locationError))
              }
              onClick={() =>
                mutate.mutate({
                  type: mainAction,
                  location: location ?? undefined,
                })
              }
            >
              {mainAction === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}
            </button>
            <div className="flex gap-2">
              <button
                className="w-full md:w-36 h-14 rounded-lg border border-slate-200 text-slate-800 font-semibold disabled:opacity-40"
                disabled={mutate.isPending || isOnBreak || !isWorking}
                onClick={() => mutate.mutate({ type: 'BREAK_START', location: location ?? undefined })}
              >
                Pause starten
              </button>
              <button
                className="w-full md:w-36 h-14 rounded-lg border border-slate-200 text-slate-800 font-semibold disabled:opacity-40"
                disabled={mutate.isPending || !isOnBreak}
                onClick={() => mutate.mutate({ type: 'BREAK_END', location: location ?? undefined })}
              >
                Pause beenden
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Letzte Buchungen</h3>
          <span className="text-xs uppercase text-slate-500">Chronik</span>
        </div>
        {locationError && (
          <p className="text-sm text-amber-600 mb-2">
            {locationError}
          </p>
        )}
        <div className="divide-y">
          {(data ?? []).map((entry) => (
            <div key={entry.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold">{labels[entry.type]}</p>
                <p className="text-slate-500">{new Date(entry.timestamp).toLocaleString()}</p>
              </div>
              <div className="text-right text-xs text-slate-500 space-y-1">
                <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                  <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                  {entry.source}
                </div>
                {entry.lat && entry.lng ? (
                  <p>
                    GPS: {entry.lat.toFixed(3)}, {entry.lng.toFixed(3)}
                  </p>
                ) : (
                  <p>Kein Standort</p>
                )}
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <p className="text-sm text-slate-500">Noch keine Buchungen vorhanden.</p>}
        </div>
      </div>
    </div>
  );
}
