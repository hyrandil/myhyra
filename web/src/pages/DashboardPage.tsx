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
  const isWorking = last && (last.type === 'CLOCK_IN' || last.type === 'BREAK_END');
  const isOnBreak = last?.type === 'BREAK_START';
  const mainAction: TimeEntry['type'] = !last || last.type === 'CLOCK_OUT' ? 'CLOCK_IN' : 'CLOCK_OUT';

  return (
    <div className="space-y-4">
      <div className="bg-white shadow rounded p-4 space-y-3">
        <h2 className="text-lg font-semibold">Stempeluhr</h2>
        <div className="flex gap-3 items-center">
          <button
            className={`flex-1 py-4 text-xl font-semibold rounded shadow text-white ${
              mainAction === 'CLOCK_IN' ? 'bg-emerald-600' : 'bg-rose-600'
            } disabled:opacity-60`}
            disabled={mutate.isPending}
            onClick={() => mutate.mutate(mainAction)}
          >
            {mainAction === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}
          </button>
          <div className="flex flex-col gap-2 w-40">
            <button
              className="px-3 py-2 bg-amber-500 text-white rounded disabled:opacity-50"
              disabled={mutate.isPending || isOnBreak || !isWorking}
              onClick={() => mutate.mutate('BREAK_START')}
            >
              Pause starten
            </button>
            <button
              className="px-3 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
              disabled={mutate.isPending || !isOnBreak}
              onClick={() => mutate.mutate('BREAK_END')}
            >
              Pause beenden
            </button>
          </div>
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
