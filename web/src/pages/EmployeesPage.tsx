import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  createDepartment,
  createEmployee,
  deleteDepartment,
  fetchDepartments,
  fetchEmployees,
  fetchHolidayProfiles,
  removeDepartmentMember,
  resetUserPassword,
  updateDepartment,
  updateDepartmentMemberRole,
  updateEmployee,
  updateEmployeeSettings,
  upsertDepartmentMember,
} from '../api';
import { Employee } from '../types';

type StrengthInfo = { label: string; className: string };

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

const getStrength = (value: string): StrengthInfo => {
  let score = 0;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value)) score += 1;
  if (/[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (!value) return { label: 'Bitte Passwort eingeben', className: 'text-slate-500' };
  if (score <= 2) return { label: 'Schwach', className: 'text-rose-600' };
  if (score === 3) return { label: 'Mittel', className: 'text-amber-600' };
  return { label: 'Stark', className: 'text-emerald-600' };
};

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showDepartments, setShowDepartments] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { data } = useQuery({ queryKey: ['employees', search], queryFn: () => fetchEmployees(search || undefined) });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const { data: holidayProfiles } = useQuery({ queryKey: ['holiday-profiles'], queryFn: fetchHolidayProfiles });

  const creationStrength = useMemo(() => getStrength(newPassword), [newPassword]);
  const resetStrength = useMemo(() => getStrength(resetPasswordValue), [resetPasswordValue]);
  const buildEmployeePayload = (emp: Employee, overrides: Partial<Employee> = {}) => ({
    role: (overrides.role ?? emp.role) as Employee['role'],
    active: overrides.active ?? emp.active,
    firstName: overrides.firstName ?? emp.firstName ?? emp.name.split(' ')[0] ?? '',
    lastName: overrides.lastName ?? emp.lastName ?? emp.name.split(' ').slice(1).join(' '),
    email: overrides.email ?? emp.email,
    location: overrides.location ?? emp.location,
    department: overrides.department ?? emp.department,
    requireLocation: overrides.requireLocation ?? emp.requireLocation,
    trackingStartDate: overrides.trackingStartDate ?? emp.trackingStartDate,
    personnelNumber: overrides.personnelNumber ?? emp.personnelNumber,
    holidayProfileId: overrides.holidayProfileId ?? emp.holidayProfileId,
    holidayProfileValidFrom: overrides.holidayProfileValidFrom ?? emp.holidayProfileValidFrom,
    endDate: overrides.endDate ?? emp.endDate,
  });

  const memberMutation = useMutation({
    mutationFn: ({ departmentId, userId, role }: { departmentId: number; userId: number; role?: 'member' | 'lead' | 'hr' }) =>
      upsertDepartmentMember(departmentId, { userId, role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: async (created, variables: any) => {
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (variables.department) {
        const targetDept = (departments ?? []).find((d) => d.name === variables.department);
        if (targetDept) {
          await memberMutation.mutateAsync({ departmentId: targetDept.id, userId: created.id, role: 'member' });
          queryClient.invalidateQueries({ queryKey: ['departments'] });
        }
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Employee> & { role: Employee['role'] } }) =>
      updateEmployee(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const settingsMutation = useMutation({
    mutationFn: ({ id, vacationAllowance }: { id: number; vacationAllowance: number }) =>
      updateEmployeeSettings(id, { vacation_allowance: vacationAllowance }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const departmentMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const memberRoleMutation = useMutation({
    mutationFn: ({ departmentId, userId, role }: { departmentId: number; userId: number; role: 'member' | 'lead' | 'hr' }) =>
      updateDepartmentMemberRole(departmentId, userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const memberRemoveMutation = useMutation({
    mutationFn: ({ departmentId, userId }: { departmentId: number; userId: number }) =>
      removeDepartmentMember(departmentId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
  const departmentUpdateMutation = useMutation({
    mutationFn: ({ id, name, description }: { id: number; name: string; description?: string }) =>
      updateDepartment(id, { name, description }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });
  const departmentDeleteMutation = useMutation({
    mutationFn: (id: number) => deleteDepartment(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['departments'] }),
  });

  const passwordResetMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) => resetUserPassword(id, password),
    onSuccess: () => setResetPasswordValue(''),
  });

  const onCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      firstName: String(form.get('firstName')),
      lastName: String(form.get('lastName')),
      email: String(form.get('email')),
      password: String(form.get('password')),
      role: (form.get('role') as Employee['role']) ?? 'employee',
      personnelNumber: String(form.get('personnelNumber') || ''),
      department: String(form.get('department') || ''),
      location: String(form.get('location') || ''),
      requireLocation: form.get('requireLocation') === 'on',
      vacationAllowance: Number(form.get('vacationAllowance') || 30),
      trackingStartDate: String(form.get('trackingStartDate') || ''),
      holidayProfileId: Number(form.get('holidayProfileId') || '') || undefined,
    });
    e.currentTarget.reset();
  };

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q') as string;
    setSearch(q);
  };

  useEffect(() => {
    setResetPasswordValue('');
  }, [selected?.id]);

  const activeEmployees = (data ?? []).filter((emp) => emp.active && (!emp.endDate || new Date(emp.endDate).getTime() > Date.now()));
  const separatedEmployees = (data ?? []).filter(
    (emp) => !emp.active || (emp.endDate && new Date(emp.endDate).getTime() <= Date.now())
  );

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Personalverwaltung</p>
            <h2 className="text-2xl font-semibold text-slate-900">Mitarbeitende & Organisation</h2>
            <p className="text-sm text-slate-500">
              Verwalte Nutzerprofile, Rollen, Standorte und Urlaubsansprüche an einem Ort.
            </p>
          </div>
          <form className="flex flex-1 items-center gap-2 lg:max-w-md" onSubmit={onSearch}>
            <div className="relative w-full">
              <input name="q" placeholder="Suche nach Name, E-Mail, Personalnummer" className="input w-full pr-10" />
              <span className="pointer-events-none absolute right-3 top-2.5 text-slate-400">⌘K</span>
            </div>
            <button className="btn-primary" type="submit">
              Filtern
            </button>
          </form>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Aktiv</p>
            <p className="text-2xl font-semibold text-slate-900">{activeEmployees.length}</p>
            <p className="text-xs text-slate-500">Aktive Mitarbeitende</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Ausgeschieden</p>
            <p className="text-2xl font-semibold text-slate-900">{separatedEmployees.length}</p>
            <p className="text-xs text-slate-500">Inaktive Profile</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase text-slate-500">Abteilungen</p>
            <p className="text-2xl font-semibold text-slate-900">{(departments ?? []).length}</p>
            <p className="text-xs text-slate-500">Teams & Genehmiger</p>
          </div>
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Neuen Mitarbeitenden anlegen</h3>
              <p className="text-sm text-slate-500">Schnelles Onboarding mit Rollen, Urlaub und Standortregel.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Schnellanlage
            </span>
          </div>
        </summary>
        <form className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3" onSubmit={onCreate}>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
            <p className="text-xs font-semibold uppercase text-slate-400">Basisdaten</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input name="firstName" required placeholder="Vorname" className="input" />
              <input name="lastName" required placeholder="Nachname" className="input" />
              <input name="email" required placeholder="E-Mail" className="input md:col-span-2" />
              <input name="personnelNumber" placeholder="Personalnummer" className="input" />
              <select name="role" className="input">
                <option value="employee">Mitarbeiter</option>
                <option value="lead">Teamleiter</option>
                <option value="hr">HR</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div className="space-y-1">
              <input
                name="password"
                required
                placeholder="Initiales Passwort"
                className="input"
                type="password"
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <p className={`text-xs ${creationStrength.className}`}>Passwort-Stärke: {creationStrength.label}</p>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-400">Organisation</p>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Jahresurlaub (Tage)</label>
              <input name="vacationAllowance" type="number" min="0" max="80" defaultValue={30} className="input" />
            </div>
            <select name="department" className="input" defaultValue="">
              <option value="">Abteilung wählen</option>
              {(departments ?? []).map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
            <select name="holidayProfileId" className="input" defaultValue="">
              <option value="">Feiertagsprofil</option>
              {(holidayProfiles ?? []).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ({stateLabels[profile.state] ?? profile.state})
                </option>
              ))}
            </select>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Feiertagsprofil gültig ab</label>
              <input name="holidayProfileValidFrom" type="date" className="input" />
            </div>
            <input name="location" placeholder="Standort" className="input" />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input name="requireLocation" type="checkbox" defaultChecked />
              Standortpflicht beim Stempeln
            </label>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Erfassungsbeginn</label>
              <input name="trackingStartDate" type="date" className="input" />
            </div>
          </div>
          <button className="btn-primary lg:col-span-3" type="submit" disabled={createMutation.isPending}>
            Mitarbeiter anlegen
          </button>
        </form>
      </details>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Teamübersicht</h3>
              <p className="text-sm text-slate-500">Übersicht aller aktiven Mitarbeitenden.</p>
            </div>
            <span className="text-xs text-slate-500">{activeEmployees.length} aktive Profile</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Mitarbeiter</th>
                  <th className="px-4 py-3">Rolle</th>
                  <th className="px-4 py-3">Abteilung</th>
                  <th className="px-4 py-3">Standort</th>
                  <th className="px-4 py-3">Erfassungsbeginn</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">
                        {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name}
                      </div>
                      <div className="text-xs text-slate-500">
                        {emp.email} • {emp.personnelNumber || 'Keine Personalnummer'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">{emp.department ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{emp.location ?? '—'}</div>
                      <div className="text-xs text-slate-400">
                        Standortpflicht: {emp.requireLocation === false ? 'Nein' : 'Ja'}
                      </div>
                    </td>
                    <td className="px-4 py-3">{emp.trackingStartDate ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          emp.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                        }`}
                        onClick={() =>
                          updateMutation.mutate({
                            id: emp.id,
                            payload: buildEmployeePayload(emp, { active: !emp.active }),
                          })
                        }
                      >
                        {emp.active ? 'Aktiv' : 'Inaktiv'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button className="btn-ghost text-xs" onClick={() => setSelected(emp)}>
                          Bearbeiten
                        </button>
                        <button
                          className="btn-ghost text-xs text-rose-600"
                          onClick={() =>
                            updateMutation.mutate({
                              id: emp.id,
                              payload: buildEmployeePayload(emp, {
                                active: false,
                                endDate: new Date().toISOString().slice(0, 10),
                              }),
                            })
                          }
                        >
                          Ausscheiden
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data ?? []).length === 0 && <p className="px-4 py-4 text-sm text-slate-500">Keine Personen angelegt.</p>}
          </div>
        </div>

        {separatedEmployees.length > 0 && (
          <details className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Ausgeschiedene Mitarbeitende</h3>
                <span className="text-xs text-slate-500">{separatedEmployees.length}</span>
              </div>
            </summary>
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">E-Mail</th>
                    <th className="px-4 py-3">Abteilung</th>
                    <th className="px-4 py-3">Austritt</th>
                    <th className="px-4 py-3 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {separatedEmployees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{emp.email}</td>
                      <td className="px-4 py-3">{emp.department ?? '—'}</td>
                      <td className="px-4 py-3">{emp.endDate ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="btn-ghost text-xs"
                          type="button"
                          onClick={() =>
                            updateMutation.mutate({
                              id: emp.id,
                              payload: buildEmployeePayload(emp, { active: true, endDate: '' }),
                            })
                          }
                        >
                          Reaktivieren
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Mitarbeitende bearbeiten</h3>
              <p className="text-sm text-slate-500">Profil, Urlaub, Standort und Zugangsdaten.</p>
            </div>
            {selected && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {selected.name}
              </span>
            )}
          </div>
          {selected ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: selected.id,
                  payload: buildEmployeePayload(selected),
                });
                if (selected.vacationAllowance !== undefined) {
                  settingsMutation.mutate({ id: selected.id, vacationAllowance: selected.vacationAllowance });
                }
              }}
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                  <p className="text-xs font-semibold uppercase text-slate-400">Profil</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input
                      className="input"
                      value={selected.firstName ?? ''}
                      placeholder="Vorname"
                      onChange={(e) => setSelected({ ...selected, firstName: e.target.value })}
                    />
                    <input
                      className="input"
                      value={selected.lastName ?? ''}
                      placeholder="Nachname"
                      onChange={(e) => setSelected({ ...selected, lastName: e.target.value })}
                    />
                    <input
                      className="input md:col-span-2"
                      value={selected.email}
                      onChange={(e) => setSelected({ ...selected, email: e.target.value })}
                    />
                    <input
                      className="input"
                      value={selected.personnelNumber ?? ''}
                      placeholder="Personalnummer"
                      onChange={(e) => setSelected({ ...selected, personnelNumber: e.target.value })}
                    />
                    <select
                      className="input"
                      value={selected.role}
                      onChange={(e) => setSelected({ ...selected, role: e.target.value as Employee['role'] })}
                    >
                      <option value="employee">Mitarbeiter</option>
                      <option value="lead">Teamleiter</option>
                      <option value="hr">HR</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Jahresurlaub (Tage)</label>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      max="80"
                      value={selected.vacationAllowance ?? 0}
                      onChange={(e) => setSelected({ ...selected, vacationAllowance: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-400">Organisation</p>
                  <select
                    className="input"
                    value={selected.department ?? ''}
                    onChange={(e) => setSelected({ ...selected, department: e.target.value || undefined })}
                  >
                    <option value="">Abteilung wählen</option>
                    {(departments ?? []).map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={selected.holidayProfileId ?? ''}
                    onChange={(e) =>
                      setSelected({ ...selected, holidayProfileId: Number(e.target.value) || undefined })
                    }
                  >
                    <option value="">Feiertagsprofil</option>
                    {(holidayProfiles ?? []).map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name} ({stateLabels[profile.state] ?? profile.state})
                      </option>
                    ))}
                  </select>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Feiertagsprofil gültig ab</label>
                    <input
                      className="input"
                      type="date"
                      value={selected.holidayProfileValidFrom ?? ''}
                      onChange={(e) => setSelected({ ...selected, holidayProfileValidFrom: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Austrittsdatum</label>
                    <input
                      className="input"
                      type="date"
                      value={selected.endDate ?? ''}
                      onChange={(e) => setSelected({ ...selected, endDate: e.target.value })}
                    />
                  </div>
                  <input
                    className="input"
                    value={selected.location ?? ''}
                    placeholder="Standort"
                    onChange={(e) => setSelected({ ...selected, location: e.target.value })}
                  />
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selected.requireLocation !== false}
                      onChange={(e) => setSelected({ ...selected, requireLocation: e.target.checked })}
                    />
                    Standortpflicht beim Stempeln
                  </label>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Erfassungsbeginn</label>
                    <input
                      className="input"
                      value={selected.trackingStartDate ?? ''}
                      type="date"
                      onChange={(e) => setSelected({ ...selected, trackingStartDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 lg:col-span-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Zugang & Sicherheit</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:items-end">
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-xs text-slate-500">Neues Passwort setzen</label>
                      <input
                        className="input"
                        type="password"
                        value={resetPasswordValue}
                        onChange={(e) => setResetPasswordValue(e.target.value)}
                        placeholder="Neues Passwort"
                      />
                      <p className={`text-xs ${resetStrength.className}`}>Passwort-Stärke: {resetStrength.label}</p>
                    </div>
                    <button
                      className="btn-ghost"
                      type="button"
                      disabled={!resetPasswordValue || passwordResetMutation.isPending}
                      onClick={() => {
                        if (!selected || !resetPasswordValue) return;
                        passwordResetMutation.mutate({ id: selected.id, password: resetPasswordValue });
                      }}
                    >
                      Passwort zurücksetzen
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-primary" type="submit" disabled={updateMutation.isPending}>
                  Änderungen speichern
                </button>
                <button className="btn-ghost" type="button" onClick={() => setSelected(null)}>
                  Auswahl zurücksetzen
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Wähle eine Person zum Bearbeiten.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Abteilungen</p>
            <h3 className="font-semibold">Teams & Genehmiger</h3>
          </div>
          <button className="btn-ghost" type="button" onClick={() => setShowDepartments((v) => !v)}>
            {showDepartments ? 'Bereich ausblenden' : 'Bereich öffnen'}
          </button>
        </div>
        {showDepartments && (
          <>
            <form
              className="flex gap-2 mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const name = String(form.get('name') || '');
                const description = String(form.get('description') || '');
                if (name) {
                  departmentMutation.mutate({ name, description });
                  e.currentTarget.reset();
                }
              }}
            >
              <input name="name" placeholder="Neue Abteilung" className="input" />
              <input name="description" placeholder="Beschreibung" className="input" />
              <button className="btn-primary" type="submit" disabled={departmentMutation.isPending}>
                Anlegen
              </button>
            </form>
            <div className="space-y-4">
              {(departments ?? []).map((dept) => (
                <div key={dept.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{dept.name}</p>
                      <p className="text-sm text-slate-500">{dept.description || 'Keine Beschreibung'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost text-xs"
                        onClick={() => setEditingDeptId(editingDeptId === dept.id ? null : dept.id)}
                      >
                        {editingDeptId === dept.id ? 'Schließen' : 'Bearbeiten'}
                      </button>
                      {editingDeptId === dept.id && (
                        <button
                          className="btn-ghost text-xs text-rose-600"
                          type="button"
                          onClick={() => {
                            if (confirm('Abteilung wirklich löschen? Zuordnungen werden entfernt.')) {
                              departmentDeleteMutation.mutate(dept.id);
                            }
                          }}
                        >
                          Löschen
                        </button>
                      )}
                    </div>
                  </div>
                  {editingDeptId === dept.id && (
                    <form
                      className="flex gap-2 items-center mt-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        const name = String(form.get('name') || dept.name);
                        const description = String(form.get('description') || '');
                        departmentUpdateMutation.mutate({ id: dept.id, name, description });
                      }}
                    >
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input name="name" defaultValue={dept.name} className="input" />
                        <input
                          name="description"
                          defaultValue={dept.description || ''}
                          className="input text-sm"
                          placeholder="Beschreibung"
                        />
                      </div>
                      <button className="btn-primary text-xs" type="submit" disabled={departmentUpdateMutation.isPending}>
                        Speichern
                      </button>
                    </form>
                  )}
                  <form
                    className="flex gap-2 mt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = new FormData(e.currentTarget);
                      const userId = Number(form.get('userId'));
                      const role = (form.get('role') as 'member' | 'lead' | 'hr') ?? 'member';
                      if (!Number.isNaN(userId)) {
                        memberMutation.mutate({ departmentId: dept.id, userId, role });
                      }
                    }}
                  >
                    <select name="userId" className="input">
                      <option value="">Mitarbeiter auswählen</option>
                      {(data ?? []).map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.personnelNumber || emp.email})
                        </option>
                      ))}
                    </select>
                    <select name="role" className="input">
                      <option value="member">Mitarbeiter</option>
                      <option value="lead">Teamleiter</option>
                      <option value="hr">HR</option>
                    </select>
                    <button className="btn-ghost" type="submit" disabled={memberMutation.isPending}>
                      Hinzufügen
                    </button>
                  </form>
                  <div className="mt-3 divide-y">
                    {dept.members.length === 0 && <p className="text-sm text-slate-500">Noch keine Zuordnungen.</p>}
                    {dept.members.map((member) => (
                      <div key={member.userId} className="flex justify-between items-center py-2 text-sm">
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-slate-500">{member.email}</p>
                        </div>
                        <div className="flex gap-2 items-center">
                          <select
                            className="input"
                            value={member.role}
                            onChange={(e) =>
                              memberRoleMutation.mutate({
                                departmentId: dept.id,
                                userId: member.userId,
                                role: e.target.value as 'member' | 'lead' | 'hr',
                              })
                            }
                          >
                            <option value="member">Mitarbeiter</option>
                            <option value="lead">Teamleiter</option>
                            <option value="hr">HR</option>
                          </select>
                          <button
                            className="btn-ghost text-xs"
                            onClick={() => memberRemoveMutation.mutate({ departmentId: dept.id, userId: member.userId })}
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {(departments ?? []).length === 0 && <p className="text-sm text-slate-500">Noch keine Abteilungen.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
