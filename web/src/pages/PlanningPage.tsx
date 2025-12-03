import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCustomHoliday,
  createHolidayProfile,
  fetchEmployees,
  fetchHolidayProfiles,
  fetchProfileHolidays,
  fetchSchedule,
  importHolidayProfile,
  updateSchedule,
} from '../api';
import { Employee, HolidayEntry, HolidayProfile } from '../types';
import { useAuth } from '../AuthProvider';

const weekdayLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

export function PlanningPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [dayMinutes, setDayMinutes] = useState<number[]>([480, 480, 480, 480, 480, 0, 0]);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [holidayYear, setHolidayYear] = useState<number>(new Date().getFullYear());
  const [holidayStart, setHolidayStart] = useState<number | ''>('');
  const [holidayEnd, setHolidayEnd] = useState<number | ''>('');

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

  const profiles = useQuery({
    queryKey: ['holiday-profiles'],
    queryFn: fetchHolidayProfiles,
    enabled: auth.hasRole('admin', 'hr'),
  });

  const profileHolidays = useQuery({
    queryKey: ['holiday-profile', selectedProfile, holidayYear],
    queryFn: () => fetchProfileHolidays(selectedProfile!, holidayYear),
    enabled: Boolean(selectedProfile),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { userId: number; days: { weekday: number; minutes: number }[] }) =>
      updateSchedule(payload.userId, payload.days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['daily'] });
    },
  });

  const profileCreateMutation = useMutation({
    mutationFn: (payload: { name: string; state: string; year?: number; years?: number[]; startYear?: number; endYear?: number }) =>
      createHolidayProfile(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['holiday-profiles'] });
    },
  });

  const profileImportMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { year?: number; years?: number[]; startYear?: number; endYear?: number } }) =>
      importHolidayProfile(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holiday-profile'] }),
  });

  const addHolidayMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { date: string; name: string; duration: 'full' | 'half' } }) =>
      addCustomHoliday(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['holiday-profile'] }),
  });

  useEffect(() => {
    if (!selectedUser && employees && employees.length > 0) {
      setSelectedUser(employees[0].id);
    }
  }, [selectedUser, employees]);

  useEffect(() => {
    if (!selectedProfile && profiles.data && profiles.data.length > 0) {
      setSelectedProfile(profiles.data[0].id);
    }
  }, [selectedProfile, profiles.data]);

  useEffect(() => {
    const base = new Map<number, number>();
    if (schedules.data?.days) {
      schedules.data.days.forEach((d) => base.set(d.weekday, d.minutes));
      setDayMinutes(weekdayLabels.map((_, idx) => base.get(idx) ?? (idx < 5 ? 480 : 0)));
    } else {
      setDayMinutes(weekdayLabels.map((_, idx) => (idx < 5 ? 480 : 0)));
    }
  }, [schedules.data, selectedUser]);

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
                  value={(dayMinutes[idx] ?? 0) / 60}
                  onChange={(e) => {
                    const clone = [...dayMinutes];
                    clone[idx] = Number(e.target.value) * 60;
                    setDayMinutes(clone);
                  }}
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

      <div className="card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Feiertage</p>
            <h3 className="text-lg font-semibold">Unternehmensweite Feiertagsprofile</h3>
            <p className="text-sm text-slate-500">Profile anlegen, Bundesland importieren, eigene Tage ergänzen.</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const yearValue = Number(form.get('year') || '') || undefined;
              const startYearValue = Number(form.get('startYear') || '') || undefined;
              const endYearValue = Number(form.get('endYear') || '') || undefined;
              profileCreateMutation.mutate({
                name: String(form.get('profileName') || ''),
                state: String(form.get('state') || ''),
                year: yearValue,
                startYear: startYearValue,
                endYear: endYearValue,
              });
              e.currentTarget.reset();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input name="profileName" placeholder="Profilname" className="input" required />
              <select name="state" className="input" required defaultValue="">
                <option value="">Bundesland</option>
                {[
                  ['BW', 'Baden-Württemberg'],
                  ['BY', 'Bayern'],
                  ['BE', 'Berlin'],
                  ['BB', 'Brandenburg'],
                  ['HB', 'Bremen'],
                  ['HH', 'Hamburg'],
                  ['HE', 'Hessen'],
                  ['MV', 'Mecklenburg-Vorpommern'],
                  ['NI', 'Niedersachsen'],
                  ['NW', 'Nordrhein-Westfalen'],
                  ['RP', 'Rheinland-Pfalz'],
                  ['SL', 'Saarland'],
                  ['SN', 'Sachsen'],
                  ['ST', 'Sachsen-Anhalt'],
                  ['SH', 'Schleswig-Holstein'],
                  ['TH', 'Thüringen'],
                ].map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
              <input name="year" type="number" min="2020" max="2100" placeholder="Jahr (optional)" className="input" />
              <input name="startYear" type="number" min="2020" max="2100" placeholder="Startjahr (optional)" className="input" />
              <input name="endYear" type="number" min="2020" max="2100" placeholder="Endjahr (optional)" className="input" />
            </div>
            <button className="btn-primary self-start" type="submit" disabled={profileCreateMutation.isPending}>
              Profil anlegen & Feiertage importieren
            </button>
          </form>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <select
                className="input flex-1"
                value={selectedProfile ?? ''}
                onChange={(e) => setSelectedProfile(Number(e.target.value))}
              >
                {(profiles.data as HolidayProfile[] | undefined)?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name} ({profile.state})
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="input w-24"
                value={holidayYear}
                onChange={(e) => setHolidayYear(Number(e.target.value) || holidayYear)}
              />
              <input
                type="number"
                className="input w-24"
                placeholder="Start"
                value={holidayStart}
                onChange={(e) => setHolidayStart(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <input
                type="number"
                className="input w-24"
                placeholder="Ende"
                value={holidayEnd}
                onChange={(e) => setHolidayEnd(e.target.value === '' ? '' : Number(e.target.value))}
              />
              <button
                className="btn-ghost"
                type="button"
                disabled={!selectedProfile || profileImportMutation.isPending}
                onClick={() =>
                  selectedProfile &&
                  profileImportMutation.mutate({
                    id: selectedProfile,
                    payload: {
                      year: holidayYear,
                      startYear: holidayStart || undefined,
                      endYear: holidayEnd || undefined,
                    },
                  })
                }
              >
                Jahr neu laden
              </button>
            </div>
            <form
              className="grid grid-cols-1 md:grid-cols-3 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedProfile) return;
                const form = new FormData(e.currentTarget);
                addHolidayMutation.mutate({
                  id: selectedProfile,
                  payload: {
                    date: String(form.get('holidayDate') || ''),
                    name: String(form.get('holidayName') || ''),
                    duration: (form.get('holidayDuration') as 'full' | 'half') ?? 'full',
                  },
                });
              }}
            >
              <input name="holidayDate" type="date" required className="input" />
              <input name="holidayName" required placeholder="Name" className="input" />
              <select name="holidayDuration" className="input" defaultValue="full">
                <option value="full">Ganzer Feiertag</option>
                <option value="half">Halber Feiertag</option>
              </select>
              <div className="md:col-span-3 flex justify-end">
                <button className="btn-primary" type="submit" disabled={addHolidayMutation.isPending || !selectedProfile}>
                  Individuellen Tag speichern
                </button>
              </div>
            </form>
            <div className="max-h-48 overflow-auto divide-y">
              {(profileHolidays.data as HolidayEntry[] | undefined)?.map((holiday) => (
                <div key={`${holiday.date}-${holiday.name}`} className="py-1 flex justify-between text-sm">
                  <span>
                    {holiday.date}: {holiday.name}
                  </span>
                  <span className="text-slate-500">{holiday.duration === 'half' ? '0,5' : '1,0'} Tag</span>
                </div>
              )) || <p className="text-sm text-slate-500">Keine Feiertage geladen.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
