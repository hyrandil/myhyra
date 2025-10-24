"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type HostCapacity = {
  id: string;
  hostname: string;
  totalCpuCores: number;
  totalRamMb: number;
  totalStorageGb: number;
  status: string;
};

type PricingRule = {
  id: string;
  cpuPriceCents: number;
  ramPriceCentsPerGb: number;
  storagePriceCentsPerGb: number;
  currency: string;
};

export default function ConfigurePage() {
  const [cpuCores, setCpuCores] = useState(2);
  const [memoryMb, setMemoryMb] = useState(4096);
  const [storageGb, setStorageGb] = useState(50);
  const [osImage, setOsImage] = useState("win2022-core");
  const [hosts, setHosts] = useState<HostCapacity[]>([]);
  const [pricing, setPricing] = useState<PricingRule[]>([]);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    axios.get(`${baseUrl}/api/pricing`).then((res) => setPricing(res.data)).catch(() => setPricing([]));
    axios
      .get(`${baseUrl}/api/public/hosts`)
      .then((res) => setHosts(res.data))
      .catch(() => setHosts([]));
  }, []);

  const activePricing = pricing[0];
  const totalPriceCents = useMemo(() => {
    if (!activePricing) return 0;
    const ramGb = Math.ceil(memoryMb / 1024);
    return (
      cpuCores * activePricing.cpuPriceCents +
      ramGb * activePricing.ramPriceCentsPerGb +
      storageGb * activePricing.storagePriceCentsPerGb
    );
  }, [activePricing, cpuCores, memoryMb, storageGb]);

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">Configure your virtual machine</h1>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <label className="block">
            <span className="text-sm font-medium">vCPU Cores</span>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={cpuCores}
              onChange={(event) => setCpuCores(Number(event.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Memory (MB)</span>
            <input
              type="number"
              min={1024}
              step={1024}
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={memoryMb}
              onChange={(event) => setMemoryMb(Number(event.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Storage (GB)</span>
            <input
              type="number"
              min={10}
              step={10}
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={storageGb}
              onChange={(event) => setStorageGb(Number(event.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">OS Image</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 p-2"
              value={osImage}
              onChange={(event) => setOsImage(event.target.value)}
            >
              <option value="win2022-core">Windows Server 2022 Core</option>
              <option value="ubuntu-22-04">Ubuntu 22.04 LTS</option>
              <option value="debian-12">Debian 12</option>
            </select>
          </label>
        </div>
        <aside className="space-y-4 rounded-lg bg-white p-6 shadow">
          <div>
            <h2 className="text-xl font-semibold">Summary</h2>
            <p className="mt-2 text-sm text-slate-600">Configure your VM and proceed to checkout.</p>
          </div>
          <div>
            <p className="text-sm text-slate-500">Estimated monthly price</p>
            <p className="text-3xl font-bold">
              {activePricing ? `${(totalPriceCents / 100).toFixed(2)} ${activePricing.currency}` : "--"}
            </p>
          </div>
          <button className="w-full rounded bg-indigo-600 py-2 text-white">Continue to Checkout</button>
        </aside>
      </div>
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Host capacity</h2>
        <p className="text-sm text-slate-500">Recently seen hosts and available compute.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {hosts.map((host) => (
            <article key={host.id} className="rounded border border-slate-200 p-4">
              <h3 className="font-semibold">{host.hostname}</h3>
              <p className="text-sm text-slate-500">Status: {host.status}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-slate-500">CPU</dt>
                  <dd>{host.totalCpuCores} cores</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Memory</dt>
                  <dd>{host.totalRamMb} MB</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Storage</dt>
                  <dd>{host.totalStorageGb} GB</dd>
                </div>
              </dl>
            </article>
          ))}
          {hosts.length === 0 && <p className="text-sm text-slate-500">No hosts available or unable to load.</p>}
        </div>
      </section>
    </main>
  );
}
