import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Link } from 'react-router-dom';
import {
  fetchAbsenceInbox,
  fetchCorrectionInbox,
  updateAbsenceStatus,
  updateCorrectionStatus,
} from '../api';
import { useAuth } from '../AuthProvider';
import { AbsenceRequest, TimeCorrectionRequest } from '../types';

export function ApprovalListPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();

  if (!auth.hasRole('lead', 'hr', 'admin')) {
    return <Navigate to="/antraege" replace />;
  }

  const refreshCalendars = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = String(query.queryKey[0]);
        return key === 'absence' || key === 'time' || key === 'overview' || key === 'reports' || key === 'corrections';
      },
    });
  };

  const absenceInbox = useQuery({ queryKey: ['absence', 'inbox'], queryFn: fetchAbsenceInbox });
  const correctionInbox = useQuery({ queryKey: ['corrections', 'inbox'], queryFn: fetchCorrectionInbox });

  const absenceStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) => updateAbsenceStatus(id, status),
    onSuccess: (_data, variables) => {
      refreshCalendars();
      queryClient.setQueryData<AbsenceRequest[] | undefined>(['absence', 'inbox'], (existing) =>
        existing?.filter((req) => req.id !== variables.id)
      );
    },
  });

  const correctionStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'approved' | 'rejected' }) =>
      updateCorrectionStatus(id, status),
    onSuccess: (_data, variables) => {
      refreshCalendars();
      queryClient.setQueryData<TimeCorrectionRequest[] | undefined>(['corrections', 'inbox'], (existing) =>
        existing?.filter((req) => req.id !== variables.id)
      );
    },
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Genehmigungen</p>
            <h2 className="text-2xl font-semibold text-slate-900">Offene Anträge</h2>
            <p className="text-sm text-slate-500">Abwesenheiten und Korrekturen gebündelt bearbeiten.</p>
          </div>
          <Link to="/antraege" className="btn-ghost border border-slate-200">
            Zurück zu Anträge
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Abwesenheitsanträge</h3>
            <span className="text-xs text-slate-500">Pending</span>
          </div>
          <div className="space-y-2">
            {(absenceInbox.data ?? []).map((req: AbsenceRequest) => (
              <div key={req.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{req.user_name ?? req.user_id}</p>
                    <p className="text-slate-500 text-sm">{req.start_date} – {req.end_date}</p>
                    <p className="text-xs text-slate-500">Art: {req.type}{req.cancel_requested ? ' · Stornierung' : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary px-3 py-1"
                      onClick={() => absenceStatus.mutate({ id: req.id, status: 'approved' })}
                    >
                      Genehmigen
                    </button>
                    <button
                      className="btn-ghost border border-rose-200 text-rose-700"
                      onClick={() => absenceStatus.mutate({ id: req.id, status: 'rejected' })}
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
                {req.cancel_requested && <p className="text-xs text-amber-600">Stornierung angefragt</p>}
              </div>
            ))}
            {(absenceInbox.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine offenen Anträge.</p>}
          </div>
        </div>

        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Korrekturen</h3>
            <span className="text-xs text-slate-500">Pending</span>
          </div>
          <div className="space-y-2">
            {(correctionInbox.data ?? []).map((req: TimeCorrectionRequest) => (
              <div key={req.id} className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{req.user_name ?? req.user_id}</p>
                    <p className="text-slate-500 text-sm">{req.date}</p>
                    {req.note && <p className="text-xs text-slate-600">{req.note}</p>}
                    {req.cancel_requested ? (
                      <p className="text-xs text-amber-600">Stornierung angefragt</p>
                    ) : null}
                    {req.entries?.length ? (
                      <ul className="mt-1 text-xs text-slate-600 space-y-0.5">
                        {req.entries.map((entry: NonNullable<TimeCorrectionRequest['entries']>[number], idx: number) => (
                          <li key={`${entry.id ?? idx}-${entry.timestamp}`}>
                            {new Date(entry.timestamp).toLocaleTimeString('de-DE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {entry.action === 'delete' ? 'Löschen' : entry.action === 'replace' ? 'Ersetzen' : 'Neu'} ·{' '}
                            {entry.type === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-primary px-3 py-1"
                      onClick={() => correctionStatus.mutate({ id: req.id, status: 'approved' })}
                    >
                      Genehmigen
                    </button>
                    <button
                      className="btn-ghost border border-rose-200 text-rose-700"
                      onClick={() => correctionStatus.mutate({ id: req.id, status: 'rejected' })}
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {(correctionInbox.data ?? []).length === 0 && <p className="text-sm text-slate-500">Keine offenen Korrekturen.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
