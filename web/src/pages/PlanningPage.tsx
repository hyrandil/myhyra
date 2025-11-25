import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchEmployees, fetchSchedule, updateSchedule } from '../api';
import { Employee } from '../types';
import { useAuth } from '../AuthProvider';

const weekdayLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export function PlanningPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  const { data: employees } = useQuery({
    queryKey: ['employees', 'planning'],
    queryFn: () => fetchEmployees(),
    enabled: auth.hasRole('admin', 'hr'),
  });

  const schedules = useQuery({
    queryKey: ['schedule', selectedUser],
    queryFn: () => fetchSchedule(selectedUser!),
    enabled: Boolean(selectedUser),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { userId: number; days: { weekday: number; minutes: number }[] }) =>
      updateSchedule(payload.userId, payload.days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['daily'] });
    },
  });

  useEffect(() => {
    if (!selectedUser && employees && employees.length > 0) {
      setSelectedUser(employees[0].id);
    }
  }, [selectedUser, employees]);

  const dayMinutes = useMemo(() => {
    const base = new Map<number, number>();
    if (schedules.data?.days) {
      schedules.data.days.forEach((d) => base.set(d.weekday, d.minutes));
    }
    return weekdayLabels.map((_, idx) => base.get(idx) ?? (idx < 5 ? 480 : 0));
  }, [schedules.data]);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Arbeitszeiten</p>
          <h2 className="text-2xl font-semibold">Stundenplanung</h2>
          <p className="text-sm text-slate-500">Sollzeiten pro Wochentag je Mitarbeiter festlegen.</p>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <label className="text-sm text-slate-600">Mitarbeiter</label>
          <select
            className="input"
            value={selectedUser ?? ''}
            onChange={(e) => setSelectedUser(Number(e.target.value))}
          >
            {(employees as Employee[] | undefined)?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} ({emp.personnelNumber || emp.email})
              </option>
            ))}
          </select>
        </div>

        <form
          className="grid md:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedUser) return;
            const form = new FormData(e.currentTarget);
            const payload = weekdayLabels.map((_, idx) => {
              const hours = Number(form.get(`day-${idx}`) || 0);
              return { weekday: idx, minutes: Math.max(Math.round(hours * 60), 0) };
            });
            updateMutation.mutate({ userId: selectedUser, days: payload });
          }}
        >
          {weekdayLabels.map((label, idx) => (
            <label key={label} className="text-sm text-slate-700 flex flex-col">
              {label}
              <div className="flex items-center gap-2 mt-1">
                <input
                  name={`day-${idx}`}
                  type="number"
                  step="0.25"
                  min="0"
                  defaultValue={(dayMinutes[idx] ?? 0) / 60}
                  className="input flex-1"
                />
                <span className="text-xs text-slate-500">Stunden</span>
              </div>
            </label>
          ))}
          <div className="md:col-span-2 flex justify-end">
            <button className="btn-primary" type="submit" disabled={updateMutation.isPending}>
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
