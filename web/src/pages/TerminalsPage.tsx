import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTerminal, fetchTerminals, updateTerminal } from '../api';
import { TerminalDevice } from '../types';

export function TerminalsPage() {
  const queryClient = useQueryClient();
  const terminalsQuery = useQuery({
    queryKey: ['terminals'],
    queryFn: fetchTerminals,
  });

  const createMutation = useMutation({
    mutationFn: (payload: { name: string }) => createTerminal(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terminals'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => updateTerminal(id, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['terminals'] }),
  });

  const terminals = (terminalsQuery.data?.terminals ?? []) as TerminalDevice[];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Terminals</p>
            <h2 className="text-2xl font-semibold text-slate-900">Erfassungsterminals</h2>
            <p className="text-sm text-slate-500">
              API-Keys verwalten und den Status der Terminals überwachen.
            </p>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const name = String(form.get('name') || '').trim();
              if (!name) return;
              createMutation.mutate({ name });
              e.currentTarget.reset();
            }}
          >
            <input name="name" placeholder="Neues Terminal" className="input" />
            <button className="btn-primary" type="submit" disabled={createMutation.isPending}>
              Key erzeugen
            </button>
          </form>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Registrierte Terminals</h3>
          <span className="text-xs text-slate-500">{terminals.length} Einträge</span>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">API Key</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Letzter Kontakt</th>
                <th className="px-4 py-3 text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {terminals.map((terminal) => (
                <tr key={terminal.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">{terminal.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{terminal.apiKey}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        terminal.status === 'online'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {terminal.status === 'online' ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {terminal.lastSeenAt ? new Date(terminal.lastSeenAt).toLocaleString('de-DE') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="btn-ghost text-xs"
                      type="button"
                      onClick={() => updateMutation.mutate({ id: terminal.id, active: !terminal.active })}
                    >
                      {terminal.active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                  </td>
                </tr>
              ))}
              {terminals.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-slate-500" colSpan={5}>
                    Noch keine Terminals registriert.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
