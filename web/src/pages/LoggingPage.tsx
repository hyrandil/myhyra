import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { fetchAuditLogs, fetchEmployees } from '../api';
import { AuditLogEntry, Employee } from '../types';

export function LoggingPage() {
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState<number | undefined>(undefined);

  const employees = useQuery({ queryKey: ['employees', 'logs'], queryFn: () => fetchEmployees() });
  const logs = useQuery({ queryKey: ['logs', q, userId], queryFn: () => fetchAuditLogs({ q, userId }) });

  const options = useMemo(() => {
    const list = (employees.data ?? []) as Employee[];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [employees.data]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audit Log</p>
            <h1 className="text-2xl font-semibold text-slate-900">Aktivitäten & Änderungen</h1>
            <p className="text-sm text-slate-500">Suche nach Nutzern, Aktionen und Details der Zeitverwaltung.</p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
          <input
            placeholder="Volltextsuche"
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="input"
            value={userId ?? ''}
            onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">Alle Nutzer</option>
            {options.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
        </div>
      </div>

      <div className="card p-4 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr>
              <th className="py-2 pr-3">Zeit</th>
              <th className="py-2 pr-3">Aktion</th>
              <th className="py-2 pr-3">Auslöser</th>
              <th className="py-2 pr-3">Betroffener</th>
              <th className="py-2 pr-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {(logs.data ?? []).map((log: AuditLogEntry) => (
              <tr key={log.id} className="border-t border-slate-200">
                <td className="py-2 pr-3 whitespace-nowrap text-slate-700">
                  {new Date(log.created_at).toLocaleString('de-DE')}
                </td>
                <td className="py-2 pr-3 font-semibold text-slate-900">{log.action}</td>
                <td className="py-2 pr-3 text-slate-700">{log.actor_name || 'System'}</td>
                <td className="py-2 pr-3 text-slate-700">{log.target_name || '—'}</td>
                <td className="py-2 pr-3 text-slate-600 break-words">
                  {log.detail ? log.detail : '—'}
                </td>
              </tr>
            ))}
            {(logs.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-slate-500 text-center">
                  Keine Einträge gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
