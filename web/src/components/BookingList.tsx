import { CalendarView } from './CalendarView';
import { useMyBookings } from '../hooks/useBookings';
import { useMyAbsences, useMySchedule } from '../hooks/useSettings';

export function BookingList() {
  const { data, isLoading, refetch } = useMyBookings();
  const { data: absences = [], isLoading: isAbsenceLoading } = useMyAbsences();
  const { data: schedule } = useMySchedule();

  return (
    <CalendarView
      title="Kalenderübersicht"
      subtitle="Wähle einen Tag, um Buchungen, Arbeitszeit und Pause einzusehen."
      bookings={data ?? []}
      absences={absences}
      schedule={schedule?.days}
      isLoading={isLoading || isAbsenceLoading}
      onRefresh={() => refetch()}
      dataKey="me"
    />
  );
}
