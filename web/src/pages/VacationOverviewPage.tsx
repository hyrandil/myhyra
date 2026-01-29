import { useQuery } from '@tanstack/react-query';
import { fetchVacationOverview } from '../api';
import { useAuth } from '../AuthProvider';
import type { VacationOverviewItem } from '../types';

export function VacationOverviewPage() {
  const { user, hasRole } = useAuth();
  const { data } = useQuery({ queryKey: ['vacation-overview'], queryFn: fetchVacationOverview });
  const items = data ?? [];
  const headline = hasRole('admin', 'hr', 'lead') ? 'Urlaubsübersicht' : 'Mein Urlaub';

  const renderRow = (item: VacationOverviewItem) => (
    <div key={item.userId} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm flex justify-between items-center">
      <div>
        <p className="font-semibold text-slate-900">{item.name}</p>
        <p className="text-xs text-slate-500">{item.email}</p>
      </div>
      <div className="flex gap-6 text-sm">
        <span className="font-semibold text-slate-800">Rest: {item.remaining.toFixed(2)} Tage</span>
        <span className="text-slate-700">Geplant: {item.planned.toFixed(2)}</span>
        <span className="text-slate-700">Genommen: {item.used.toFixed(2)}</span>
        <span className="text-slate-700">Kontingent: {item.allowance.toFixed(2)}</span>
      </div>
    </div>
  );

  const list = hasRole('admin', 'hr', 'lead') ? items : items.filter((i) => i.userId === user?.id);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Urlaub</p>
        <p className="text-2xl font-semibold text-slate-900">{headline}</p>
        <p className="text-sm text-slate-500">Verbleibender Urlaub, geplante und genommene Tage im Überblick.</p>
      </div>
      <div className="space-y-3">
        {list.map(renderRow)}
        {list.length === 0 && <p className="text-sm text-slate-500">Keine Daten vorhanden.</p>}
      </div>
    </div>
  );
}
