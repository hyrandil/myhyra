import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEntries, punch } from '../api';
import { TimeEntry } from '../types';

const labels: Record<TimeEntry['type'], string> = {
  CLOCK_IN: 'Kommen',
  CLOCK_OUT: 'Gehen',
  BREAK_START: 'Pause start',
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
  const canClockIn = !last || last.type === 'CLOCK_OUT';
  const canClockOut = last && (last.type === 'CLOCK_IN' || last.type === 'BREAK_END');
  const canBreakStart = last && last.type === 'CLOCK_IN';
  const canBreakEnd = last && last.type === 'BREAK_START';

  return (
    <div className="space-y-4">
      <div className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-2">Stempeluhr</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
            disabled={!canClockIn || mutate.isPending}
            onClick={() => mutate.mutate('CLOCK_IN')}
          >
            Kommen
          </button>
          <button
            className="px-3 py-2 bg-rose-600 text-white rounded disabled:opacity-50"
            disabled={!canClockOut || mutate.isPending}
            onClick={() => mutate.mutate('CLOCK_OUT')}
          >
            Gehen
          </button>
          <button
            className="px-3 py-2 bg-amber-500 text-white rounded disabled:opacity-50"
            disabled={!canBreakStart || mutate.isPending}
            onClick={() => mutate.mutate('BREAK_START')}
          >
            Pause starten
          </button>
          <button
            className="px-3 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
            disabled={!canBreakEnd || mutate.isPending}
            onClick={() => mutate.mutate('BREAK_END')}
          >
            Pause beenden
          </button>
        </div>
      </div>
      <div className="bg-white shadow rounded p-4">
        <h3 className="text-md font-semibold mb-2">Letzte Buchungen</h3>
        <ul className="divide-y">
          {(data ?? []).map((entry) => (
            <li key={entry.id} className="py-2 flex justify-between text-sm">
              <span>{labels[entry.type]}</span>
              <span className="text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
