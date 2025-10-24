"use client";

import axios from "axios";
import { useEffect, useState } from "react";

type Vm = {
  id: string;
  name: string;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  state: string;
  osImage: string;
  ip?: string;
};

export default function VmsClient() {
  const [vms, setVms] = useState<Vm[]>([]);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    axios
      .get(`${baseUrl}/api/vms`, { headers: { Authorization: "Bearer placeholder" } })
      .then((res) => setVms(res.data))
      .catch(() => setVms([]));
  }, []);

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-semibold">Virtual Machines</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {vms.map((vm) => (
          <article key={vm.id} className="rounded-lg bg-white p-4 shadow">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{vm.name}</h2>
                <p className="text-sm text-slate-500">{vm.osImage}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                {vm.state}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-slate-500">CPU</dt>
                <dd>{vm.cpuCores} cores</dd>
              </div>
              <div>
                <dt className="text-slate-500">Memory</dt>
                <dd>{vm.memoryMb} MB</dd>
              </div>
              <div>
                <dt className="text-slate-500">Storage</dt>
                <dd>{vm.storageGb} GB</dd>
              </div>
            </dl>
            <p className="mt-2 text-sm text-slate-500">IP: {vm.ip ?? "pending"}</p>
          </article>
        ))}
        {vms.length === 0 && <p className="text-sm text-slate-500">No VMs found.</p>}
      </div>
    </main>
  );
}
