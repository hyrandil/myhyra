import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAbsenceRequest, fetchAbsenceInbox, fetchMyAbsenceRequests, updateAbsenceStatus } from '../api';
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

  const createMutation = useMutation({
    mutationFn: createAbsenceRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => updateAbsenceStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence'] }),
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
                <option value="vacation">Urlaub</option>
                <option value="sick">Krank</option>
                <option value="remote">Remote</option>
                <option value="other">Sonstiges</option>
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
