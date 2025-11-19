import { useEffect, useState } from 'react';
import { CalendarView } from './CalendarView';
import { useEmployees } from '../hooks/useEmployees';
import { useUserBookings } from '../hooks/useBookings';

export function AdminTable() {
  const { data: employees, isLoading: isEmployeesLoading } = useEmployees();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedUserId && employees && employees.length > 0) {
      setSelectedUserId(employees[0].id);
    }
  }, [employees, selectedUserId]);

  const {
    data: bookings = [],
    isLoading: isBookingLoading,
    refetch,
  } = useUserBookings(selectedUserId);

  if (isEmployeesLoading) {
    return <p>Lade Mitarbeitende...</p>;
  }

  if (!employees || employees.length === 0) {
    return <p>Es wurden noch keine Mitarbeitenden angelegt.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded border border-slate-200 bg-white p-4">
        <h3 className="text-lg font-semibold mb-3">Mitarbeitende</h3>
        <div className="space-y-2">
          {employees.map((employee) => (
            <button
              key={employee.id}
              onClick={() => setSelectedUserId(employee.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                employee.id === selectedUserId
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <p className="font-semibold">{employee.name}</p>
              <p className="text-xs text-slate-500">{employee.email}</p>
            </button>
          ))}
        </div>
      </div>
      <CalendarView
        title="Kalenderansicht Mitarbeiter"
        subtitle={selectedUserId ? employees.find((e) => e.id === selectedUserId)?.name : undefined}
        bookings={bookings}
        isLoading={isBookingLoading}
        onRefresh={() => refetch()}
        dataKey={selectedUserId ?? 'none'}
        emptyState="Für diesen Tag hat der ausgewählte Mitarbeiter keine Buchungen."
      />
    </div>
  );
}
