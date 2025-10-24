"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import type { HostSummary, PricingRule } from "../../lib/api";
import { ApiError, getHosts, getPricing } from "../../lib/api";
import { deriveHostStatus, formatRelativeLastSeen } from "../../lib/utils";
import AdminLogin from "../admin-login";
import { useAuth } from "../auth-context";
import { CapacityBar } from "./capacity-bar";
import { HostStatusBadge } from "./host-status-badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

const REFRESH_INTERVAL = 10_000;

type HostWithComputed = HostSummary & {
  computedStatus: string;
  telemetrySnapshot: {
    cpuPct: number | null;
    memPct: number | null;
    memUsedMb: number | null;
    storageUsedGb: number | null;
    storagePct: number | null;
    sampledAt?: string | null;
  };
};

const numberFormatter = new Intl.NumberFormat("en-US");
const decimalFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 animate-pulse rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 h-96 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { token, ready, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [sortKey, setSortKey] = useState<"hostname" | "status" | "cpu">("hostname");
  const [search, setSearch] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (token) {
      setSessionExpired(false);
    }
  }, [token]);

  const shouldFetch = ready && Boolean(token);

  const {
    data: hosts,
    error: hostsError,
    isLoading: hostsLoading,
    mutate: refreshHosts,
  } = useSWR<HostSummary[]>(
    shouldFetch ? ["hosts", token] : null,
    ([, authToken]) => getHosts(authToken),
    {
      refreshInterval: REFRESH_INTERVAL,
      keepPreviousData: true,
    },
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    if (hostsError instanceof ApiError && (hostsError.status === 401 || hostsError.status === 403)) {
      setSessionExpired(true);
      logout();
    }
  }, [hostsError, logout, token]);

  const { data: pricing } = useSWR<PricingRule>(
    shouldFetch ? ["pricing", token] : null,
    ([, authToken]) => getPricing(authToken),
    {
      refreshInterval: 60_000,
    },
  );

  if (!ready) {
    return <DashboardSkeleton />;
  }

  if (!token) {
    return (
      <div className="space-y-4">
        {sessionExpired && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Session expired. Please sign in again.
          </div>
        )}
        <AdminLogin />
      </div>
    );
  }

  const normalizedHosts = useMemo<HostWithComputed[] | undefined>(() => {
    if (!hosts) {
      return undefined;
    }

    return hosts.map((host) => {
      const computedStatus = deriveHostStatus(host.status, host.lastSeenAt);
      const cpuPct = host.telemetry?.cpuPct ?? null;
      const memUsedMb = host.telemetry?.memUsedMb ?? null;
      const memPct = host.telemetry?.memPct ?? (memUsedMb != null && host.totalRamMb > 0
        ? Math.round((memUsedMb / host.totalRamMb) * 1000) / 10
        : null);
      const storageUsedGb = host.telemetry?.storageUsedGb ?? null;
      const storagePct = storageUsedGb != null && host.totalStorageGb > 0
        ? Math.round((storageUsedGb / host.totalStorageGb) * 1000) / 10
        : null;

      return {
        ...host,
        computedStatus,
        telemetrySnapshot: {
          cpuPct,
          memPct,
          memUsedMb,
          storageUsedGb,
          storagePct,
          sampledAt: host.telemetry?.sampledAt ?? host.lastSeenAt,
        },
      };
    });
  }, [hosts]);

  const filteredHosts = useMemo(() => {
    if (!normalizedHosts) {
      return [] as HostWithComputed[];
    }

    const needle = search.trim().toLowerCase();

    const matches = normalizedHosts.filter((host) => {
      const matchesStatus = statusFilter === "all" || host.computedStatus === statusFilter;
      const matchesSearch =
        needle.length === 0 ||
        host.hostname.toLowerCase().includes(needle) ||
        host.ip.toLowerCase().includes(needle) ||
        (host.fqdn?.toLowerCase().includes(needle) ?? false);
      return matchesStatus && matchesSearch;
    });

    return matches.sort((a, b) => {
      switch (sortKey) {
        case "status":
          return a.computedStatus.localeCompare(b.computedStatus);
        case "cpu":
          return (b.telemetrySnapshot.cpuPct ?? -1) - (a.telemetrySnapshot.cpuPct ?? -1);
        default:
          return a.hostname.localeCompare(b.hostname);
      }
    });
  }, [normalizedHosts, search, sortKey, statusFilter]);

  const aggregates = useMemo(() => {
    const initial = {
      totalHosts: 0,
      online: 0,
      offline: 0,
      totalCpu: 0,
      usedCpu: 0,
      totalRamMb: 0,
      usedRamMb: 0,
      totalStorageGb: 0,
      usedStorageGb: 0,
      lastUpdated: null as Date | null,
    };

    if (!normalizedHosts) {
      return initial;
    }

    return normalizedHosts.reduce((acc, host) => {
      acc.totalHosts += 1;
      if (host.computedStatus === "online") {
        acc.online += 1;
      } else {
        acc.offline += 1;
      }

      acc.totalCpu += host.totalCpuCores;
      acc.totalRamMb += host.totalRamMb;
      acc.totalStorageGb += host.totalStorageGb;

      const cpuPct = host.telemetrySnapshot.cpuPct;
      acc.usedCpu += cpuPct != null ? (host.totalCpuCores * cpuPct) / 100 : host.capacity.usedCpuCores;

      const memUsed = host.telemetrySnapshot.memUsedMb;
      acc.usedRamMb += memUsed ?? host.capacity.usedRamMb;

      const storageUsed = host.telemetrySnapshot.storageUsedGb;
      acc.usedStorageGb += storageUsed ?? host.capacity.usedStorageGb;

      const sample = host.telemetrySnapshot.sampledAt ?? host.lastSeenAt;
      if (sample) {
        const sampleDate = new Date(sample);
        if (!acc.lastUpdated || sampleDate > acc.lastUpdated) {
          acc.lastUpdated = sampleDate;
        }
      }

      return acc;
    }, initial);
  }, [normalizedHosts]);

  const fleetCpuPct = aggregates.totalCpu > 0 ? (aggregates.usedCpu / aggregates.totalCpu) * 100 : 0;
  const fleetRamPct = aggregates.totalRamMb > 0 ? (aggregates.usedRamMb / aggregates.totalRamMb) * 100 : 0;
  const fleetStoragePct = aggregates.totalStorageGb > 0 ? (aggregates.usedStorageGb / aggregates.totalStorageGb) * 100 : 0;

  const recentActivity = useMemo(() => {
    if (!normalizedHosts) {
      return [] as HostWithComputed[];
    }

    return [...normalizedHosts]
      .filter((host) => host.lastSeenAt || host.telemetrySnapshot.sampledAt)
      .sort((a, b) => {
        const aTs = new Date(a.telemetrySnapshot.sampledAt ?? a.lastSeenAt ?? 0).getTime();
        const bTs = new Date(b.telemetrySnapshot.sampledAt ?? b.lastSeenAt ?? 0).getTime();
        return bTs - aTs;
      })
      .slice(0, 10);
  }, [normalizedHosts]);

  const errorMessage = useMemo(() => {
    if (!hostsError) {
      return null;
    }

    if (hostsError instanceof ApiError) {
      if (hostsError.status === 401 || hostsError.status === 403) {
        return null;
      }
      return hostsError.message || "Failed to load hosts.";
    }

    return hostsError instanceof Error ? hostsError.message : "Failed to load hosts.";
  }, [hostsError]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Control plane overview</h1>
          <p className="text-sm text-slate-500">
            Monitor host health, telemetry, and provisioning capacity across your Hyper-V fleet.
          </p>
          {aggregates.lastUpdated && (
            <p className="mt-1 text-xs text-slate-400">
              Last heartbeat {formatDistanceToNow(aggregates.lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refreshHosts()} disabled={hostsLoading}>
            Refresh
          </Button>
          <Button variant="ghost" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total hosts" value={aggregates.totalHosts} description="Registered Hyper-V nodes" />
        <StatCard title="Online" value={aggregates.online} description="Responded within 90 seconds" />
        <StatCard title="Offline" value={aggregates.offline} description="Awaiting heartbeat" />
        <Card>
          <CardHeader>
            <CardTitle>Active pricing</CardTitle>
            <CardDescription>Current CPU, memory, and storage rates</CardDescription>
          </CardHeader>
          <CardContent>
            {pricing ? (
              <dl className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <dt>Currency</dt>
                  <dd>{pricing.currency}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>CPU</dt>
                  <dd>{(pricing.cpuPriceCents / 100).toFixed(2)} {pricing.currency} / core</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Memory</dt>
                  <dd>{(pricing.ramPriceCentsPerGb / 100).toFixed(2)} {pricing.currency} / GB</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Storage</dt>
                  <dd>{(pricing.storagePriceCentsPerGb / 100).toFixed(2)} {pricing.currency} / GB</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-500">No pricing rule configured.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Hosts</CardTitle>
                <CardDescription>Filter, search, and inspect live telemetry.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search hostname or IP"
                  className="w-full sm:w-64"
                  aria-label="Search hosts"
                />
                <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  Sort by
                  <select
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as typeof sortKey)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm shadow-sm"
                  >
                    <option value="hostname">Hostname</option>
                    <option value="status">Status</option>
                    <option value="cpu">CPU usage</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="inline-flex overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-1">
              <FilterPill active={statusFilter === "all"} label="All" onClick={() => setStatusFilter("all")} />
              <FilterPill active={statusFilter === "online"} label="Online" onClick={() => setStatusFilter("online")} />
              <FilterPill active={statusFilter === "offline"} label="Offline" onClick={() => setStatusFilter("offline")} />
            </div>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                <div className="flex items-center justify-between gap-3">
                  <span>{errorMessage}</span>
                  <Button variant="outline" onClick={() => refreshHosts()}>Retry</Button>
                </div>
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>IP / FQDN</TableHead>
                    <TableHead>CPU</TableHead>
                    <TableHead>Memory</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>VMs</TableHead>
                    <TableHead>Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hostsLoading && !normalizedHosts && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                        Loading hosts…
                      </TableCell>
                    </TableRow>
                  )}
                  {!hostsLoading && filteredHosts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-sm text-slate-500">
                        No hosts match your filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredHosts.map((host) => {
                    const totalRamGb = host.totalRamMb / 1024;
                    const usedRamGb = host.telemetrySnapshot.memUsedMb != null
                      ? host.telemetrySnapshot.memUsedMb / 1024
                      : null;
                    return (
                      <TableRow key={host.id}>
                        <TableCell>
                          <HostStatusBadge status={host.status} lastSeenAt={host.lastSeenAt} />
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">{host.hostname}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-slate-500">
                            <span>{host.ip}</span>
                            {host.fqdn && <span>{host.fqdn}</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {host.telemetrySnapshot.cpuPct != null ? `${host.telemetrySnapshot.cpuPct.toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell>
                          {usedRamGb != null
                            ? `${decimalFormatter.format(usedRamGb)}/${decimalFormatter.format(totalRamGb)} GB`
                            : `${decimalFormatter.format(host.capacity.usedRamMb / 1024)}/${decimalFormatter.format(totalRamGb)} GB`}
                        </TableCell>
                        <TableCell>
                          {host.telemetrySnapshot.storageUsedGb != null
                            ? `${decimalFormatter.format(host.telemetrySnapshot.storageUsedGb)}/${decimalFormatter.format(host.totalStorageGb)} GB`
                            : `${decimalFormatter.format(host.capacity.usedStorageGb)}/${decimalFormatter.format(host.totalStorageGb)} GB`}
                        </TableCell>
                        <TableCell>{numberFormatter.format(host.vmCount)}</TableCell>
                        <TableCell className="text-sm text-slate-500">
                          {formatRelativeLastSeen(host.telemetrySnapshot.sampledAt ?? host.lastSeenAt) ?? "Never"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fleet capacity</CardTitle>
            <CardDescription>Aggregate utilisation across all hosts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CapacityBar cpuPct={fleetCpuPct} ramPct={fleetRamPct} storagePct={fleetStoragePct} />
            <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div>
                <dt>CPU (cores)</dt>
                <dd>
                  {numberFormatter.format(Math.round(aggregates.usedCpu))}/
                  {numberFormatter.format(aggregates.totalCpu)}
                </dd>
              </div>
              <div>
                <dt>Memory (GB)</dt>
                <dd>
                  {decimalFormatter.format(aggregates.usedRamMb / 1024)}/
                  {decimalFormatter.format(aggregates.totalRamMb / 1024)}
                </dd>
              </div>
              <div>
                <dt>Storage (GB)</dt>
                <dd>
                  {decimalFormatter.format(aggregates.usedStorageGb)}/
                  {decimalFormatter.format(aggregates.totalStorageGb)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent heartbeats</CardTitle>
          <CardDescription>Latest check-ins from any host</CardDescription>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No heartbeat data recorded yet.</p>
          ) : (
            <ul className="space-y-3 text-sm text-slate-600">
              {recentActivity.map((host) => (
                <li key={host.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">{host.hostname}</p>
                    <p className="text-xs text-slate-500">{host.ip}</p>
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatRelativeLastSeen(host.telemetrySnapshot.sampledAt ?? host.lastSeenAt) ?? "No heartbeat"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, description }: { title: string; value: number; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-slate-800">{numberFormatter.format(value)}</p>
      </CardContent>
    </Card>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1 text-sm font-medium transition ${
        active ? "bg-white text-slate-900 shadow" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
