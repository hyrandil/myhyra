import { CalendarView } from './CalendarView';
import { useMyBookings } from '../hooks/useBookings';

export function BookingList() {
  const { data, isLoading, refetch } = useMyBookings();

  return (
    <CalendarView
      title="Kalenderübersicht"
      subtitle="Wähle einen Tag, um Buchungen, Arbeitszeit und Pause einzusehen."
      bookings={data ?? []}
      isLoading={isLoading}
      onRefresh={() => refetch()}
      dataKey="me"
    />
  );
}
