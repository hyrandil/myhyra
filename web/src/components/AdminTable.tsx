import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarView } from './CalendarView';
import { useEmployees } from '../hooks/useEmployees';
import { useUserBookings } from '../hooks/useBookings';
import { useUserAbsences } from '../hooks/useSettings';
import api from '../api';
import type { EmployeeSummary } from '../types';
import { VacationOverview } from './VacationOverview';
import { AttendanceOverview } from './AttendanceOverview';

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
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBooking, setManualBooking] = useState({
    includeClockIn: true,
    includeClockOut: false,
    clockIn: '',
    clockOut: '',
    clockInLat: '',
    clockInLng: '',
    clockOutLat: '',
    clockOutLng: '',
  });
  const [editUser, setEditUser] = useState({ name: '', email: '', role: 'user' as EmployeeSummary['role'] });
  const [allowanceValue, setAllowanceValue] = useState('30');
  const [allowanceMessage, setAllowanceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [absenceForm, setAbsenceForm] = useState({ date: '', type: 'vacation', duration: 'full', note: '' });
  const [absenceMessage, setAbsenceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [absenceOpen, setAbsenceOpen] = useState(true);

  useEffect(() => {
    if (!selectedUserId && employees && employees.length > 0) {
      setSelectedUserId(employees[0].id);
    }
  }, [employees, selectedUserId]);

  useEffect(() => {
    setPasswordMessage(null);
    setStatusMessage(null);
    setManualMessage(null);
    setEditMessage(null);
    setAllowanceMessage(null);
    setAbsenceMessage(null);
  }, [selectedUserId]);

  const {
    data: bookings = [],
    isLoading: isBookingLoading,
    refetch,
  } = useUserBookings(selectedUserId);
  const {
    data: absences = [],
    isLoading: isAbsenceLoading,
    refetch: refetchAbsences,
  } = useUserAbsences(selectedUserId);

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

  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: { name: string; email: string; role: EmployeeSummary['role'] };
    }) => {
      await api.patch(`/users/${userId}`, payload);
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
        clock_in?: string;
        clock_out?: string;
        clock_in_location?: { lat: number; lng: number };
        clock_out_location?: { lat: number; lng: number };
      };
    }) => {
      await api.post(`/bookings/user/${userId}/manual`, payload);
    },
  });

  const allowanceMutation = useMutation({
    mutationFn: async ({ userId, vacationAllowance }: { userId: number; vacationAllowance: number }) => {
      await api.patch(`/users/${userId}/settings`, { vacation_allowance: vacationAllowance });
    },
    onSuccess: () => {
      refetchEmployees();
    },
  });

  const createAbsenceMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: { date: string; type: string; duration: string; note?: string };
    }) => {
      await api.post(`/absences/user/${userId}`, payload);
    },
  });

  const deleteAbsenceMutation = useMutation({
    mutationFn: async (absenceId: number) => {
      await api.delete(`/absences/${absenceId}`);
    },
  });

  const selectedEmployee = useMemo(
    () => employees?.find((employee) => employee.id === selectedUserId) || null,
    [employees, selectedUserId]
  );

  const vacationStats = useMemo(() => {
    const allowance = selectedEmployee?.vacationAllowance ?? 0;
    const used = (absences ?? []).reduce((total, entry) => {
      if (entry.type !== 'vacation') {
        return total;
      }
      return total + (entry.duration === 'half' ? 0.5 : 1);
    }, 0);
    return { allowance, used, remaining: Math.max(allowance - used, 0) };
  }, [absences, selectedEmployee]);

  useEffect(() => {
    if (selectedEmployee) {
      setEditUser({
        name: selectedEmployee.name,
        email: selectedEmployee.email,
        role: selectedEmployee.role,
      });
      setAllowanceValue(String(selectedEmployee.vacationAllowance ?? 30));
    } else {
      setEditUser({ name: '', email: '', role: 'user' });
      setAllowanceValue('30');
    }
  }, [selectedEmployee]);

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

  const handleUpdateUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    setEditMessage(null);
    try {
      await updateUserMutation.mutateAsync({ userId: selectedUserId, payload: editUser });
      setEditMessage({ type: 'success', text: 'Profildaten aktualisiert.' });
    } catch (error: any) {
      setEditMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Profil konnte nicht aktualisiert werden.',
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

  const handleSaveAllowance = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    setAllowanceMessage(null);
    const parsed = Number.parseFloat(allowanceValue);
    if (Number.isNaN(parsed)) {
      setAllowanceMessage({ type: 'error', text: 'Bitte gültige Tage eingeben.' });
      return;
    }
    try {
      await allowanceMutation.mutateAsync({ userId: selectedUserId, vacationAllowance: parsed });
      setAllowanceMessage({ type: 'success', text: 'Kontingent gespeichert.' });
    } catch (error: any) {
      setAllowanceMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Kontingent konnte nicht aktualisiert werden.',
      });
    }
  };

  const handleManualBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    setManualMessage(null);
    if (!manualBooking.includeClockIn && !manualBooking.includeClockOut) {
      setManualMessage({ type: 'error', text: 'Bitte Kommen, Gehen oder beides auswählen.' });
      return;
    }
    if (manualBooking.includeClockIn && !manualBooking.clockIn) {
      setManualMessage({ type: 'error', text: 'Bitte eine Kommen-Zeit auswählen.' });
      return;
    }
    if (manualBooking.includeClockOut && !manualBooking.clockOut) {
      setManualMessage({ type: 'error', text: 'Bitte eine Gehen-Zeit auswählen.' });
      return;
    }
    const buildLocation = (lat: string, lng: string, label: string) => {
      if (!lat && !lng) {
        return undefined;
      }
      if (!lat || !lng) {
        throw new Error(`${label}: Breite und Länge müssen gemeinsam befüllt werden.`);
      }
      const latValue = Number.parseFloat(lat);
      const lngValue = Number.parseFloat(lng);
      if (Number.isNaN(latValue) || Number.isNaN(lngValue)) {
        throw new Error(`${label}: Bitte gültige Koordinaten eingeben.`);
      }
      return { lat: latValue, lng: lngValue };
    };
    try {
      const payload: {
        clock_in?: string;
        clock_out?: string;
        clock_in_location?: { lat: number; lng: number };
        clock_out_location?: { lat: number; lng: number };
      } = {};
      if (manualBooking.includeClockIn) {
        payload.clock_in = new Date(manualBooking.clockIn).toISOString();
        const inLoc = buildLocation(manualBooking.clockInLat, manualBooking.clockInLng, 'Kommen');
        if (inLoc) {
          payload.clock_in_location = inLoc;
        }
      }
      if (manualBooking.includeClockOut) {
        payload.clock_out = new Date(manualBooking.clockOut).toISOString();
        const outLoc = buildLocation(manualBooking.clockOutLat, manualBooking.clockOutLng, 'Gehen');
        if (outLoc) {
          payload.clock_out_location = outLoc;
        }
      }
      await manualBookingMutation.mutateAsync({ userId: selectedUserId, payload });
      setManualBooking({
        includeClockIn: manualBooking.includeClockIn,
        includeClockOut: manualBooking.includeClockOut,
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
      const message = error?.message || error?.response?.data?.message;
      setManualMessage({
        type: 'error',
        text: message || 'Buchung konnte nicht angelegt werden.',
      });
    }
  };

  const handleCreateAbsence = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }
    if (!absenceForm.date) {
      setAbsenceMessage({ type: 'error', text: 'Bitte ein Datum wählen.' });
      return;
    }
    setAbsenceMessage(null);
    try {
      await createAbsenceMutation.mutateAsync({
        userId: selectedUserId,
        payload: {
          date: absenceForm.date,
          type: absenceForm.type,
          duration: absenceForm.duration,
          note: absenceForm.note || undefined,
        },
      });
      setAbsenceForm({ date: '', type: absenceForm.type, duration: absenceForm.duration, note: '' });
      setAbsenceMessage({ type: 'success', text: 'Abwesenheit erfasst.' });
      refetchAbsences();
    } catch (error: any) {
      setAbsenceMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Eintrag konnte nicht gespeichert werden.',
      });
    }
  };

  const handleDeleteAbsence = async (absenceId: number) => {
    setAbsenceMessage(null);
    try {
      await deleteAbsenceMutation.mutateAsync(absenceId);
      setAbsenceMessage({ type: 'success', text: 'Eintrag gelöscht.' });
      refetchAbsences();
    } catch (error: any) {
      setAbsenceMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Eintrag konnte nicht gelöscht werden.',
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
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {employee.role === 'admin' ? 'Admin' : 'Mitarbeiter'}
                    </span>
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
          <form className="space-y-2" onSubmit={handleUpdateUser}>
            <h4 className="text-sm font-semibold text-slate-600">Stammdaten bearbeiten</h4>
            <input
              type="text"
              value={editUser.name}
              onChange={(event) => setEditUser((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Name"
              className="w-full rounded border border-slate-300 px-2 py-1"
              required
              disabled={updateUserMutation.isPending}
            />
            <input
              type="email"
              value={editUser.email}
              onChange={(event) => setEditUser((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="E-Mail"
              className="w-full rounded border border-slate-300 px-2 py-1"
              required
              disabled={updateUserMutation.isPending}
            />
            <select
              value={editUser.role}
              onChange={(event) => setEditUser((prev) => ({ ...prev, role: event.target.value as EmployeeSummary['role'] }))}
              className="w-full rounded border border-slate-300 px-2 py-1"
              disabled={updateUserMutation.isPending}
            >
              <option value="user">Mitarbeiter</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              className="w-full rounded bg-blue-600 py-2 text-white font-semibold disabled:opacity-50"
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? 'Aktualisiere...' : 'Änderungen speichern'}
            </button>
            {editMessage && (
              <p className={`text-xs ${editMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {editMessage.text}
              </p>
            )}
          </form>
        )}
        {selectedEmployee && (
          <form className="space-y-2" onSubmit={handleSaveAllowance}>
            <h4 className="text-sm font-semibold text-slate-600">Urlaubskontingent</h4>
            <div className="grid gap-2">
              <input
                type="number"
                step="0.5"
                value={allowanceValue}
                onChange={(event) => setAllowanceValue(event.target.value)}
                className="w-full rounded border border-slate-300 px-2 py-1"
                min={0}
                disabled={allowanceMutation.isPending}
              />
              <p className="text-xs text-slate-500">
                Bereits genutzt: {vacationStats.used.toFixed(1)} Tage · Rest: {vacationStats.remaining.toFixed(1)} Tage
              </p>
            </div>
            <button
              type="submit"
              className="w-full rounded bg-emerald-600 py-2 text-white font-semibold disabled:opacity-50"
              disabled={allowanceMutation.isPending}
            >
              {allowanceMutation.isPending ? 'Speichere...' : 'Kontingent aktualisieren'}
            </button>
            {allowanceMessage && (
              <p className={`text-xs ${allowanceMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {allowanceMessage.text}
              </p>
            )}
          </form>
        )}
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
        <div className="bg-white rounded-md shadow">
          <button
            type="button"
            onClick={() => setManualOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <h4 className="text-base font-semibold text-slate-800">Manuelle Buchung erfassen</h4>
              <p className="text-xs text-slate-500">
                Erfasse einzelne Kommen- oder Gehen-Buchungen – mit optionalen Koordinaten.
              </p>
            </div>
            <span className={`text-lg transition-transform ${manualOpen ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {manualOpen && (
            <form className="border-t border-slate-100 p-4 space-y-3 text-sm" onSubmit={handleManualBooking}>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={manualBooking.includeClockIn}
                    onChange={(event) =>
                      setManualBooking((prev) => ({ ...prev, includeClockIn: event.target.checked }))
                    }
                    disabled={!selectedUserId}
                  />
                  Kommen erfassen
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={manualBooking.includeClockOut}
                    onChange={(event) =>
                      setManualBooking((prev) => ({ ...prev, includeClockOut: event.target.checked }))
                    }
                    disabled={!selectedUserId}
                  />
                  Gehen erfassen
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-semibold text-slate-600">
                  Kommen
                  <input
                    type="datetime-local"
                    value={manualBooking.clockIn}
                    onChange={(event) => setManualBooking((prev) => ({ ...prev, clockIn: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                    required={manualBooking.includeClockIn}
                    disabled={!selectedUserId || !manualBooking.includeClockIn}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Gehen
                  <input
                    type="datetime-local"
                    value={manualBooking.clockOut}
                    onChange={(event) => setManualBooking((prev) => ({ ...prev, clockOut: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                    required={manualBooking.includeClockOut}
                    disabled={!selectedUserId || !manualBooking.includeClockOut}
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
                    disabled={!selectedUserId || !manualBooking.includeClockIn}
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
                    disabled={!selectedUserId || !manualBooking.includeClockIn}
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
                    disabled={!selectedUserId || !manualBooking.includeClockOut}
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
                    disabled={!selectedUserId || !manualBooking.includeClockOut}
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
          )}
        </div>
        <div className="bg-white rounded-md shadow">
          <button
            type="button"
            onClick={() => setAbsenceOpen((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <div>
              <h4 className="text-base font-semibold text-slate-800">Abwesenheit hinzufügen</h4>
              <p className="text-xs text-slate-500">Urlaub, Krankheit oder Remote-Tage als halbe oder volle Tage buchen.</p>
            </div>
            <span className={`text-lg transition-transform ${absenceOpen ? 'rotate-180' : ''}`}>⌄</span>
          </button>
          {absenceOpen && (
            <div className="border-t border-slate-100 p-4 space-y-4 text-sm">
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateAbsence}>
                <label className="text-xs font-semibold text-slate-600">
                  Datum
                  <input
                    type="date"
                    value={absenceForm.date}
                    onChange={(event) => setAbsenceForm((prev) => ({ ...prev, date: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                    required
                    disabled={!selectedUserId}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Typ
                  <select
                    value={absenceForm.type}
                    onChange={(event) => setAbsenceForm((prev) => ({ ...prev, type: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                    disabled={!selectedUserId}
                  >
                    <option value="vacation">Urlaub</option>
                    <option value="sick">Krank</option>
                    <option value="remote">Remote</option>
                    <option value="training">Schulung</option>
                    <option value="other">Sonstiges</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Dauer
                  <select
                    value={absenceForm.duration}
                    onChange={(event) => setAbsenceForm((prev) => ({ ...prev, duration: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                    disabled={!selectedUserId}
                  >
                    <option value="full">Ganzer Tag</option>
                    <option value="half">Halber Tag</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Notiz (optional)
                  <input
                    type="text"
                    value={absenceForm.note}
                    onChange={(event) => setAbsenceForm((prev) => ({ ...prev, note: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                    disabled={!selectedUserId}
                  />
                </label>
                <button
                  type="submit"
                  disabled={!selectedUserId || createAbsenceMutation.isPending}
                  className="md:col-span-2 rounded bg-indigo-600 py-2 text-white font-semibold disabled:opacity-50"
                >
                  {createAbsenceMutation.isPending ? 'Speichere...' : 'Abwesenheit sichern'}
                </button>
              </form>
              {absenceMessage && (
                <p className={`text-xs ${absenceMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {absenceMessage.text}
                </p>
              )}
              {!selectedUserId && <p className="text-xs text-slate-500">Bitte zuerst eine Person auswählen.</p>}
              <div>
                <div className="flex items-center justify-between text-xs uppercase text-slate-500">
                  <span>Historie</span>
                  <span>
                    Urlaub: {vacationStats.used.toFixed(1)} / {vacationStats.allowance.toFixed(1)} Tage
                  </span>
                </div>
                {isAbsenceLoading ? (
                  <p className="mt-2 text-sm text-slate-500">Lade Abwesenheiten...</p>
                ) : absences && absences.length > 0 ? (
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {absences.slice(0, 6).map((absence) => (
                      <li key={absence.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {new Date(absence.date).toLocaleDateString('de-DE')}
                          </p>
                          <p className="text-xs text-slate-500">
                            {absence.type} • {absence.duration === 'half' ? '½ Tag' : '1 Tag'}
                            {absence.note ? ` • ${absence.note}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAbsence(absence.id)}
                          className="text-xs text-rose-600"
                          disabled={deleteAbsenceMutation.isPending}
                        >
                          Löschen
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">Noch keine Einträge vorhanden.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <VacationOverview />
          <AttendanceOverview />
        </div>
      </div>
    </div>
  );
}
