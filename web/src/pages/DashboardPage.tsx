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

  const mutate = useMutation({
    mutationFn: punch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries'] }),
  });

  const last = data?.[0];
  const isWorking = last && (last.type === 'CLOCK_IN' || last.type === 'BREAK_END');
  const isOnBreak = last?.type === 'BREAK_START';
  const mainAction: TimeEntry['type'] = !last || last.type === 'CLOCK_OUT' ? 'CLOCK_IN' : 'CLOCK_OUT';

  return (
    <div className="space-y-4">
      <div className="card-ghost p-6 bg-gradient-to-r from-sky-600 to-blue-700 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-sky-100">Live Stempeln</p>
            <h1 className="text-3xl font-bold">Zentrale Stempeluhr</h1>
            <p className="text-sky-100 mt-1">
              Status: {isOnBreak ? 'In Pause' : isWorking ? 'Anwesend' : 'Abgemeldet'}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <button
              className={`rounded-full h-28 w-28 text-lg font-bold shadow-lg ring-4 ring-white/40 transition ${
                mainAction === 'CLOCK_IN' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
              } disabled:opacity-50`}
              disabled={mutate.isPending}
              onClick={() => mutate.mutate(mainAction)}
            >
              {mainAction === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}
            </button>
            <div className="flex flex-col gap-2 w-48">
              <button
                className="btn-ghost bg-white/10 text-white border border-white/20 disabled:opacity-40"
                disabled={mutate.isPending || isOnBreak || !isWorking}
                onClick={() => mutate.mutate('BREAK_START')}
              >
                Pause starten
              </button>
              <button
                className="btn-ghost bg-white/10 text-white border border-white/20 disabled:opacity-40"
                disabled={mutate.isPending || !isOnBreak}
                onClick={() => mutate.mutate('BREAK_END')}
              >
                Pause beenden
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Aktueller Status</p>
          <h3 className="text-xl font-semibold mt-1">{isOnBreak ? 'Pause' : isWorking ? 'Anwesend' : 'Abgemeldet'}</h3>
          <p className="text-sm text-slate-500 mt-2">Letzte Aktion: {last ? labels[last.type] : '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase text-slate-500">Quelle</p>
          <h3 className="text-xl font-semibold mt-1">{last?.source ?? 'WEB'}</h3>
          <p className="text-sm text-slate-500 mt-2">GPS {last?.lat && last?.lng ? 'erfasst' : 'nicht vorhanden'}</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Letzte Buchungen</h3>
          <span className="text-xs uppercase text-slate-500">Chronik</span>
        </div>
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
