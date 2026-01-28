import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCustomHoliday,
  fetchEmployees,
  fetchHolidayProfiles,
  fetchProfileHolidays,
  fetchSchedule,
  deleteLatestScheduleVersion,
  updateSchedule,
} from '../api';
import { Employee, HolidayEntry, HolidayProfile } from '../types';
import { useAuth } from '../AuthProvider';

const weekdayLabels = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const stateLabels: Record<string, string> = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
};

export function PlanningPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [dayMinutes, setDayMinutes] = useState<number[]>([480, 480, 480, 480, 480, 0, 0]);
  const [validFrom, setValidFrom] = useState<string>('');
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);
  const [holidayYear, setHolidayYear] = useState<number>(new Date().getFullYear());

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
    mutationFn: (payload: { userId: number; days: { weekday: number; minutes: number }[]; validFrom?: string }) =>
      updateSchedule(payload.userId, { days: payload.days, validFrom: payload.validFrom }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['daily'] });
    },
  });

  const deleteVersionMutation = useMutation({
    mutationFn: (userId: number) => deleteLatestScheduleVersion(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['daily'] });
    },
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
      const latestHistory = schedules.data.history?.[schedules.data.history.length - 1];
      setValidFrom(latestHistory?.validFrom ?? new Date().toISOString().slice(0, 10));
    } else {
      setDayMinutes(weekdayLabels.map((_, idx) => (idx < 5 ? 480 : 0)));
      setValidFrom(new Date().toISOString().slice(0, 10));
    }
  }, [schedules.data, selectedUser]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Arbeitszeiten</p>
          <h2 className="text-2xl font-semibold text-slate-900">Stundenplanung</h2>
          <p className="text-sm text-slate-500">Sollzeiten, Gültigkeit und Profile im Überblick.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Sollzeitprofil</h3>
            <p className="text-sm text-slate-500">Arbeitszeiten pro Wochentag für Mitarbeitende.</p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
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
        </div>

        <form
          className="mt-4 grid gap-4 lg:grid-cols-[1.4fr,1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedUser) return;
            const form = new FormData(e.currentTarget);
            const payload = weekdayLabels.map((_, idx) => {
              const hours = Number(form.get(`day-${idx}`) || 0);
              return { weekday: idx, minutes: Math.max(Math.round(hours * 60), 0) };
            });
            updateMutation.mutate({ userId: selectedUser, days: payload, validFrom: validFrom || undefined });
          }}
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-400">Wochentage</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                    <span className="text-xs text-slate-500">h</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Gültigkeit</p>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-sm text-slate-600">Änderung gültig ab</label>
                <input
                  type="date"
                  className="input"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
              Änderungen greifen ab dem gewählten Datum und überschreiben ältere Sollzeiten.
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn-ghost border border-slate-200"
                disabled={deleteVersionMutation.isPending || !selectedUser}
                onClick={() => selectedUser && deleteVersionMutation.mutate(selectedUser)}
              >
                Letzte Version löschen
              </button>
              <button className="btn-primary" type="submit" disabled={updateMutation.isPending}>
                Sollzeiten speichern
              </button>
              {schedules.data?.history?.length ? (
                <span className="text-xs text-slate-500">
                  Letzte Änderung: {schedules.data.history.at(-1)?.validFrom}
                </span>
              ) : null}
            </div>
          </div>
        </form>
      </div>

      {schedules.data?.history && schedules.data.history.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Historie</p>
          <div className="space-y-2">
            {schedules.data.history.map((entry) => (
              <div key={entry.id} className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">
                    {entry.validFrom} – {entry.validTo || 'aktuell'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {weekdayLabels
                      .map((label, idx) => `${label.slice(0, 2)}: ${(entry.days[idx]?.minutes ?? 0) / 60}h`)
                      .join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Feiertage</p>
            <h3 className="text-lg font-semibold text-slate-900">Feiertage pro Bundesland</h3>
            <p className="text-sm text-slate-500">Vorbelegte Profile bis 2099, individuell anpassbar.</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr,1.4fr]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Bundesland</label>
              <select
                className="input"
                value={selectedProfile ?? ''}
                onChange={(e) => setSelectedProfile(Number(e.target.value))}
              >
                {(profiles.data as HolidayProfile[] | undefined)?.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {stateLabels[profile.state] ?? profile.state}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Jahr</label>
              <input
                type="number"
                min="2020"
                max="2099"
                className="input"
                value={holidayYear}
                onChange={(e) => setHolidayYear(Number(e.target.value) || holidayYear)}
              />
            </div>
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">
              Alle Feiertage sind bereits bis 2099 eingetragen. Änderungen wirken nur für das gewählte Jahr.
            </div>
            <div className="border-t border-slate-200 pt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Neuen Feiertag hinzufügen</p>
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
                  e.currentTarget.reset();
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
                    Feiertag speichern
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Feiertage bearbeiten</p>
              <span className="text-xs text-slate-500">{holidayYear}</span>
            </div>
            <div className="max-h-[420px] overflow-auto divide-y">
              {(profileHolidays.data as HolidayEntry[] | undefined)?.length ? (
                (profileHolidays.data as HolidayEntry[]).map((holiday) => (
                  <form
                    key={`${holiday.date}-${holiday.name}`}
                    className="py-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr,1.4fr,0.8fr,auto]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!selectedProfile) return;
                      const form = new FormData(e.currentTarget);
                      addHolidayMutation.mutate({
                        id: selectedProfile,
                        payload: {
                          date: holiday.date,
                          name: String(form.get('name') || holiday.name),
                          duration: (form.get('duration') as 'full' | 'half') ?? holiday.duration,
                        },
                      });
                    }}
                  >
                    <input className="input" value={holiday.date} readOnly />
                    <input className="input" name="name" defaultValue={holiday.name} />
                    <select className="input" name="duration" defaultValue={holiday.duration}>
                      <option value="full">Ganzer Tag</option>
                      <option value="half">Halber Tag</option>
                    </select>
                    <button className="btn-ghost border border-slate-200" type="submit">
                      Speichern
                    </button>
                  </form>
                ))
              ) : (
                <p className="text-sm text-slate-500">Keine Feiertage geladen.</p>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
