import { FormEvent, useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarView } from './CalendarView';
import { useEmployees } from '../hooks/useEmployees';
import { useUserBookings } from '../hooks/useBookings';
import api from '../api';
import type { EmployeeSummary } from '../types';

export function AdminTable() {
  const {
    data: employees,
    isLoading: isEmployeesLoading,
    refetch: refetchEmployees,
  } = useEmployees();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' as EmployeeSummary['role'] });
  const [newUserMessage, setNewUserMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const createUserMutation = useMutation({
    mutationFn: async (payload: typeof newUser) => {
      await api.post('/users', payload);
    },
    onSuccess: () => {
      refetchEmployees();
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      await api.patch(`/users/${userId}/password`, { password });
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, payload }: { bookingId: number; payload: { clock_in?: string; clock_out?: string | null } }) => {
      await api.patch(`/bookings/${bookingId}`, payload);
    },
  });

  const handleCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    setNewUserMessage(null);
    try {
      await createUserMutation.mutateAsync(newUser);
      setNewUser({ name: '', email: '', password: '', role: 'user' });
      setNewUserMessage({ type: 'success', text: 'Mitarbeiter angelegt.' });
    } catch (error: any) {
      setNewUserMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Benutzer konnte nicht erstellt werden.',
      });
    }
  };

  const handleResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    setPasswordMessage(null);
    try {
      await resetPasswordMutation.mutateAsync({ userId: selectedUserId, password: passwordValue });
      setPasswordValue('');
      setPasswordMessage({ type: 'success', text: 'Passwort aktualisiert.' });
    } catch (error: any) {
      setPasswordMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Passwortänderung fehlgeschlagen.',
      });
    }
  };

  if (isEmployeesLoading) {
    return <p>Lade Mitarbeitende...</p>;
  }

  if (!employees || employees.length === 0) {
    return <p>Es wurden noch keine Mitarbeitenden angelegt.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="rounded border border-slate-200 bg-white p-4 space-y-6 text-sm">
        <div>
          <h3 className="text-lg font-semibold mb-3">Mitarbeitende</h3>
          <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
            {employees.map((employee) => (
              <button
                key={employee.id}
                onClick={() => setSelectedUserId(employee.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
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
        <form className="space-y-2" onSubmit={handleCreateUser}>
          <h4 className="text-sm font-semibold text-slate-600">Neuen Benutzer anlegen</h4>
          <input
            type="text"
            value={newUser.name}
            onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Name"
            className="w-full rounded border border-slate-300 px-2 py-1"
            required
          />
          <input
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="E-Mail"
            className="w-full rounded border border-slate-300 px-2 py-1"
            required
          />
          <input
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Passwort"
            className="w-full rounded border border-slate-300 px-2 py-1"
            required
            minLength={6}
          />
          <select
            value={newUser.role}
            onChange={(e) => setNewUser((prev) => ({ ...prev, role: e.target.value as EmployeeSummary['role'] }))}
            className="w-full rounded border border-slate-300 px-2 py-1"
          >
            <option value="user">Mitarbeiter</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={createUserMutation.isPending}
            className="w-full rounded bg-emerald-600 py-2 text-white font-semibold disabled:opacity-50"
          >
            {createUserMutation.isPending ? 'Speichere...' : 'Benutzer erstellen'}
          </button>
          {newUserMessage && (
            <p className={`text-xs ${newUserMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {newUserMessage.text}
            </p>
          )}
        </form>
        <form className="space-y-2" onSubmit={handleResetPassword}>
          <h4 className="text-sm font-semibold text-slate-600">Passwort ändern</h4>
          <input
            type="password"
            value={passwordValue}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder="Neues Passwort"
            className="w-full rounded border border-slate-300 px-2 py-1"
            minLength={6}
            required
            disabled={!selectedUserId}
          />
          <button
            type="submit"
            disabled={!selectedUserId || resetPasswordMutation.isPending}
            className="w-full rounded bg-slate-800 py-2 text-white font-semibold disabled:opacity-50"
          >
            {resetPasswordMutation.isPending ? 'Aktualisiere...' : 'Passwort setzen'}
          </button>
          {passwordMessage && (
            <p className={`text-xs ${passwordMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {passwordMessage.text}
            </p>
          )}
        </form>
      </div>
      <CalendarView
        title="Kalenderansicht Mitarbeiter"
        subtitle={selectedUserId ? employees.find((e) => e.id === selectedUserId)?.name : undefined}
        bookings={bookings}
        isLoading={isBookingLoading}
        onRefresh={() => refetch()}
        dataKey={selectedUserId ?? 'none'}
        emptyState="Für diesen Tag hat der ausgewählte Mitarbeiter keine Buchungen."
        onUpdateBooking={(bookingId, payload) => updateBookingMutation.mutateAsync({ bookingId, payload }).then(() => refetch())}
      />
    </div>
  );
}
