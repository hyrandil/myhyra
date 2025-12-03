import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAbsenceRequest,
  fetchAbsenceInbox,
  fetchAbsenceKinds,
  fetchMyAbsenceRequests,
  requestAbsenceCancellation,
  updateAbsenceStatus,
  createTimeCorrectionRequest,
  fetchCorrectionInbox,
  fetchMyCorrections,
  updateCorrectionStatus,
} from '../api';
import { useAuth } from '../AuthProvider';
import { AbsenceRequest, TimeCorrectionRequest } from '../types';

export function RequestsPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  const kinds = useQuery({ queryKey: ['absence', 'kinds'], queryFn: fetchAbsenceKinds });
  const myRequests = useQuery({ queryKey: ['absence', 'mine'], queryFn: fetchMyAbsenceRequests });
  const inbox = useQuery({
    queryKey: ['absence', 'inbox'],
    queryFn: fetchAbsenceInbox,
    enabled: auth.hasRole('lead', 'hr', 'admin'),
  });

  const myCorrections = useQuery({ queryKey: ['corrections', 'mine'], queryFn: fetchMyCorrections });
  const correctionInbox = useQuery({
    queryKey: ['corrections', 'inbox'],
    queryFn: fetchCorrectionInbox,
    enabled: auth.hasRole('lead', 'hr', 'admin'),
  });

  const createMutation = useMutation({
    mutationFn: createAbsenceRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) => requestAbsenceCancellation(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['absence'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => updateAbsenceStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['absence'] });
      queryClient.setQueryData<AbsenceRequest[] | undefined>(['absence', 'inbox'], (existing) =>
        existing?.filter((req) => req.id !== variables.id)
      );
    },
  });

  const correctionCreate = useMutation({
    mutationFn: createTimeCorrectionRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['corrections'] }),
  });

  const correctionStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      updateCorrectionStatus(id, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['corrections'] });
      queryClient.setQueryData<TimeCorrectionRequest[] | undefined>(['corrections', 'inbox'], (existing) =>
        existing?.filter((item) => item.id !== variables.id)
      );
    },
  });

  const handleRequestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

  const handleCancelSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const id = Number(form.get('request_id'));
    if (!Number.isFinite(id)) return;
    cancelMutation.mutate({ id, reason: String(form.get('reason') || '') });
    e.currentTarget.reset();
  };

  const handleCorrectionSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    correctionCreate.mutate({ date: String(form.get('date')), note: String(form.get('note') || '') });
    e.currentTarget.reset();
  };

  const cancelable = (myRequests.data ?? []).filter(
    (req) => req.status === 'approved' && !req.cancel_requested && !req.canceled
  );

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Anträge</p>
          <h2 className="text-2xl font-semibold">Abwesenheiten & Korrekturen</h2>
          <p className="text-sm text-slate-500">Anträge stellen, stornieren und genehmigen.</p>
        </div>
        <div className="badge bg-slate-200 text-slate-700">{auth.user?.role}</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="card p-4 space-y-4 lg:col-span-2">
          <h3 className="font-semibold">Neuen Abwesenheitsantrag stellen</h3>
          <form className="grid md:grid-cols-2 gap-3" onSubmit={handleRequestSubmit}>
            <label className="text-sm block">
              Von
              <input name="start_date" type="date" required className="input mt-1" />
            </label>
            <label className="text-sm block">
              Bis
              <input name="end_date" type="date" required className="input mt-1" />
            </label>
            <label className="text-sm block">
              Art
              <select name="type" className="input mt-1">
                {(kinds.data ?? []).map((kind: any) => (
                  <option key={kind.code} value={kind.code}>
                    {kind.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm block md:col-span-2">
              Kommentar
              <textarea name="comment" className="input mt-1" />
            </label>
            <div className="md:col-span-2 flex gap-2">
              <button className="btn-primary" type="submit" disabled={createMutation.isPending}>
                Antrag absenden
              </button>
            </div>
          </form>
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="font-semibold">Stornierungsantrag</h3>
          <form className="space-y-2" onSubmit={handleCancelSubmit}>
            <label className="text-sm block">
              Genehmigter Antrag
              <select name="request_id" required className="input mt-1">
                {cancelable.map((req) => (
                  <option key={req.id} value={req.id}>
                    {req.start_date} – {req.end_date} ({req.type})
                  </option>
                ))}
                {cancelable.length === 0 && <option value="">Keine genehmigten Anträge</option>}
              </select>
            </label>
            <label className="text-sm block">
              Begründung
              <textarea name="reason" className="input mt-1" />
            </label>
            <button className="btn-ghost w-full border border-slate-300" type="submit" disabled={cancelMutation.isPending}>
              Stornierung einreichen
            </button>
          </form>
          <p className="text-xs text-slate-500">Genehmigte Abwesenheiten können so nachträglich aufgehoben werden.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="card p-4 space-y-3 lg:col-span-2">
          <h3 className="font-semibold">Korrekturantrag Arbeitszeit</h3>
          <form className="grid md:grid-cols-2 gap-3" onSubmit={handleCorrectionSubmit}>
            <label className="text-sm block">
              Datum
              <input name="date" type="date" required className="input mt-1" />
            </label>
            <label className="text-sm block md:col-span-2">
              Beschreibung
              <textarea name="note" className="input mt-1" placeholder="z.B. Kommen 08:00 ergänzen" />
            </label>
            <div className="md:col-span-2">
              <button className="btn-primary" type="submit" disabled={correctionCreate.isPending}>
                Korrektur absenden
              </button>
            </div>
          </form>
        </div>
        <div className="card p-4 space-y-2">
          <h3 className="font-semibold">Eigene Korrekturen</h3>
          <div className="space-y-2 text-sm">
            {(myCorrections.data ?? []).map((item: any) => (
              <div key={item.id} className="p-2 rounded border border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.date}</span>
                  <span className="badge bg-slate-200 text-slate-700">{item.status}</span>
                </div>
                {item.note && <p className="text-xs text-slate-600 mt-1">{item.note}</p>}
              </div>
            ))}
            {(myCorrections.data ?? []).length === 0 && <p className="text-slate-500 text-sm">Keine Korrekturen vorhanden.</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Eigene Abwesenheitsanträge</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {(myRequests.data ?? []).map((req) => (
              <div key={req.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{req.start_date} – {req.end_date}</p>
                  <span className="badge bg-slate-200 text-slate-700">{req.status}</span>
                </div>
                <p className="text-sm text-slate-600">{req.type}</p>
                {req.cancel_requested && <p className="text-xs text-amber-600">Storno angefragt</p>}
                {req.canceled && <p className="text-xs text-emerald-700">Storniert</p>}
                {req.comment && <p className="text-xs text-slate-500">{req.comment}</p>}
              </div>
            ))}
            {(myRequests.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine Anträge vorhanden.</p>}
          </div>
        </div>

        {auth.hasRole('lead', 'hr', 'admin') && (
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Genehmigungsliste</h3>
              <p className="text-xs text-slate-500">Teamleiter/HR</p>
            </div>
            <div className="space-y-2">
              {(inbox.data ?? []).map((req) => (
                <div key={req.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
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
                  {req.cancel_requested && <p className="text-xs text-amber-600">Stornierung angefragt</p>}
                </div>
              ))}
              {(inbox.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine offenen Genehmigungen.</p>}
            </div>
          </div>
        )}
      </div>

      {auth.hasRole('lead', 'hr', 'admin') && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Korrekturanträge prüfen</h3>
            <p className="text-xs text-slate-500">Nur offene Anträge</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {(correctionInbox.data ?? []).map((item: TimeCorrectionRequest) => (
              <div key={item.id} className="rounded border border-slate-200 p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{item.user_name ?? item.user_id}</p>
                    <p className="text-sm text-slate-500">{item.date}</p>
                  </div>
                  <span className="badge bg-slate-200 text-slate-700">{item.status}</span>
                </div>
                {item.note && <p className="text-xs text-slate-600 mt-1">{item.note}</p>}
                <div className="flex gap-2 mt-2">
                  <button
                    className="btn-primary px-3 py-1"
                    onClick={() => correctionStatus.mutate({ id: item.id, status: 'approved' })}
                  >
                    Genehmigen
                  </button>
                  <button
                    className="btn-ghost border border-rose-200 text-rose-700"
                    onClick={() => correctionStatus.mutate({ id: item.id, status: 'rejected' })}
                  >
                    Ablehnen
                  </button>
                </div>
              </div>
            ))}
            {(correctionInbox.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine offenen Korrekturen.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
