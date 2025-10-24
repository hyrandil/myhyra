"use client";

import axios, { AxiosError } from "axios";
import { useEffect, useState } from "react";

import AdminLogin from "./admin-login";
import { useAuth } from "./auth-context";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Host = {
  id: string;
  hostname: string;
  status: string;
  agentVersion: string;
  totalCpuCores: number;
  totalRamMb: number;
  totalStorageGb: number;
  lastSeenAt?: string;
};

type HostMetric = {
  ts: string;
  cpuPct: number;
};

export default function AdminHostsClient() {
  const { token, ready, logout } = useAuth();
  const [hosts, setHosts] = useState<Host[]>([]);
  const [selectedHost, setSelectedHost] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<HostMetric[]>([]);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

  useEffect(() => {
    if (!ready || !token) {
      if (ready) {
        setHosts([]);
        setSelectedHost(null);
      }
      return;
    }

    let cancelled = false;
    setError(null);
    axios
      .get<Host[]>(`${baseUrl}/api/hosts`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (cancelled) {
          return;
        }
        setHosts(res.data);
        if (res.data.length > 0) {
          setSelectedHost(res.data[0].id);
        } else {
          setSelectedHost(null);
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
          setError("Failed to load hosts.");
        }
        setHosts([]);
        setSelectedHost(null);
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, logout, ready, token]);

  useEffect(() => {
    if (!token || !selectedHost) {
      setMetrics([]);
      return;
    }

    let cancelled = false;
    axios
      .get<HostMetric[]>(`${baseUrl}/api/hosts/${selectedHost}/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (!cancelled) {
          setMetrics(res.data);
        }
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        if (err instanceof AxiosError && err.response?.status === 401) {
          logout();
          setError("Session expired. Please sign in again.");
        }
        setMetrics([]);
      });

    return () => {
      cancelled = true;
    };
  }, [baseUrl, logout, selectedHost, token]);

  if (!ready) {
    return <p className="text-sm text-slate-500">Loading admin console…</p>;
  }

  if (!token) {
    return <AdminLogin />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Hosts</h1>
        <p className="text-sm text-slate-500">Monitor connected Hyper-V hosts.</p>
      </header>
      {error && <p className="rounded border border-rose-100 bg-rose-50 p-3 text-sm text-rose-600">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {hosts.map((host) => (
          <article
            key={host.id}
            className={`rounded-lg border p-4 shadow-sm ${host.id === selectedHost ? "border-indigo-500" : "border-slate-200"}`}
            onClick={() => setSelectedHost(host.id)}
          >
            <h2 className="text-lg font-semibold">{host.hostname}</h2>
            <p className="text-sm text-slate-500">Status: {host.status}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
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
      </div>
      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">CPU Utilization</h2>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer>
            <AreaChart data={metrics.map((metric) => ({ ...metric, ts: new Date(metric.ts).toLocaleTimeString() }))}>
              <defs>
                <linearGradient id="cpu" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" hide />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={60} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} labelFormatter={(label) => `${label}`} />
              <Area type="monotone" dataKey="cpuPct" stroke="#6366f1" fill="url(#cpu)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
