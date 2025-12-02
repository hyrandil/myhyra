import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEntries, punch } from '../api';
import { TimeEntry } from '../types';
import { useAuth } from '../AuthProvider';

const labels: Record<TimeEntry['type'], string> = {
  CLOCK_IN: 'Kommen',
  CLOCK_OUT: 'Gehen',
  BREAK_START: 'Pause starten',
  BREAK_END: 'Pause Ende',
};

function formatStamp(ts: string) {
  const [datePart, timePart] = ts.split(' ');
  const [hour = '00', minute = '00'] = (timePart ?? '').split(':');
  return `${datePart ?? ''} ${hour}:${minute}`.trim();
}

export function MobileHomePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['entries'], queryFn: fetchEntries });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Standortbestimmung wird von diesem Browser nicht unterstützt.');
      return;
    }

    const handleSuccess = (pos: GeolocationPosition) => {
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationError(null);
    };
    const handleError = () => setLocationError('Standort erforderlich zum Stempeln. Bitte Freigabe erteilen.');

    const requestFix = () => {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 7000,
      });
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 7000,
    });

    requestFix();
    const interval = window.setInterval(requestFix, 10000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(interval);
    };
  }, []);

  const mutate = useMutation({
    mutationFn: (vars: { type: TimeEntry['type']; location?: { lat: number; lng: number } }) => punch(vars.type, vars.location),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries'] }),
  });

  const last = data?.[0];
  const isWorking = last?.type === 'CLOCK_IN';
  const mainAction: TimeEntry['type'] = !last || last.type === 'CLOCK_OUT' ? 'CLOCK_IN' : 'CLOCK_OUT';
  const actionColor = mainAction === 'CLOCK_IN' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 18) return 'Guten Tag';
    return 'Guten Abend';
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-sky-600 via-sky-700 to-slate-900 text-white p-5 shadow-xl">
        <p className="text-sm text-white/80">{greeting}</p>
        <h1 className="text-2xl font-bold mt-1 leading-tight">{user?.firstName || user?.name || 'ZeitPilot Nutzer'}</h1>
        <p className="text-sm text-white/80">Status: {isWorking ? 'Anwesend' : 'Abgemeldet'}</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            className={`h-14 rounded-2xl font-semibold text-white shadow-lg active:scale-[0.99] transition ${actionColor} disabled:opacity-60`}
            disabled={
              mutate.isPending || ((mainAction === 'CLOCK_IN' || mainAction === 'CLOCK_OUT') && (!location || !!locationError))
            }
            onClick={() => mutate.mutate({ type: mainAction, location: location ?? undefined })}
          >
            {mainAction === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}
          </button>
          {locationError && <p className="text-xs text-amber-200">{locationError}</p>}
          {location && (
            <p className="text-xs text-white/70">GPS: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-800">Letzte Buchungen</p>
          <span className="text-[11px] uppercase text-slate-400">Chronik</span>
        </div>
        <div className="divide-y divide-slate-100">
          {(data ?? []).map((entry) => (
            <div key={entry.id} className="py-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{labels[entry.type]}</p>
                <p className="text-xs text-slate-500">{formatStamp(entry.timestamp)}</p>
              </div>
              <div className="text-right text-[11px] text-slate-500 space-y-1">
                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full">{entry.source}</span>
                {entry.lat && entry.lng ? (
                  <a
                    className="block text-sky-600 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://maps.google.com/?q=${entry.lat},${entry.lng}`}
                  >
                    Standort ansehen
                  </a>
                ) : (
                  <span>Kein Standort</span>
                )}
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <p className="text-sm text-slate-500">Noch keine Buchungen vorhanden.</p>}
        </div>
      </div>
    </div>
  );
}
