import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
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
  upsertDepartmentMember,
} from '../api';
import { Employee } from '../types';

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [showDepartments, setShowDepartments] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const { data } = useQuery({ queryKey: ['employees', search], queryFn: () => fetchEmployees(search || undefined) });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: fetchDepartments });
  const { data: holidayProfiles } = useQuery({ queryKey: ['holiday-profiles'], queryFn: fetchHolidayProfiles });

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

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Personalverwaltung</p>
          <h2 className="text-2xl font-semibold">Team</h2>
          <p className="text-sm text-slate-500">Suche nach Name/Personalnummer und lege neue Accounts an</p>
        </div>
        <form className="flex gap-2" onSubmit={onSearch}>
          <input name="q" placeholder="Suche" className="input" />
          <button className="btn-ghost" type="submit">Filtern</button>
        </form>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold mb-3">Mitarbeiter anlegen</h2>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-3" onSubmit={onCreate}>
          <input name="firstName" required placeholder="Vorname" className="input" />
          <input name="lastName" required placeholder="Nachname" className="input" />
          <input name="email" required placeholder="E-Mail" className="input" />
          <input name="password" required placeholder="Passwort" className="input" type="password" />
          <select name="role" className="input">
            <option value="employee">Mitarbeiter</option>
            <option value="lead">Teamleiter</option>
            <option value="hr">HR</option>
            <option value="admin">Administrator</option>
          </select>
          <input name="personnelNumber" placeholder="Personalnummer" className="input" />
          <select name="department" className="input" defaultValue="">
            <option value="">Abteilung wählen (optional)</option>
            {(departments ?? []).map((dept) => (
              <option key={dept.id} value={dept.name}>
                {dept.name}
              </option>
            ))}
          </select>
          <select name="holidayProfileId" className="input" defaultValue="">
            <option value="">Feiertagsprofil wählen</option>
            {(holidayProfiles ?? []).map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} ({profile.state})
              </option>
            ))}
          </select>
          <input name="location" placeholder="Standort" className="input" />
          <input name="trackingStartDate" type="date" placeholder="Erfassungsbeginn" className="input" />
          <button className="btn-primary md:col-span-3" type="submit" disabled={createMutation.isPending}>
            Speichern
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Teamübersicht</h3>
            <span className="text-xs text-slate-500">{(data ?? []).length} Personen</span>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2">Name</th>
                  <th>Email</th>
                  <th>Rolle</th>
                  <th>Personalnr.</th>
                  <th>Standort</th>
                  <th>Abteilung</th>
                  <th>Feiertagsprofil</th>
                  <th>Erfassungsbeginn</th>
                  <th>Status</th>
                  <th>Aktion</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-slate-50">
                    <td className="py-2 font-medium">{[emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name}</td>
                    <td>{emp.email}</td>
                    <td>{emp.role}</td>
                    <td>{emp.personnelNumber || '—'}</td>
                    <td>{emp.location ?? '-'}</td>
                    <td>{emp.department ?? '-'}</td>
                    <td>{emp.holidayProfileId ? holidayProfiles?.find((p) => p.id === emp.holidayProfileId)?.name ?? 'Profil' : '—'}</td>
                    <td>{emp.trackingStartDate ?? '—'}</td>
                    <td>
                      <button
                        className={`px-2 py-1 rounded text-xs ${emp.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                        onClick={() =>
                          updateMutation.mutate({
                            id: emp.id,
                              payload: {
                                role: emp.role,
                                active: !emp.active,
                                firstName: emp.firstName ?? emp.name.split(' ')[0] ?? '',
                                lastName: emp.lastName ?? emp.name.split(' ').slice(1).join(' '),
                                email: emp.email,
                                location: emp.location,
                                department: emp.department,
                                trackingStartDate: emp.trackingStartDate,
                                personnelNumber: emp.personnelNumber,
                              },
                            })
                          }
                        >
                        {emp.active ? 'aktiv' : 'deaktiviert'}
                      </button>
                    </td>
                    <td>
                      <button className="btn-ghost text-xs" onClick={() => setSelected(emp)}>
                        Bearbeiten
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(data ?? []).length === 0 && <p className="text-sm text-slate-500 mt-2">Keine Personen angelegt.</p>}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="font-semibold">Details bearbeiten</h3>
          {selected ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: selected.id,
                  payload: {
                    role: selected.role,
                    active: selected.active,
                    firstName: selected.firstName ?? selected.name.split(' ')[0] ?? '',
                    lastName: selected.lastName ?? selected.name.split(' ').slice(1).join(' '),
                    email: selected.email,
                    location: selected.location,
                    department: selected.department,
                    trackingStartDate: selected.trackingStartDate,
                    personnelNumber: selected.personnelNumber,
                    holidayProfileId: selected.holidayProfileId,
                  },
                });
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
              </div>
              <input
                className="input"
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
                    {profile.name} ({profile.state})
                  </option>
                ))}
              </select>
              <input
                className="input"
                value={selected.location ?? ''}
                placeholder="Standort"
                onChange={(e) => setSelected({ ...selected, location: e.target.value })}
              />
              <input
                className="input"
                value={selected.trackingStartDate ?? ''}
                type="date"
                placeholder="Erfassungsbeginn"
                onChange={(e) => setSelected({ ...selected, trackingStartDate: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2 items-end">
                <div className="col-span-2">
                  <label className="text-sm text-slate-600">Neues Passwort setzen</label>
                  <input
                    className="input"
                    type="password"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    placeholder="Neues Passwort"
                  />
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
                  Zurücksetzen
                </button>
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" type="submit" disabled={updateMutation.isPending}>
                  Speichern
                </button>
                <button className="btn-ghost" type="button" onClick={() => setSelected(null)}>
                  Zurücksetzen
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-500">Wähle eine Person zum Bearbeiten.</p>
          )}
      </div>
    </div>

      <div className="card p-4">
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
