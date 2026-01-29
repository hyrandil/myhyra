import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAbsenceKind, deleteAbsenceKind, fetchAbsenceKinds, updateAbsenceKind } from '../api';
import { useAuth } from '../AuthProvider';

export function AbsencePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  if (!auth.hasRole('admin')) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-2">Kein Zugriff</h2>
        <p className="text-sm text-slate-600">Die Abwesenheitsarten können nur durch Administratoren verwaltet werden.</p>
      </div>
    );
  }
  const kinds = useQuery({ queryKey: ['absence', 'kinds'], queryFn: fetchAbsenceKinds });

  const kindMutation = useMutation({
    mutationFn: createAbsenceKind,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence', 'kinds'] }),
  });

  const updateKind = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: { code: string; label: string; counts_as_work: boolean; allow_full?: boolean; allow_half?: boolean; allow_hourly?: boolean };
    }) => updateAbsenceKind(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence', 'kinds'] }),
  });

  const removeKind = useMutation({
    mutationFn: (id: number) => deleteAbsenceKind(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence', 'kinds'] }),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Abwesenheiten</p>
            <h2 className="text-2xl font-semibold text-slate-900">Abwesenheitsarten verwalten</h2>
            <p className="text-sm text-slate-500">Steuere, welche Abwesenheiten verfügbar sind und wie sie zählen.</p>
          </div>
          <div className="badge bg-slate-100 text-slate-700">{auth.user?.role}</div>
        </div>
      </div>

      {auth.hasRole('admin') && (
        <div className="card p-4">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Abwesenheitsarten</h4>
                <p className="text-xs text-slate-500">Bestehende Einträge lassen sich nur ändern, wenn sie nicht genutzt wurden.</p>
              </div>
              <ul className="space-y-2 text-sm">
                {(kinds.data ?? []).map((kind: any) => {
                  const locked = Boolean(kind.locked);
                  return (
                    <li key={kind.id} className="rounded border border-slate-200 p-2 bg-slate-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{kind.label}</p>
                          <p className="text-xs text-slate-500">{kind.code} · {kind.counts_as_work ? 'Arbeitszeit' : 'Keine Arbeitszeit'}</p>
                          {locked && <p className="text-xs text-amber-600 mt-1">Dieser Typ wird bereits verwendet und kann nicht bearbeitet oder gelöscht werden.</p>}
                        </div>
                        <div className="flex gap-2 items-center text-xs text-slate-500">
                          {kind.allow_full ? 'Ganztag ' : ''}
                          {kind.allow_half ? 'Halb ' : ''}
                          {kind.allow_hourly ? 'Stundenweise' : ''}
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2 text-xs">
                        <details className="w-full">
                          <summary className="cursor-pointer text-slate-700">Bearbeiten</summary>
                          <form
                            className="grid grid-cols-2 gap-2 mt-2"
                            onSubmit={(e) => {
                              e.preventDefault();
                              if (locked) return;
                              const data = new FormData(e.currentTarget);
                              updateKind.mutate({
                                id: kind.id,
                                payload: {
                                  code: String(data.get('code')),
                                  label: String(data.get('label')),
                                  counts_as_work: Boolean(data.get('counts_as_work')),
                                  allow_full: Boolean(data.get('allow_full')),
                                  allow_half: Boolean(data.get('allow_half')),
                                  allow_hourly: Boolean(data.get('allow_hourly')),
                                },
                              });
                            }}
                          >
                            <label className="text-xs block">
                              Kürzel
                              <input name="code" defaultValue={kind.code} className="input mt-1" disabled={locked} />
                            </label>
                            <label className="text-xs block">
                              Name
                              <input name="label" defaultValue={kind.label} className="input mt-1" disabled={locked} />
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" name="counts_as_work" defaultChecked={kind.counts_as_work} disabled={locked} /> Arbeitszeit
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" name="allow_full" defaultChecked={kind.allow_full} disabled={locked} /> Ganztags
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" name="allow_half" defaultChecked={kind.allow_half} disabled={locked} /> Halbtags
                            </label>
                            <label className="flex items-center gap-2 text-xs">
                              <input type="checkbox" name="allow_hourly" defaultChecked={kind.allow_hourly} disabled={locked} /> Stundenweise
                            </label>
                            <div className="col-span-2 flex gap-2">
                              <button className="btn-primary" type="submit" disabled={locked || updateKind.isPending}>Speichern</button>
                              <button
                                className="btn-ghost border border-rose-200 text-rose-700"
                                type="button"
                                disabled={locked || removeKind.isPending}
                                onClick={() => {
                                  if (locked) return;
                                  if (window.confirm('Abwesenheitsart wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) {
                                    removeKind.mutate(kind.id);
                                  }
                                }}
                              >
                                Löschen
                              </button>
                            </div>
                          </form>
                        </details>
                      </div>
                    </li>
                  );
                })}
                {(kinds.data ?? []).length === 0 && <li className="text-slate-500 text-sm">Keine Arten konfiguriert.</li>}
              </ul>
            </div>
            <form
              className="p-3 rounded-lg border border-slate-200 bg-white space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                kindMutation.mutate({
                  code: String(data.get('code')),
                  label: String(data.get('label')),
                  counts_as_work: Boolean(data.get('counts_as_work')),
                  allow_full: Boolean(data.get('allow_full')),
                  allow_half: Boolean(data.get('allow_half')),
                  allow_hourly: Boolean(data.get('allow_hourly')),
                });
                e.currentTarget.reset();
              }}
            >
              <h4 className="font-semibold">Neue Abwesenheitsart</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="block">
                  Kürzel
                  <input name="code" required className="input mt-1" />
                </label>
                <label className="block">
                  Name
                  <input name="label" required className="input mt-1" />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="counts_as_work" defaultChecked /> Arbeitszeit
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="allow_full" defaultChecked /> Ganztags
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="allow_half" defaultChecked /> Halbtags
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="allow_hourly" /> Stundenweise
                </label>
              </div>
              <button className="btn-primary w-full" type="submit" disabled={kindMutation.isPending}>
                Speichern
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
