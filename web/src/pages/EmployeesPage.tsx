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
      <div className="bg-white shadow rounded p-4">
        <h2 className="font-semibold mb-2">Mitarbeitende anlegen</h2>
        <form className="grid grid-cols-1 md:grid-cols-2 gap-2" onSubmit={onCreate}>
          <input name="name" required placeholder="Name" className="border rounded px-2 py-1" />
          <input name="email" required placeholder="E-Mail" className="border rounded px-2 py-1" />
          <input name="password" required placeholder="Passwort" className="border rounded px-2 py-1" type="password" />
          <select name="role" className="border rounded px-2 py-1">
            <option value="employee">Mitarbeiter</option>
            <option value="lead">Teamleiter</option>
            <option value="hr">HR</option>
            <option value="admin">Administrator</option>
          </select>
          <input name="personnelNumber" placeholder="Personalnummer" className="border rounded px-2 py-1" />
          <input name="department" placeholder="Abteilung" className="border rounded px-2 py-1" />
          <input name="location" placeholder="Standort" className="border rounded px-2 py-1" />
          <button className="bg-blue-600 text-white px-3 py-2 rounded md:col-span-2" type="submit" disabled={createMutation.isPending}>
            Speichern
          </button>
        </form>
      </div>
      <div className="bg-white shadow rounded p-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold">Mitarbeitendenübersicht</h3>
          <form className="flex gap-2" onSubmit={onSearch}>
            <input name="q" placeholder="Suche" className="border rounded px-2 py-1" />
            <button className="px-3 py-1 bg-slate-200 rounded" type="submit">Filtern</button>
          </form>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th>Name</th>
              <th>Email</th>
              <th>Rolle</th>
              <th>Standort</th>
              <th>Abteilung</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((emp) => (
              <tr key={emp.id} className="border-t">
                <td>{emp.name}</td>
                <td>{emp.email}</td>
                <td>{emp.role}</td>
                <td>{emp.location ?? '-'}</td>
                <td>{emp.department ?? '-'}</td>
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
      </div>
    </div>
  );
}
