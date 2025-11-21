import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CalendarView } from './CalendarView';
import { useEmployees } from '../hooks/useEmployees';
import { useUserBookings } from '../hooks/useBookings';
import { useUserAbsences, useUserProfile, useUserSchedule } from '../hooks/useSettings';
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
  const [adminMenu, setAdminMenu] = useState<'staff' | 'planning'>('staff');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' as EmployeeSummary['role'] });
  const [newUserMessage, setNewUserMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordValue, setPasswordValue] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editMessage, setEditMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(true);
  const [accessOpen, setAccessOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(true);
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
  const [absenceForm, setAbsenceForm] = useState({ start_date: '', end_date: '', type: 'vacation', duration: 'full', note: '' });
  const [absenceMessage, setAbsenceMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [absenceOpen, setAbsenceOpen] = useState(true);
  const [profileForm, setProfileForm] = useState({
    birth_date: '',
    personnel_number: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    note: '',
  });
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [scheduleForm, setScheduleForm] = useState([
    { weekday: 0, minutes: 480 },
    { weekday: 1, minutes: 480 },
    { weekday: 2, minutes: 480 },
    { weekday: 3, minutes: 0 },
    { weekday: 4, minutes: 480 },
    { weekday: 5, minutes: 0 },
    { weekday: 6, minutes: 0 },
  ]);

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
  const { data: profileData } = useUserProfile(selectedUserId);
  const { data: scheduleData, refetch: refetchSchedule } = useUserSchedule(selectedUserId);

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

  const updateProfileMutation = useMutation({
    mutationFn: async ({
      userId,
      payload,
    }: {
      userId: number;
      payload: typeof profileForm;
    }) => {
      await api.patch(`/users/${userId}/profile`, payload);
    },
    onSuccess: () => {
      setProfileMessage({ type: 'success', text: 'Stammdaten gespeichert.' });
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

  const updateScheduleMutation = useMutation({
    mutationFn: async ({ userId, payload }: { userId: number; payload: { days: typeof scheduleForm } }) => {
      await api.put(`/users/${userId}/schedule`, payload);
    },
    onSuccess: () => {
      refetchSchedule();
      setScheduleMessage({ type: 'success', text: 'Arbeitszeiten gespeichert.' });
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
      payload: { start_date: string; end_date: string; type: string; duration: string; note?: string };
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

  useEffect(() => {
    if (profileData) {
      setProfileForm({
        birth_date: profileData.birth_date ?? '',
        personnel_number: profileData.personnel_number ?? '',
        phone: profileData.phone ?? '',
        address: profileData.address ?? '',
        city: profileData.city ?? '',
        postal_code: profileData.postal_code ?? '',
        note: profileData.note ?? '',
      });
    } else {
      setProfileForm({ birth_date: '', personnel_number: '', phone: '', address: '', city: '', postal_code: '', note: '' });
    }
  }, [profileData, selectedUserId]);

  useEffect(() => {
    if (scheduleData?.days) {
      setScheduleForm(scheduleData.days);
    }
  }, [scheduleData]);

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
    if (!absenceForm.start_date) {
      setAbsenceMessage({ type: 'error', text: 'Bitte Startdatum wählen.' });
      return;
    }
    const endDate = absenceForm.end_date || absenceForm.start_date;
    setAbsenceMessage(null);
    try {
      await createAbsenceMutation.mutateAsync({
        userId: selectedUserId,
        payload: {
          start_date: absenceForm.start_date,
          end_date: endDate,
          type: absenceForm.type,
          duration: absenceForm.duration,
          note: absenceForm.note || undefined,
        },
      });
      setAbsenceForm({ start_date: '', end_date: '', type: absenceForm.type, duration: absenceForm.duration, note: '' });
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

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) return;
    setProfileMessage(null);
    try {
      await updateProfileMutation.mutateAsync({ userId: selectedUserId, payload: profileForm });
      setProfileMessage({ type: 'success', text: 'Daten aktualisiert.' });
    } catch (error: any) {
      setProfileMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Profil konnte nicht gespeichert werden.',
      });
    }
  };

  const handleSaveSchedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedUserId) return;
    setScheduleMessage(null);
    try {
      await updateScheduleMutation.mutateAsync({ userId: selectedUserId, payload: { days: scheduleForm } });
      setScheduleMessage({ type: 'success', text: 'Arbeitszeiten gesichert.' });
    } catch (error: any) {
      setScheduleMessage({
        type: 'error',
        text: error?.response?.data?.message || 'Arbeitszeitplanung konnte nicht gespeichert werden.',
      });
    }
  };

  if (isEmployeesLoading) {
  return <p>Lade Mitarbeitende...</p>;
}

const employeeSelector = (
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
          Es wurden noch keine Mitarbeitenden angelegt. Nutze "Mitarbeiter anlegen", um den ersten Account zu erzeugen.
        </p>
      )}
    </div>
  </div>
);

return (
  <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">Admincenter</h2>
        <p className="text-sm text-slate-500">Kalender, Abwesenheiten und Stammdaten steuern</p>
      </div>
      <div className="rounded-full bg-white shadow px-2 py-1 text-sm">
        <button
          className={`px-3 py-1 rounded-full ${
            adminMenu === 'staff' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-blue-600'
          }`}
          onClick={() => setAdminMenu('staff')}
        >
          Mitarbeitendenanlage
        </button>
        <button
          className={`px-3 py-1 rounded-full ${
            adminMenu === 'planning' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-blue-600'
          }`}
          onClick={() => setAdminMenu('planning')}
        >
          Kalender & Planung
        </button>
      </div>
    </div>

    {adminMenu === 'staff' ? (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded border border-slate-200 bg-white p-4 space-y-4 text-sm">
          {employeeSelector}
          <div className="bg-slate-50 rounded-md">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left"
              onClick={() => setCreateOpen((prev) => !prev)}
            >
              <div>
                <h4 className="text-sm font-semibold text-slate-700">Mitarbeiter anlegen</h4>
                <p className="text-xs text-slate-500">Login, Rolle und Personalnummer erfassen</p>
              </div>
              <span className={`text-lg transition-transform ${createOpen ? 'rotate-180' : ''}`}>&#10094;</span>
            </button>
            {createOpen && (
              <form className="border-t border-slate-200 p-3 space-y-2" onSubmit={handleCreateUser}>
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
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-md shadow">
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <h4 className="text-base font-semibold text-slate-800">Profil & Zugang</h4>
                <p className="text-xs text-slate-500">Stammdaten, Rolle, Aktivierung und Passwort</p>
              </div>
              <span className={`text-lg transition-transform ${profileOpen ? 'rotate-180' : ''}`}>&#10094;</span>
            </button>
            {profileOpen && (
              <div className="border-t border-slate-100 p-4 space-y-4 text-sm">
                <form className="grid gap-2 md:grid-cols-2" onSubmit={handleUpdateUser}>
                  <label className="text-xs font-semibold text-slate-600">
                    Name
                    <input
                      type="text"
                      value={editUser.name}
                      onChange={(event) => setEditUser((prev) => ({ ...prev, name: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      required
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    E-Mail
                    <input
                      type="email"
                      value={editUser.email}
                      onChange={(event) => setEditUser((prev) => ({ ...prev, email: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      required
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Rolle
                    <select
                      value={editUser.role}
                      onChange={(event) => setEditUser((prev) => ({ ...prev, role: event.target.value as EmployeeSummary['role'] }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      disabled={!selectedUserId}
                    >
                      <option value="user">Mitarbeiter</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full rounded bg-indigo-600 py-2 text-white font-semibold disabled:opacity-50"
                      disabled={updateUserMutation.isPending || !selectedUserId}
                    >
                      {updateUserMutation.isPending ? 'Aktualisiere...' : 'Speichern'}
                    </button>
                  </div>
                </form>
                {editMessage && (
                  <p className={`text-xs ${editMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {editMessage.text}
                  </p>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <form className="space-y-2" onSubmit={handleResetPassword}>
                    <h5 className="text-xs font-semibold text-slate-600">Passwort setzen</h5>
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
                      <div className="flex items-center justify-between rounded-md bg-slate-50 p-3">
                        <div>
                          <p className="text-xs uppercase text-slate-500">Zugang</p>
                          <p className="font-semibold text-slate-800">
                            {selectedEmployee.active ? 'Aktiv' : 'Deaktiviert'} •{' '}
                            {selectedEmployee.role === 'admin' ? 'Admin' : 'Mitarbeiter'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleStatus}
                          disabled={toggleStatusMutation.isPending}
                          className={`rounded px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                            selectedEmployee.active ? 'bg-rose-600' : 'bg-emerald-600'
                          }`}
                        >
                          {toggleStatusMutation.isPending
                            ? 'Übernehme...'
                            : selectedEmployee.active
                            ? 'Zugang deaktivieren'
                            : 'Zugang reaktivieren'}
                        </button>
                      </div>
                      {statusMessage && (
                        <p className={`text-xs ${statusMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {statusMessage.text}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-md shadow">
            <button
              type="button"
              onClick={() => setAccessOpen((prev) => !prev)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <h4 className="text-base font-semibold text-slate-800">Personaldaten & Urlaub</h4>
                <p className="text-xs text-slate-500">Geburtsdatum, Personalnummer, Kontingent</p>
              </div>
              <span className={`text-lg transition-transform ${accessOpen ? 'rotate-180' : ''}`}>&#10094;</span>
            </button>
            {accessOpen && (
              <div className="border-t border-slate-100 p-4 space-y-4 text-sm">
                <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSaveProfile}>
                  <label className="text-xs font-semibold text-slate-600">
                    Geburtsdatum
                    <input
                      type="date"
                      value={profileForm.birth_date}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, birth_date: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Personalnummer
                    <input
                      type="text"
                      value={profileForm.personnel_number}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, personnel_number: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Telefon
                    <input
                      type="text"
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Straße & Nr.
                    <input
                      type="text"
                      value={profileForm.address}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, address: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    PLZ
                    <input
                      type="text"
                      value={profileForm.postal_code}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, postal_code: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600">
                    Ort
                    <input
                      type="text"
                      value={profileForm.city}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, city: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                      disabled={!selectedUserId}
                    />
                  </label>
                  <label className="text-xs font-semibold text-slate-600 md:col-span-2">
                    Notizen
                    <textarea
                      value={profileForm.note}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, note: event.target.value }))}
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-2"
                      rows={2}
                      disabled={!selectedUserId}
                    />
                  </label>
                  <button
                    type="submit"
                    className="md:col-span-2 rounded bg-blue-600 py-2 text-white font-semibold disabled:opacity-50"
                    disabled={!selectedUserId || updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? 'Speichere...' : 'Stammdaten sichern'}
                  </button>
                  {profileMessage && (
                    <p className={`text-xs ${profileMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {profileMessage.text}
                    </p>
                  )}
                </form>

                <form className="space-y-2" onSubmit={handleSaveAllowance}>
                  <h5 className="text-xs font-semibold text-slate-600">Urlaubskontingent</h5>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      value={allowanceValue}
                      onChange={(event) => setAllowanceValue(event.target.value)}
                      placeholder="Tage"
                      className="w-32 rounded border border-slate-300 px-2 py-1"
                      min={0}
                      max={80}
                    />
                    <button
                      type="submit"
                      className="rounded bg-emerald-700 px-3 py-2 text-white font-semibold disabled:opacity-50"
                      disabled={allowanceMutation.isPending || !selectedUserId}
                    >
                      {allowanceMutation.isPending ? 'Speichere...' : 'Speichern'}
                    </button>
                  </div>
                  {allowanceMessage && (
                    <p className={`text-xs ${allowanceMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {allowanceMessage.text}
                    </p>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            <div className="rounded border border-slate-200 bg-white p-4 text-sm">{employeeSelector}</div>
            <div className="bg-white rounded-md shadow">
              <button
                type="button"
                onClick={() => setScheduleOpen((prev) => !prev)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <h4 className="text-base font-semibold text-slate-800">Arbeitszeitplanung</h4>
                  <p className="text-xs text-slate-500">Stunden pro Wochentag (freie Tage bleiben ausgenommen)</p>
                </div>
                <span className={`text-lg transition-transform ${scheduleOpen ? 'rotate-180' : ''}`}>&#10094;</span>
              </button>
              {scheduleOpen && (
                <form className="border-t border-slate-100 p-4 space-y-3 text-sm" onSubmit={handleSaveSchedule}>
                  <div className="grid grid-cols-2 gap-3">
                    {scheduleForm.map((day, index) => {
                      const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
                      return (
                        <label key={day.weekday} className="text-xs font-semibold text-slate-600">
                          {weekdayLabels[index]}
                          <input
                            type="number"
                            min={0}
                            max={24}
                            step={0.25}
                            value={day.minutes / 60}
                            onChange={(event) => {
                              const hours = Number.parseFloat(event.target.value);
                              setScheduleForm((prev) => {
                                const next = [...prev];
                                next[index] = { ...day, minutes: Number.isNaN(hours) ? 0 : Math.round(hours * 60) };
                                return next;
                              });
                            }}
                            className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                            disabled={!selectedUserId}
                          />
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">0 Stunden markieren einen freien Tag; Abwesenheiten auf freien Tagen zählen nicht.</p>
                  <button
                    type="submit"
                    className="w-full rounded bg-emerald-700 py-2 text-white font-semibold disabled:opacity-50"
                    disabled={!selectedUserId || updateScheduleMutation.isPending}
                  >
                    {updateScheduleMutation.isPending ? 'Speichere...' : 'Arbeitszeiten speichern'}
                  </button>
                  {scheduleMessage && (
                    <p className={`text-xs ${scheduleMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {scheduleMessage.text}
                    </p>
                  )}
                </form>
              )}
            </div>
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
                <span className={`text-lg transition-transform ${manualOpen ? 'rotate-180' : ''}`}>&#10094;</span>
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
                  <p className="text-xs text-slate-500">
                    Urlaub, Kranktage, Remote oder Sonstiges – inklusive Zeiträume
                  </p>
                </div>
                <span className={`text-lg transition-transform ${absenceOpen ? 'rotate-180' : ''}`}>&#10094;</span>
              </button>
              {absenceOpen && (
                <div className="border-t border-slate-100 p-4 space-y-4 text-sm">
                  <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateAbsence}>
                    <label className="text-xs font-semibold text-slate-600">
                      Startdatum
                      <input
                        type="date"
                        value={absenceForm.start_date}
                        onChange={(event) => setAbsenceForm((prev) => ({ ...prev, start_date: event.target.value }))}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
                        required
                        disabled={!selectedUserId}
                      />
                    </label>
                    <label className="text-xs font-semibold text-slate-600">
                      Enddatum
                      <input
                        type="date"
                        value={absenceForm.end_date}
                        onChange={(event) => setAbsenceForm((prev) => ({ ...prev, end_date: event.target.value }))}
                        className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
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
                    <label className="text-xs font-semibold text-slate-600 md:col-span-2">
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
                                {absence.start_date === absence.end_date
                                  ? new Date(absence.start_date).toLocaleDateString('de-DE')
                                  : `${new Date(absence.start_date).toLocaleDateString('de-DE')} – ${new Date(
                                      absence.end_date
                                    ).toLocaleDateString('de-DE')}`}
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
              absences={absences}
              isLoading={isBookingLoading || isAbsenceLoading}
              onRefresh={() => {
                refetch();
                refetchAbsences();
              }}
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
            <div className="grid gap-4 md:grid-cols-2">
              <VacationOverview />
              <AttendanceOverview />
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
