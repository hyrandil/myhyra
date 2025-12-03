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

const MS_IN_MINUTE = 60000;

function parseTimestamp(ts: string) {
  const [datePart, timePartRaw] = ts.replace('T', ' ').split(' ');
  if (!datePart) return 0;
  const [year, month, day] = datePart.split('-').map((v) => Number(v));
  const [hour, minute, second] = (timePartRaw ?? '00:00:00').split(':').map((v) => Number(v));
  return Date.UTC(year || 0, (month || 1) - 1, day || 1, hour || 0, minute || 0, Number.isFinite(second) ? second : 0);
}

function computeWorkedSoFar(entries: TimeEntry[], now: Date) {
  const nowMs = now.getTime();
  const sorted = [...entries].sort((a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp));
  let currentIn: number | null = null;
  let workMs = 0;
  let breakMs = 0;
  let firstIn: number | null = null;
  let lastOut: number | null = null;
  let lastType: TimeEntry['type'] | null = null;

  sorted.forEach((entry) => {
    const ts = parseTimestamp(entry.timestamp);
    if (Number.isNaN(ts)) return;

    if (entry.type === 'CLOCK_IN' || entry.type === 'BREAK_END') {
      if (lastOut !== null) {
        breakMs += Math.max(ts - lastOut, 0);
      }
      currentIn = ts;
      lastOut = null;
      if (firstIn === null) firstIn = ts;
    }

    if (entry.type === 'BREAK_START' || entry.type === 'CLOCK_OUT') {
      if (currentIn !== null) {
        workMs += Math.max(ts - currentIn, 0);
      }
      currentIn = null;
      lastOut = ts;
      if (firstIn === null) firstIn = ts;
    }
    lastType = entry.type;
  });

  if (currentIn !== null) {
    workMs += Math.max(nowMs - currentIn, 0);
    lastOut = nowMs;
  } else if (lastOut !== null && lastType === 'BREAK_START') {
    breakMs += Math.max(nowMs - lastOut, 0);
  }

  const workedMinutesRaw = workMs / MS_IN_MINUTE;
  const recordedBreakMinutes = breakMs / MS_IN_MINUTE;

  const baseRequirement = Math.min(Math.max(workedMinutesRaw - 360, 0), 30);
  const effectiveAfterBase = workedMinutesRaw - baseRequirement;
  const longRequirement = Math.min(Math.max(effectiveAfterBase - 540, 0), 15);
  const requiredPause = baseRequirement + longRequirement;
  const autoDeduction = Math.max(requiredPause - recordedBreakMinutes, 0);
  const effective = Math.max(workedMinutesRaw - autoDeduction, 0);

  return Math.round(effective);
}

function formatMinutes(total: number) {
  const hours = Math.floor(total / 60);
  const minutes = Math.max(total % 60, 0);
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function DashboardPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['entries'], queryFn: fetchEntries });
  const { user } = useAuth();
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const canViewLocation = user ? ['lead', 'hr', 'admin'].includes(user.role) : false;
  const [now, setNow] = useState<Date>(new Date());

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

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const mutate = useMutation({
    mutationFn: (vars: { type: TimeEntry['type']; location?: { lat: number; lng: number } }) =>
      punch(vars.type, vars.location),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['entries'] }),
  });

  const last = data?.[0];
  const isWorking = last?.type === 'CLOCK_IN';
  const mainAction: TimeEntry['type'] = !last || last.type === 'CLOCK_OUT' ? 'CLOCK_IN' : 'CLOCK_OUT';

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const workedToday = useMemo(() => {
    const todaysEntries = (data ?? []).filter((entry) => entry.timestamp.startsWith(todayKey));
    return computeWorkedSoFar(todaysEntries, now);
  }, [data, now, todayKey]);
  const clockString = useMemo(
    () => now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    [now]
  );

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Zentrale Stempeluhr</p>
            <h1 className="text-2xl font-semibold text-slate-900">Status: {isWorking ? 'Anwesend' : 'Abgemeldet'}</h1>
            <p className="text-sm text-slate-600">Letzte Aktion: {last ? labels[last.type] : '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
              <span className="px-2 py-1 rounded bg-slate-100 font-semibold">Uhrzeit: {clockString}</span>
              <span className="px-2 py-1 rounded bg-slate-100 font-semibold">
                Gearbeitet heute: {formatMinutes(workedToday)} (inkl. Auto-Pause)
              </span>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <button
              className={`w-full md:w-40 h-14 rounded-lg font-semibold text-white shadow transition ${
                mainAction === 'CLOCK_IN' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'
              } disabled:opacity-60`}
              disabled={
                mutate.isPending ||
                ((mainAction === 'CLOCK_IN' || mainAction === 'CLOCK_OUT') && (!location || !!locationError))
              }
              onClick={() =>
                mutate.mutate({
                  type: mainAction,
                  location: location ?? undefined,
                })
              }
            >
              {mainAction === 'CLOCK_IN' ? 'Kommen' : 'Gehen'}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Letzte Buchungen</h3>
          <span className="text-xs uppercase text-slate-500">Chronik</span>
        </div>
        {locationError && (
          <p className="text-sm text-amber-600 mb-2">
            {locationError}
          </p>
        )}
          <div className="divide-y">
            {(data ?? []).map((entry) => (
              <div key={entry.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-semibold">{labels[entry.type]}</p>
                  <p className="text-slate-500">{formatStamp(entry.timestamp)}</p>
                </div>
              <div className="text-right text-xs text-slate-500 space-y-1">
                <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                  <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                  {entry.source}
                </div>
                {canViewLocation && entry.lat && entry.lng ? (
                  <p>
                    GPS: {entry.lat.toFixed(3)}, {entry.lng.toFixed(3)}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
          {(data ?? []).length === 0 && <p className="text-sm text-slate-500">Noch keine Buchungen vorhanden.</p>}
        </div>
      </div>
    </div>
  );
}
