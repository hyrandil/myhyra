import { useQuery } from '@tanstack/react-query';
import api from '../api';

interface Booking {
  id: number;
  clock_in: string;
  clock_out?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
}

export function BookingList() {
  const { data, refetch, isLoading } = useQuery({
    queryKey: ['bookings', 'me'],
    queryFn: async () => {
      const { data } = await api.get<Booking[]>('/bookings/me');
      return data;
    },
  });

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Meine Buchungen</h2>
        <button onClick={() => refetch()} className="text-sm text-blue-600">Aktualisieren</button>
      </div>
      {isLoading && <p>Lade...</p>}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="p-2">Kommen</th>
              <th className="p-2">Gehen</th>
              <th className="p-2">Standort</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((booking) => (
              <tr key={booking.id} className="border-t">
                <td className="p-2">{new Date(booking.clock_in).toLocaleString()}</td>
                <td className="p-2">{booking.clock_out ? new Date(booking.clock_out).toLocaleString() : '-'}</td>
                <td className="p-2 text-xs text-slate-500">
                  {booking.location_lat && booking.location_lng
                    ? `${booking.location_lat.toFixed(5)}, ${booking.location_lng.toFixed(5)}`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
