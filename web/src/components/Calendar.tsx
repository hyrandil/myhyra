import { useEffect, useMemo, useState } from 'react';
import { DailySummary } from '../types';

const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

type CalendarProps = {
  month: string;
  days: Record<string, DailySummary>;
  selectedDate?: string | null;
  onSelect?: (date: string) => void;
  maskAbsences?: boolean;
  hideDetails?: boolean;
  absencesOnly?: boolean;
};

const formatHours = (minutes: number) => {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const hrs = Math.floor(abs / 60);
  const mins = abs % 60;
  return `${sign}${hrs}h ${String(mins).padStart(2, '0')}m`;
};

function statusAccent(summary?: DailySummary) {
  if (!summary) return 'bg-slate-200';
  if (summary.status === 'sick') return 'bg-rose-500';
  if (summary.status === 'holiday') return 'bg-sky-500';
  if (summary.status === 'vacation') return 'bg-amber-500';
  if (summary.status === 'away') return 'bg-slate-500';
  if (summary.status === 'pending') return 'bg-white border border-amber-500';
  if (summary.status === 'open') return 'bg-rose-700';
  return 'bg-slate-900';
}

function dayColor(summary?: DailySummary) {
  if (!summary) return 'bg-white text-slate-500 border-slate-200';
  if (summary.status === 'sick') return 'bg-rose-50 text-rose-800 border-rose-200';
  if (summary.status === 'holiday') return 'bg-sky-50 text-sky-900 border-sky-200';
  if (summary.status === 'vacation') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (summary.status === 'away') return 'bg-slate-50 text-slate-700 border-slate-200';
  if (summary.status === 'pending') return 'bg-amber-50 text-amber-800 border-amber-300';
  if (summary.status === 'open') return 'bg-white text-rose-700 border-rose-400';
  return 'bg-white text-slate-900 border-slate-300';
}

export function Calendar({ month, days, selectedDate, onSelect, maskAbsences, hideDetails, absencesOnly }: CalendarProps) {
  const [internalSelected, setInternalSelected] = useState<string | null>(selectedDate ?? null);

  useEffect(() => {
    if (selectedDate) {
      setInternalSelected(selectedDate);
    }
  }, [selectedDate]);

  const { cells, selectedSummary } = useMemo(() => {
    const base = new Date(`${month}-01T00:00:00Z`);
    const startWeekday = (base.getUTCDay() + 6) % 7; // Monday first
    const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0));
    const totalDays = end.getUTCDate();
    const arr: { date: string; label: number; summary?: DailySummary }[] = [];

    for (let i = 0; i < startWeekday; i += 1) {
      arr.push({ date: '', label: 0 });
    }
    for (let d = 1; d <= totalDays; d += 1) {
      const key = `${month}-${String(d).padStart(2, '0')}`;
      arr.push({ date: key, label: d, summary: days[key] });
    }
    const key = selectedDate ?? internalSelected;
    const selectedSummary = key ? days[key] : undefined;
    return { cells: arr, selectedSummary };
  }, [days, month, internalSelected, selectedDate]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 text-xs font-semibold text-slate-500">
        {weekdays.map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell, idx) => (
          <button
            key={idx}
            className={`rounded-xl p-2 h-20 text-sm text-left border ${
              cell.date === (selectedDate ?? internalSelected) ? 'ring-2 ring-sky-400' : ''
            } ${dayColor(cell.summary)} shadow-sm transition`}
            onClick={() => {
              if (!cell.date) return;
              setInternalSelected(cell.date);
              onSelect?.(cell.date);
            }}
            disabled={!cell.date}
          >
            <div className="flex justify-between items-start">
              <span className="font-semibold">{cell.label || ''}</span>
              {cell.summary && !absencesOnly && (
                <span className="text-xs flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${statusAccent(cell.summary)}`}></span>
                  {cell.summary.flex >= 0 ? '+' : ''}
                  {formatHours(cell.summary.flex)}
                </span>
              )}
            </div>
            {cell.summary?.absences?.length ? (
              <p className="text-[11px] mt-1 truncate">
                {maskAbsences
                  ? cell.summary.absences.map((a) => (a.toLowerCase().includes('urlaub') ? 'Urlaub' : 'Nicht im Haus')).join(', ')
                  : cell.summary.absences.join(', ')}
              </p>
            ) : null}
            {cell.summary?.status === 'pending' && (
              <p className="text-[11px] text-amber-700 mt-1">○ Antrag vorgemerkt</p>
            )}
            {cell.summary?.status === 'open' && (
              <p className="text-[11px] text-rose-700 mt-1">✖ Offene Buchung</p>
            )}
            {cell.summary?.status === 'ok' && (
              <p className="text-[11px] text-slate-700 mt-1">● Buchung vollständig</p>
            )}
          </button>
        ))}
      </div>
      {!hideDetails && (selectedDate ?? internalSelected) && (
        <div className="p-3 card">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm mb-1">{selectedDate ?? internalSelected}</h4>
              {selectedSummary ? (
                <div className="text-sm space-y-1">
                  {!absencesOnly && (
                    <>
                      <p>
                        Arbeitszeit: {formatHours(selectedSummary.worked)} / {formatHours(selectedSummary.planned)}
                      </p>
                      <p className={selectedSummary.flex >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                        Gleitzeit: {formatHours(selectedSummary.flex)}
                      </p>
                    </>
                  )}
                  {selectedSummary.pending && <p className="text-amber-700">Antrag wartend</p>}
                  {selectedSummary.absences.length > 0 && (
                    <p>
                      Abwesenheiten:{' '}
                      {maskAbsences
                        ? selectedSummary.absences
                            .map((a) => (a.toLowerCase().includes('urlaub') ? 'Urlaub' : 'Nicht im Haus'))
                            .join(', ')
                        : selectedSummary.absences.join(', ')}
                    </p>
                  )}
                  {selectedSummary.users && selectedSummary.users.length > 0 && (
                    <p>
                      Betroffen: {selectedSummary.users.map((u) => u.name).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Keine Daten.</p>
              )}
            </div>
            <div className="text-xs text-slate-500 space-y-1 text-right">
              <p className="flex items-center gap-2 justify-end">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span> Feiertag
              </p>
              <p className="flex items-center gap-2 justify-end">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span> Urlaub
              </p>
              <p className="flex items-center gap-2 justify-end">
                <span className="h-2 w-2 rounded-full border border-amber-500"></span> Antrag offen
              </p>
              <p className="flex items-center gap-2 justify-end">
                <span className="h-2 w-2 rounded-full bg-slate-500"></span> Nicht im Haus
              </p>
              <p className="flex items-center gap-2 justify-end">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span> Krank/Offen
              </p>
              <p className="flex items-center gap-2 justify-end">
                <span className="h-2 w-2 rounded-full bg-slate-900"></span> Korrekte Buchung
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
