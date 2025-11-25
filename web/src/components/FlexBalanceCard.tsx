import { useMyFlexBalance } from '../hooks/useSettings';
import { formatMinutes } from '../utils/time';

export function FlexBalanceCard() {
  const { data, isLoading, error } = useMyFlexBalance();

  const balance = data?.balanceMinutes ?? 0;
  const balanceLabel = `${balance >= 0 ? '+' : '-'}${formatMinutes(Math.abs(balance))}`;

  return (
    <div className="rounded-md bg-white p-4 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Gleitzeitkonto</h3>
          <p className="text-sm text-slate-500">Überstunden/Minusstunden laut Arbeitszeitplan</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            balance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {balanceLabel}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-600">
        {isLoading && <p>Daten werden geladen...</p>}
        {error && <p className="text-rose-600">Konto konnte nicht geladen werden.</p>}
        {data && (
          <>
            <p className="text-slate-700">
              Status: {data.enabled ? 'Aktiviert' : 'Deaktiviert durch Admin'}
            </p>
            <p>Gearbeitet/angerechnet: {formatMinutes(data.workedMinutes)}</p>
            <p>Geplante Zeit: {formatMinutes(data.plannedMinutes)}</p>
            {data.adjustment !== 0 && (
              <p className="text-xs text-slate-500">
                Manuelle Anpassung: {data.adjustment > 0 ? '+' : ''}{formatMinutes(Math.abs(data.adjustment))}
              </p>
            )}
          </>
        )}
        {!isLoading && !error && data && !data.enabled && (
          <p className="text-xs text-slate-500">Bitte Admin aktivieren lassen, um Gleitzeit zu führen.</p>
        )}
      </div>
    </div>
  );
}

