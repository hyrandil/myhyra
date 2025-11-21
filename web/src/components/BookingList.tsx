import { CalendarView } from './CalendarView';
import { useMyBookings } from '../hooks/useBookings';
import { useMyAbsences } from '../hooks/useSettings';

export function BookingList() {
  const { data, isLoading, refetch } = useMyBookings();
  const { data: absences = [], isLoading: isAbsenceLoading } = useMyAbsences();

  return (
    <CalendarView
      title="Kalenderübersicht"
      subtitle="Wähle einen Tag, um Buchungen, Arbeitszeit und Pause einzusehen."
      bookings={data ?? []}
      absences={absences}
      isLoading={isLoading || isAbsenceLoading}
      onRefresh={() => refetch()}
      dataKey="me"
    />
  );
}
