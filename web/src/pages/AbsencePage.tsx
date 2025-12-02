import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAbsenceKind,
  createAbsenceRequest,
  fetchAbsenceInbox,
  fetchAbsenceKinds,
  fetchMyAbsenceRequests,
  updateAbsenceStatus,
} from '../api';
import { useAuth } from '../AuthProvider';

export function AbsencePage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const myRequests = useQuery({ queryKey: ['absence', 'mine'], queryFn: fetchMyAbsenceRequests });
  const inbox = useQuery({
    queryKey: ['absence', 'inbox'],
    queryFn: fetchAbsenceInbox,
    enabled: auth.hasRole('lead', 'hr', 'admin'),
  });
  const kinds = useQuery({ queryKey: ['absence', 'kinds'], queryFn: fetchAbsenceKinds });

  const createMutation = useMutation({
    mutationFn: createAbsenceRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => updateAbsenceStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence'] }),
  });

  const kindMutation = useMutation({
    mutationFn: createAbsenceKind,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence', 'kinds'] }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Abwesenheitsworkflow</p>
          <h2 className="text-2xl font-semibold">Urlaub & Krankmeldungen</h2>
          <p className="text-sm text-slate-500">Anträge mit Genehmigungslisten und Status</p>
        </div>
        <div className="badge bg-slate-200 text-slate-700">{auth.user?.role}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 items-start">
        <div className="card p-4 lg:col-span-1">
          <h2 className="font-semibold mb-2">Abwesenheit einreichen</h2>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="block text-sm">
              Von
              <input name="start_date" type="date" required className="input mt-1" />
            </label>
            <label className="block text-sm">
              Bis
              <input name="end_date" type="date" required className="input mt-1" />
            </label>
            <label className="block text-sm">
              Art
              <select name="type" className="input mt-1">
                {(kinds.data ?? []).map((kind: any) => (
                  <option key={kind.code} value={kind.code}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Kommentar
              <textarea name="comment" className="input mt-1" />
            </label>
            <button className="btn-primary w-full" type="submit" disabled={createMutation.isPending}>
              Antrag absenden
            </button>
          </form>
        </div>

        <div className="card p-4 lg:col-span-2">
          {auth.hasRole('hr', 'admin') && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="p-3 rounded-lg border border-slate-200 bg-white">
                <h4 className="font-semibold mb-2">Abwesenheitsarten</h4>
                <ul className="space-y-2 text-sm">
                  {(kinds.data ?? []).map((kind: any) => (
                    <li key={kind.code} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{kind.label}</p>
                        <p className="text-xs text-slate-500">{kind.code} · {kind.counts_as_work ? 'Arbeitszeit' : 'Keine Arbeitszeit'}</p>
                      </div>
                      <div className="text-xs text-slate-500">{kind.allow_full ? 'Ganztag ' : ''}{kind.allow_half ? 'Halb ' : ''}{kind.allow_hourly ? 'Stundenweise' : ''}</div>
                    </li>
                  ))}
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
                    Code
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
          )}
          <h3 className="font-semibold mb-2">Eigene Anträge</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {(myRequests.data ?? []).map((req) => (
              <div key={req.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{req.start_date} – {req.end_date}</p>
                  <span className="badge bg-slate-200 text-slate-700">{req.status}</span>
                </div>
                <p className="text-sm text-slate-600">{req.type}</p>
                {req.comment && <p className="text-xs text-slate-500 mt-1">{req.comment}</p>}
              </div>
            ))}
            {(myRequests.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine Anträge vorhanden.</p>}
          </div>
        </div>
      </div>

      {auth.hasRole('lead', 'hr', 'admin') && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Genehmigungsliste</h3>
            <p className="text-xs text-slate-500">Teamleiter/HR</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {(inbox.data ?? []).map((req) => (
              <div key={req.id} className="p-3 rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{req.user_name ?? req.user_id}</p>
                    <p className="text-slate-500 text-sm">{req.start_date} – {req.end_date} ({req.type})</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary px-3 py-1"
                      onClick={() => statusMutation.mutate({ id: req.id, status: 'approved' })}
                    >
                      Genehmigen
                    </button>
                    <button
                      className="btn-ghost border border-rose-200 text-rose-700"
                      onClick={() => statusMutation.mutate({ id: req.id, status: 'rejected' })}
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {(inbox.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine offenen Genehmigungen.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
