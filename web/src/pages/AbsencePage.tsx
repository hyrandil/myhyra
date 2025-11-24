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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Urlaubs-/Abwesenheitsantrag</h2>
        <form className="space-y-2" onSubmit={handleSubmit}>
          <label className="block text-sm">
            Von
            <input name="start_date" type="date" required className="w-full border rounded px-2 py-1" />
          </label>
          <label className="block text-sm">
            Bis
            <input name="end_date" type="date" required className="w-full border rounded px-2 py-1" />
          </label>
          <label className="block text-sm">
            Art
            <select name="type" className="w-full border rounded px-2 py-1">
              <option value="vacation">Urlaub</option>
              <option value="sick">Krank</option>
              <option value="remote">Remote</option>
              <option value="other">Sonstiges</option>
            </select>
          </label>
          <label className="block text-sm">
            Kommentar
            <textarea name="comment" className="w-full border rounded px-2 py-1" />
          </label>
          <button className="bg-blue-600 text-white px-3 py-2 rounded" type="submit" disabled={createMutation.isPending}>
            Antrag absenden
          </button>
        </form>
      </div>
      <div className="bg-white shadow rounded p-4">
        <h3 className="font-semibold mb-2">Eigene Anträge</h3>
        <ul className="divide-y text-sm">
          {(myRequests.data ?? []).map((req) => (
            <li key={req.id} className="py-2 flex justify-between">
              <span>
                {req.start_date} – {req.end_date} ({req.type})
              </span>
              <span className="text-slate-500">{req.status}</span>
            </li>
          ))}
        </ul>
      </div>
      {auth.hasRole('lead', 'hr', 'admin') && (
        <div className="bg-white shadow rounded p-4 lg:col-span-2">
          <h3 className="font-semibold mb-2">Genehmigungen</h3>
          <ul className="divide-y text-sm">
            {(inbox.data ?? []).map((req) => (
              <li key={req.id} className="py-2 flex justify-between items-center">
                <div>
                  <p className="font-medium">{req.user_name ?? req.user_id}</p>
                  <p className="text-slate-500">
                    {req.start_date} – {req.end_date} ({req.type})
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-1 rounded bg-emerald-600 text-white"
                    onClick={() => statusMutation.mutate({ id: req.id, status: 'approved' })}
                  >
                    Genehmigen
                  </button>
                  <button
                    className="px-3 py-1 rounded bg-rose-600 text-white"
                    onClick={() => statusMutation.mutate({ id: req.id, status: 'rejected' })}
                  >
                    Ablehnen
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
