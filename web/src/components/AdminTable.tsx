import { FormEvent, useEffect, useMemo, useState } from 'react';
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
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualBooking, setManualBooking] = useState({
    clockIn: '',
    clockOut: '',
    clockInLat: '',
    clockInLng: '',
    clockOutLat: '',
    clockOutLng: '',
  });

  useEffect(() => {
    if (!selectedUserId && employees && employees.length > 0) {
      setSelectedUserId(employees[0].id);
    }
  }, [employees, selectedUserId]);

  useEffect(() => {
    setPasswordMessage(null);
    setStatusMessage(null);
    setManualMessage(null);
  }, [selectedUserId]);

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

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: number; active: boolean }) => {
      await api.patch(`/users/${userId}/status`, { active });
    },
    onSuccess: () => {
      refetchEmployees();
    },
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, payload }: { bookingId: number; payload: { clock_in?: string; clock_out?: string | null } }) => {
      await api.patch(`/bookings/${bookingId}`, payload);
    },
  });

  const manualBookingMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: {
        clock_in: string;
        clock_out?: string;
        clock_in_location: { lat: number; lng: number };
        clock_out_location?: { lat: number; lng: number };
      };
    }) => {
      await api.post(`/bookings/user/${userId}/manual`, payload);
    },
  });

  const selectedEmployee = useMemo(
    () => employees?.find((employee) => employee.id === selectedUserId) || null,
    [employees, selectedUserId]
  );

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

  const handleToggleStatus = async () => {
    if (!selectedUserId || !selectedEmployee) {
      return;
    }
    setStatusMessage(null);
    try {
      await toggleStatusMutation.mutateAsync({ userId: selectedUserId, active: !selectedEmployee.active });
      setStatusMessage({
        type: 'success',
        text: selectedEmployee.active ? 'Zugang deaktiviert.' : 'Zugang reaktiviert.',
      });
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Statusänderung fehlgeschlagen.',
      });
    }
  };

  const handleManualBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    setManualMessage(null);
    const toNumber = (value: string) => Number.parseFloat(value);
    const latIn = toNumber(manualBooking.clockInLat);
    const lngIn = toNumber(manualBooking.clockInLng);
    const latOut = manualBooking.clockOut ? toNumber(manualBooking.clockOutLat) : null;
    const lngOut = manualBooking.clockOut ? toNumber(manualBooking.clockOutLng) : null;
    if (Number.isNaN(latIn) || Number.isNaN(lngIn) || (manualBooking.clockOut && (Number.isNaN(latOut!) || Number.isNaN(lngOut!)))) {
      setManualMessage({ type: 'error', text: 'Bitte gültige Koordinaten eingeben.' });
      return;
    }
    try {
      const payload: {
        clock_in: string;
        clock_out?: string;
        clock_in_location: { lat: number; lng: number };
        clock_out_location?: { lat: number; lng: number };
      } = {
        clock_in: new Date(manualBooking.clockIn).toISOString(),
        clock_in_location: { lat: latIn, lng: lngIn },
      };
      if (manualBooking.clockOut) {
        payload.clock_out = new Date(manualBooking.clockOut).toISOString();
        payload.clock_out_location = { lat: latOut!, lng: lngOut! };
      }
      await manualBookingMutation.mutateAsync({ userId: selectedUserId, payload });
      setManualBooking({
        clockIn: '',
        clockOut: '',
        clockInLat: '',
        clockInLng: '',
        clockOutLat: '',
        clockOutLng: '',
      });
      setManualMessage({ type: 'success', text: 'Buchung angelegt.' });
      refetch();
    } catch (error: any) {
      setManualMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Buchung konnte nicht angelegt werden.',
      });
    }
  };

  if (isEmployeesLoading) {
    return <p>Lade Mitarbeitende...</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="rounded border border-slate-200 bg-white p-4 space-y-6 text-sm">
        <div>
          <h3 className="text-lg font-semibold mb-3">Mitarbeitende</h3>
          <div className="space-y-2 max-h-[320px] overflow-auto pr-1">
            {employees && employees.length > 0 ? (
              employees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => setSelectedUserId(employee.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    employee.id === selectedUserId
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <p className="font-semibold flex items-center gap-2">
                    {employee.name}
                    {!employee.active && (
                      <span className="text-[10px] uppercase tracking-wide text-rose-600">deaktiviert</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">{employee.email}</p>
                </button>
              ))
            ) : (
              <p className="text-sm text-slate-500">
                Es wurden noch keine Mitarbeitenden angelegt. Verwende das Formular unten, um den ersten Nutzer anzulegen.
              </p>
            )}
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
        {selectedEmployee && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-600">Login-Status</h4>
            <p className="text-xs text-slate-500">
              Aktuell ist der Zugang {selectedEmployee.active ? 'aktiv' : 'deaktiviert'}.
            </p>
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={toggleStatusMutation.isPending}
              className={`w-full rounded py-2 text-white font-semibold disabled:opacity-50 ${
                selectedEmployee.active ? 'bg-rose-600' : 'bg-emerald-600'
              }`}
            >
              {toggleStatusMutation.isPending
                ? 'Übernehme...'
                : selectedEmployee.active
                ? 'Zugang deaktivieren'
                : 'Zugang reaktivieren'}
            </button>
            {statusMessage && (
              <p className={`text-xs ${statusMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {statusMessage.text}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="space-y-4">
        <CalendarView
          title="Kalenderansicht Mitarbeiter"
          subtitle={
            selectedUserId
              ? employees?.find((e) => e.id === selectedUserId)?.name
              : 'Bitte wählen oder erstellen Sie einen Mitarbeitenden'
          }
          bookings={bookings}
          isLoading={isBookingLoading}
          onRefresh={() => refetch()}
          dataKey={selectedUserId ?? 'none'}
          emptyState={
            selectedUserId
              ? 'Für diesen Tag hat der ausgewählte Mitarbeiter keine Buchungen.'
              : 'Noch kein Mitarbeitender ausgewählt.'
          }
          onUpdateBooking={(bookingId, payload) =>
            updateBookingMutation.mutateAsync({ bookingId, payload }).then(() => refetch())
          }
        />
        <form className="bg-white rounded-md shadow p-4 space-y-3 text-sm" onSubmit={handleManualBooking}>
          <div>
            <h4 className="text-base font-semibold text-slate-800">Manuelle Buchung erfassen</h4>
            <p className="text-xs text-slate-500">
              Erfasst Kommen/Gehen inklusive Standort – perfekt für Nachträge im Monatsabschluss.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Kommen
              <input
                type="datetime-local"
                value={manualBooking.clockIn}
                onChange={(event) => setManualBooking((prev) => ({ ...prev, clockIn: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                required
                disabled={!selectedUserId}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Gehen
              <input
                type="datetime-local"
                value={manualBooking.clockOut}
                onChange={(event) => setManualBooking((prev) => ({ ...prev, clockOut: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                disabled={!selectedUserId}
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Kommen Breite (LAT)
              <input
                type="number"
                step="0.00001"
                value={manualBooking.clockInLat}
                onChange={(event) => setManualBooking((prev) => ({ ...prev, clockInLat: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                required
                disabled={!selectedUserId}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Kommen Länge (LNG)
              <input
                type="number"
                step="0.00001"
                value={manualBooking.clockInLng}
                onChange={(event) => setManualBooking((prev) => ({ ...prev, clockInLng: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                required
                disabled={!selectedUserId}
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Gehen Breite (LAT)
              <input
                type="number"
                step="0.00001"
                value={manualBooking.clockOutLat}
                onChange={(event) => setManualBooking((prev) => ({ ...prev, clockOutLat: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                required={Boolean(manualBooking.clockOut)}
                disabled={!selectedUserId}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Gehen Länge (LNG)
              <input
                type="number"
                step="0.00001"
                value={manualBooking.clockOutLng}
                onChange={(event) => setManualBooking((prev) => ({ ...prev, clockOutLng: event.target.value }))}
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                required={Boolean(manualBooking.clockOut)}
                disabled={!selectedUserId}
              />
            </label>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-blue-600 py-2 text-white font-semibold disabled:opacity-50"
            disabled={!selectedUserId || manualBookingMutation.isPending}
          >
            {manualBookingMutation.isPending ? 'Speichere...' : 'Buchung hinzufügen'}
          </button>
          {manualMessage && (
            <p className={`text-xs ${manualMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {manualMessage.text}
            </p>
          )}
          {!selectedUserId && <p className="text-xs text-slate-500">Bitte zuerst eine Person auswählen.</p>}
        </form>
      </div>
    </div>
  );
}
