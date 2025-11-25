import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { createEmployee, fetchEmployees, updateEmployee } from '../api';
import { Employee } from '../types';

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const { data } = useQuery({ queryKey: ['employees', search], queryFn: () => fetchEmployees(search || undefined) });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Employee> & { role: Employee['role'] } }) =>
      updateEmployee(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
  });

  const onCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    createMutation.mutate({
      name: String(form.get('name')),
      email: String(form.get('email')),
      password: String(form.get('password')),
      role: (form.get('role') as Employee['role']) ?? 'employee',
      personnelNumber: String(form.get('personnelNumber') || ''),
      department: String(form.get('department') || ''),
      location: String(form.get('location') || ''),
      trackingStartDate: String(form.get('trackingStartDate') || ''),
    });
    e.currentTarget.reset();
  };

  const onSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get('q') as string;
    setSearch(q);
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Personalverwaltung</p>
          <h2 className="text-2xl font-semibold">Mitarbeitende</h2>
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
          <input name="name" required placeholder="Name" className="input" />
          <input name="email" required placeholder="E-Mail" className="input" />
          <input name="password" required placeholder="Passwort" className="input" type="password" />
          <select name="role" className="input">
            <option value="employee">Mitarbeiter</option>
            <option value="lead">Teamleiter</option>
            <option value="hr">HR</option>
            <option value="admin">Administrator</option>
          </select>
          <input name="personnelNumber" placeholder="Personalnummer" className="input" />
          <input name="department" placeholder="Abteilung" className="input" />
          <input name="location" placeholder="Standort" className="input" />
          <input name="trackingStartDate" placeholder="Erfassungsbeginn (YYYY-MM-DD)" className="input" />
          <button className="btn-primary md:col-span-3" type="submit" disabled={createMutation.isPending}>
            Speichern
          </button>
        </form>
      </div>

      <div className="card p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Mitarbeitendenübersicht</h3>
          <span className="text-xs text-slate-500">{(data ?? []).length} Personen</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Rolle</th>
                <th>Standort</th>
                <th>Abteilung</th>
                <th>Erfassungsbeginn</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-slate-50">
                  <td className="py-2 font-medium">{emp.name}</td>
                  <td>{emp.email}</td>
                  <td>{emp.role}</td>
                  <td>{emp.location ?? '-'}</td>
                  <td>{emp.department ?? '-'}</td>
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
                            name: emp.name,
                            email: emp.email,
                            location: emp.location,
                            department: emp.department,
                          } as any,
                        })
                      }
                    >
                      {emp.active ? 'aktiv' : 'deaktiviert'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data ?? []).length === 0 && <p className="text-sm text-slate-500 mt-2">Keine Mitarbeitenden angelegt.</p>}
        </div>
      </div>
    </div>
  );
}
