"use client";

import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import type { HostSummary, PricingRule } from "../../lib/api";
import { ApiError, getHosts, getPricing } from "../../lib/api";
import AdminLogin from "../admin-login";
import { useAuth } from "../auth-context";
import { CapacityBar } from "./capacity-bar";
import { HostStatusBadge } from "./host-status-badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { deriveHostStatus } from "../../lib/utils";

type HostWithStatus = HostSummary & { computedStatus: string };

function useHostData(token: string | null) {
  return useSWR<HostSummary[]>(
    token ? ["hosts", token] : null,
    ([, authToken]: readonly [string, string]) => getHosts(authToken),
    {
      refreshInterval: 10_000,
    },
  );
}

function usePricingData() {
  return useSWR<PricingRule>("pricing", getPricing);
}

export default function AdminDashboard() {
  const { token, ready, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [search, setSearch] = useState("");

  const {
    data: hosts,
    error: hostsError,
    isLoading: hostsLoading,
    mutate,
  } = useHostData(token);
  const { data: pricing } = usePricingData();

  if (!ready) {
    return <p className="text-sm text-slate-500">Loading admin console…</p>;
  }

  if (!token) {
    return <AdminLogin />;
  }

  useEffect(() => {
    if (ready && token) {
      void mutate();
    }
  }, [ready, token, mutate]);

  if (hostsError instanceof ApiError && (hostsError.status === 401 || hostsError.status === 403)) {
    logout();
    return <AdminLogin />;
  }

  const normalizedHosts: HostWithStatus[] | undefined = hosts?.map((host) => ({
    ...host,
    computedStatus: deriveHostStatus(host.status, host.lastSeenAt),
  }));

  const filteredHosts = useMemo(() => {
    if (!normalizedHosts) {
      return [] as HostWithStatus[];
    }
    return normalizedHosts.filter((host) => {
      const matchesStatus =
        statusFilter === "all" || host.computedStatus.toLowerCase() === statusFilter;
      const matchesSearch =
        search.trim().length === 0 ||
        host.hostname.toLowerCase().includes(search.toLowerCase()) ||
        (host.ip?.toLowerCase().includes(search.toLowerCase()) ?? false);
      return matchesStatus && matchesSearch;
    });
  }, [normalizedHosts, search, statusFilter]);

  const aggregates = useMemo(() => {
    const totalHosts = normalizedHosts?.length ?? 0;
    const online = normalizedHosts?.filter((h) => h.computedStatus === "online").length ?? 0;
    const offline = totalHosts - online;

    const totalCpu = normalizedHosts?.reduce((sum, host) => sum + host.totalCpuCores, 0) ?? 0;
    const usedCpu = normalizedHosts?.reduce((sum, host) => sum + host.capacity.usedCpuCores, 0) ?? 0;
    const totalRam = normalizedHosts?.reduce((sum, host) => sum + host.totalRamMb, 0) ?? 0;
    const usedRam = normalizedHosts?.reduce((sum, host) => sum + host.capacity.usedRamMb, 0) ?? 0;
    const totalStorage = normalizedHosts?.reduce((sum, host) => sum + host.totalStorageGb, 0) ?? 0;
    const usedStorage = normalizedHosts?.reduce((sum, host) => sum + host.capacity.usedStorageGb, 0) ?? 0;

    const fleetCpuPct = totalCpu > 0 ? (usedCpu / totalCpu) * 100 : 0;
    const fleetRamPct = totalRam > 0 ? (usedRam / totalRam) * 100 : 0;
    const fleetStoragePct = totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0;

    const recentActivity = [...(normalizedHosts ?? [])]
      .filter((h) => h.lastSeenAt)
      .sort((a, b) => new Date(b.lastSeenAt ?? 0).getTime() - new Date(a.lastSeenAt ?? 0).getTime())
      .slice(0, 10);

    return {
      totalHosts,
      online,
      offline,
      totalCpu,
      totalRam,
      totalStorage,
      usedCpu,
      usedRam,
      usedStorage,
      fleetCpuPct,
      fleetRamPct,
      fleetStoragePct,
      recentActivity,
    };
  }, [normalizedHosts]);

  const errorMessage = hostsError
    ? hostsError instanceof ApiError
      ? hostsError.message || "Failed to load hosts."
      : "Failed to load hosts."
    : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Infrastructure Overview</h1>
          <p className="text-sm text-slate-500">Live status of connected Hyper-V hosts and capacity trends.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => mutate()} aria-label="Refresh hosts">
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Hosts" value={aggregates.totalHosts} description="All enrolled Hyper-V nodes" />
        <StatCard title="Online" value={aggregates.online} description="Responding within 90s" />
        <StatCard title="Offline" value={aggregates.offline} description="Awaiting heartbeat" />
        <Card>
          <CardHeader>
            <CardTitle>Active Pricing</CardTitle>
            <CardDescription>CPU, memory, and storage rates in effect</CardDescription>
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
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Hosts</CardTitle>
              <CardDescription>Search, filter, and inspect host capacity.</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search hostname or IP"
                className="w-full sm:w-64"
                aria-label="Search hosts"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "online" ? "default" : "outline"}
                  onClick={() => setStatusFilter("online")}
                >
                  Online
                </Button>
                <Button
                  type="button"
                  variant={statusFilter === "offline" ? "default" : "outline"}
                  onClick={() => setStatusFilter("offline")}
                >
                  Offline
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {errorMessage && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
                <div className="flex items-center justify-between">
                  <span>{errorMessage}</span>
                  <Button variant="outline" onClick={() => mutate()}>
                    Retry
                  </Button>
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
                  {hostsLoading && (
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
                  {filteredHosts.map((host) => (
                    <TableRow key={host.id} className="cursor-pointer">
                      <TableCell>
                        <HostStatusBadge status={host.computedStatus} lastSeenAt={host.lastSeenAt} />
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">{host.hostname}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-slate-500">
                          <span>{host.ip}</span>
                          {host.fqdn && <span>{host.fqdn}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {host.capacity.usedCpuCores}/{host.totalCpuCores} cores
                      </TableCell>
                      <TableCell>
                        {(host.capacity.usedRamMb / 1024).toFixed(1)}/{(host.totalRamMb / 1024).toFixed(1)} GB
                      </TableCell>
                      <TableCell>
                        {host.capacity.usedStorageGb}/{host.totalStorageGb} GB
                      </TableCell>
                      <TableCell>{host.vmCount}</TableCell>
                      <TableCell>
                        {host.lastSeenAt
                          ? `${formatDistanceToNow(new Date(host.lastSeenAt), { addSuffix: true })}`
                          : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fleet capacity</CardTitle>
            <CardDescription>Total usage across all hosts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CapacityBar
              cpuPct={aggregates.fleetCpuPct}
              ramPct={aggregates.fleetRamPct}
              storagePct={aggregates.fleetStoragePct}
            />
            <dl className="grid grid-cols-2 gap-3 text-sm text-slate-600">
              <div>
                <dt>CPU</dt>
                <dd>
                  {aggregates.usedCpu}/{aggregates.totalCpu} cores
                </dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>
                  {(aggregates.usedRam / 1024).toFixed(1)}/{(aggregates.totalRam / 1024).toFixed(1)} GB
                </dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>
                  {aggregates.usedStorage}/{aggregates.totalStorage} GB
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent heartbeats</CardTitle>
          <CardDescription>Most recent check-ins from any host.</CardDescription>
        </CardHeader>
        <CardContent>
          {aggregates.recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No heartbeat data available yet.</p>
          ) : (
            <ul className="space-y-3 text-sm text-slate-600">
              {aggregates.recentActivity.map((host) => (
                <li key={host.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">{host.hostname}</p>
                    <p className="text-xs text-slate-500">{host.ip}</p>
                  </div>
                  <span>
                    {host.lastSeenAt
                      ? formatDistanceToNow(new Date(host.lastSeenAt), { addSuffix: true })
                      : "No heartbeat"}
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

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold text-slate-800">{value}</p>
      </CardContent>
    </Card>
  );
}
