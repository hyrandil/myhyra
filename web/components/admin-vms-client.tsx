"use client";

import axios, { AxiosError } from "axios";
import { useEffect, useState } from "react";

import AdminLogin from "./admin-login";
import { useAuth } from "./auth-context";

type Vm = {
  id: string;
  name: string;
  state: string;
  hostId: string;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  ownerId?: string;
};

export default function AdminVmsClient() {
  const { token, ready, logout } = useAuth();
  const [vms, setVms] = useState<Vm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  useEffect(() => {
    if (!ready || !token) {
      if (ready) {
        setVms([]);
      }
      return;
    }

    let cancelled = false;
    setError(null);
    axios
      .get<Vm[]>(`${baseUrl}/api/vms`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!cancelled) {
          setVms(res.data);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        if (err instanceof AxiosError && err.response?.status === 401) {
          logout();
          setError("Session expired. Please sign in again.");
        } else {
          setError("Failed to load virtual machines.");
        }
        setVms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, logout, ready, token]);

  if (!ready) {
    return <p className="text-sm text-slate-500">Loading admin console…</p>;
  }

  if (!token) {
    return <AdminLogin />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Virtual Machines</h1>
        <p className="text-sm text-slate-500">Manage customer workloads.</p>
      </header>
      {error && <p className="rounded border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
      <div className="rounded-lg bg-white shadow">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Name</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Host</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">State</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-slate-500">Resources</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {vms.map((vm) => (
              <tr key={vm.id}>
                <td className="px-4 py-2 text-sm font-medium text-slate-700">{vm.name}</td>
                <td className="px-4 py-2 text-sm text-slate-500">{vm.hostId}</td>
                <td className="px-4 py-2 text-sm text-slate-500">{vm.state}</td>
                <td className="px-4 py-2 text-sm text-slate-500">
                  {vm.cpuCores}C / {vm.memoryMb}MB / {vm.storageGb}GB
                </td>
              </tr>
            ))}
            {vms.length === 0 && (
              <tr>
                <td className="px-4 py-4 text-center text-sm text-slate-500" colSpan={4}>
                  No virtual machines found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
