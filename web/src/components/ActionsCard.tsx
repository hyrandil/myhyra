import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '../api';
import { useMyBookings } from '../hooks/useBookings';

async function requestLocation(): Promise<{ lat: number; lng: number }> {
  if (!('geolocation' in navigator)) {
    throw new Error('Dieses Gerät liefert keine Geodaten.');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Standortfreigabe ist für jede Buchung erforderlich.')),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

export function ActionsCard() {
  const queryClient = useQueryClient();
  const { data: bookings } = useMyBookings();
  const activeBooking = bookings?.find((booking) => !booking.clock_out);
  const [error, setError] = useState<string | null>(null);

  const punch = useMutation({
    mutationFn: async () => {
      setError(null);
      const location = await requestLocation();
      const action = activeBooking ? 'clock-out' : 'clock-in';
      await api.post(`/bookings/${action}`, { location });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', 'me'] });
    },
    onError: (err: any) => {
      setError(err?.message ?? 'Aktion fehlgeschlagen.');
    },
  });

  const isClockedIn = Boolean(activeBooking);
  const label = punch.isPending ? 'Speichere...' : isClockedIn ? 'Gehen' : 'Kommen';
  const statusText = isClockedIn
    ? `Seit ${new Date(activeBooking!.clock_in).toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      })} eingestempelt`
    : 'Bereit für den nächsten Arbeitstag';

  return (
    <div className="bg-white rounded shadow p-6 space-y-4">
      <div className="space-y-1">
        <p className="text-sm text-slate-500 uppercase tracking-wide">Status</p>
        <p className="text-lg font-semibold">{statusText}</p>
      </div>
      <button
        onClick={() => punch.mutate()}
        disabled={punch.isPending}
        className={`w-full rounded-full py-4 text-white text-lg font-semibold transition-all ${
          isClockedIn ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
        } disabled:opacity-50`}
      >
        {label}
      </button>
      <p className="text-xs text-slate-500">
        Jede Buchung speichert den Standort aus dem Browser bzw. der App. Bitte erlaube den Zugriff auf die Geoposition, damit die
        Kommen- und Gehen-Zeit gültig gespeichert werden kann.
      </p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  );
}
