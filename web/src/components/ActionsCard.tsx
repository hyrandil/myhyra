import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

async function requestLocation(): Promise<{ lat: number; lng: number } | undefined> {
  if (!('geolocation' in navigator)) {
    return undefined;
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}

export function ActionsCard() {
  const queryClient = useQueryClient();

  const clockIn = useMutation({
    mutationFn: async () => {
      const location = await requestLocation();
      await api.post('/bookings/clock-in', { location });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] }),
  });

  const clockOut = useMutation({
    mutationFn: async () => {
      const location = await requestLocation();
      await api.post('/bookings/clock-out', { location });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] }),
  });

  return (
    <div className="bg-white rounded shadow p-4 space-y-3">
      <h2 className="text-lg font-semibold">Schnellaktionen</h2>
      <p className="text-sm text-slate-500">
        Beim mobilen Zugriff wird automatisch dein Standort angefordert. Wenn du ihn nicht freigibst, wird die Buchung ohne
        Koordinaten gespeichert.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => clockIn.mutate()}
          className="flex-1 bg-emerald-600 text-white py-2 rounded disabled:opacity-50"
          disabled={clockIn.isPending}
        >
          {clockIn.isPending ? 'Stempeln...' : 'Kommen'}
        </button>
        <button
          onClick={() => clockOut.mutate()}
          className="flex-1 bg-rose-600 text-white py-2 rounded disabled:opacity-50"
          disabled={clockOut.isPending}
        >
          {clockOut.isPending ? 'Stempeln...' : 'Gehen'}
        </button>
      </div>
    </div>
  );
}
