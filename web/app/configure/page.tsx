"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import type { HostSummary, PricingRule } from "../../lib/api";
import { ApiError, CheckoutSessionPayload, createCheckoutSession, getPricing, getPublicHosts } from "../../lib/api";
import { deriveHostStatus, formatRelativeLastSeen } from "../../lib/utils";
import { useAuth } from "../../components/auth-context";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { HostStatusBadge } from "../../components/admin/host-status-badge";
import { CapacityBar } from "../../components/admin/capacity-bar";

function useConfiguratorHosts() {
  return useSWR<HostSummary[]>("public-hosts", getPublicHosts, { refreshInterval: 10_000 });
}

function usePricing() {
  return useSWR<PricingRule>("pricing", getPricing);
}

type ConfiguratorHost = HostSummary & {
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

export default function ConfigurePage() {
  const { token } = useAuth();
  const { data: hosts, isLoading: hostsLoading, error: hostsError } = useConfiguratorHosts();
  const { data: pricing } = usePricing();

  const [cpuCores, setCpuCores] = useState(2);
  const [memoryMb, setMemoryMb] = useState(4096);
  const [storageGb, setStorageGb] = useState(50);
  const [osImage, setOsImage] = useState("win2022-core");
  const [vmName, setVmName] = useState("hyperv-vm");
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const hostsWithStatus: ConfiguratorHost[] = useMemo(
    () =>
      (hosts ?? []).map((host) => {
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
      }),
    [hosts],
  );

  const selectedHost = useMemo(
    () => hostsWithStatus.find((host) => host.id === selectedHostId) ?? null,
    [hostsWithStatus, selectedHostId],
  );

  const availableCapacity = useMemo(() => {
    if (!selectedHost) {
      return null;
    }
    const availableCpu = selectedHost.totalCpuCores - selectedHost.capacity.usedCpuCores;
    const availableRam = selectedHost.totalRamMb - selectedHost.capacity.usedRamMb;
    const availableStorage = selectedHost.totalStorageGb - selectedHost.capacity.usedStorageGb;
    return {
      cpu: availableCpu,
      ram: availableRam,
      storage: availableStorage,
    };
  }, [selectedHost]);

  const capacityErrors: string[] = [];
  if (selectedHost && availableCapacity) {
    if (availableCapacity.cpu < cpuCores) {
      capacityErrors.push(`Requires ${cpuCores} vCPU but only ${availableCapacity.cpu} available.`);
    }
    if (availableCapacity.ram < memoryMb) {
      capacityErrors.push(
        `Requires ${(memoryMb / 1024).toFixed(1)} GB RAM but ${(availableCapacity.ram / 1024).toFixed(1)} GB available.`,
      );
    }
    if (availableCapacity.storage < storageGb) {
      capacityErrors.push(`Requires ${storageGb} GB storage but ${availableCapacity.storage} GB available.`);
    }
  }

  const checkoutDisabled =
    submitting ||
    !selectedHost ||
    !pricing ||
    capacityErrors.length > 0 ||
    vmName.trim().length === 0;

  const estimatedTotalCents = useMemo(() => {
    if (!pricing) {
      return 0;
    }
    const ramGb = Math.ceil(memoryMb / 1024);
    return (
      cpuCores * pricing.cpuPriceCents +
      ramGb * pricing.ramPriceCentsPerGb +
      storageGb * pricing.storagePriceCentsPerGb
    );
  }, [cpuCores, memoryMb, pricing, storageGb]);

  const handleCheckout = async () => {
    if (!pricing || !selectedHost) {
      return;
    }
    setSubmitting(true);
    setFeedback(null);

    if (!token) {
      setFeedback("Please sign in to the control plane to complete checkout.");
      setSubmitting(false);
      return;
    }

    const payload: CheckoutSessionPayload = {
      cpuCores,
      memoryMb,
      storageGb,
      osImage,
      hostId: selectedHost.id,
    };

    try {
      const session = await createCheckoutSession(payload, token);
      setFeedback(`Checkout session created. Continue at ${session.checkoutUrl}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setFeedback(error.message || "Failed to start checkout.");
      } else if (error instanceof Error) {
        setFeedback(error.message);
      } else {
        setFeedback("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Configure your virtual machine</h1>
        <p className="max-w-2xl text-sm text-slate-500">
          Choose a host, tune compute resources, and review live pricing before starting checkout.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>Adjust compute and storage requirements for your VM.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="vm-name">
                  VM name
                </label>
                <Input id="vm-name" value={vmName} onChange={(event) => setVmName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="os-image">
                  Operating system
                </label>
                <select
                  id="os-image"
                  value={osImage}
                  onChange={(event) => setOsImage(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm shadow-sm"
                >
                  <option value="win2022-core">Windows Server 2022 Core</option>
                  <option value="ubuntu-22-04">Ubuntu 22.04 LTS</option>
                  <option value="debian-12">Debian 12</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="cpu">
                  vCPU cores
                </label>
                <Input
                  id="cpu"
                  type="number"
                  min={1}
                  value={cpuCores}
                  onChange={(event) => setCpuCores(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="memory">
                  Memory (MB)
                </label>
                <Input
                  id="memory"
                  type="number"
                  min={1024}
                  step={1024}
                  value={memoryMb}
                  onChange={(event) => setMemoryMb(Number(event.target.value))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600" htmlFor="storage">
                  Storage (GB)
                </label>
                <Input
                  id="storage"
                  type="number"
                  min={20}
                  step={10}
                  value={storageGb}
                  onChange={(event) => setStorageGb(Number(event.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
            <CardDescription>Review totals before launching checkout.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <dt>VM name</dt>
                <dd>{vmName || "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Resources</dt>
                <dd>
                  {cpuCores}C / {(memoryMb / 1024).toFixed(1)}GB / {storageGb}GB
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Host</dt>
                <dd>{selectedHost ? selectedHost.hostname : "Select a host"}</dd>
              </div>
            </dl>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Estimated monthly price</p>
              <p className="text-3xl font-semibold text-slate-800">
                {pricing ? `${(estimatedTotalCents / 100).toFixed(2)} ${pricing.currency}` : "—"}
              </p>
            </div>
            {capacityErrors.length > 0 && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                <p className="font-medium">Adjust resources</p>
                <ul className="list-disc space-y-1 pl-5">
                  {capacityErrors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
            {feedback && <p className="text-sm text-slate-600">{feedback}</p>}
            <Button className="w-full" disabled={checkoutDisabled} onClick={handleCheckout}>
              {submitting ? "Preparing checkout…" : "Continue to checkout"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold">Available hosts</h2>
          <p className="text-sm text-slate-500">Select a host with enough free capacity for your VM.</p>
        </header>
        {hostsError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
            {hostsError instanceof ApiError ? hostsError.message : "Failed to load hosts."}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {hostsLoading && <HostSkeleton />}
          {hostsWithStatus.map((host) => {
            const isSelected = host.id === selectedHostId;
            const availableCpu = host.totalCpuCores - host.capacity.usedCpuCores;
            const availableRam = host.totalRamMb - host.capacity.usedRamMb;
            const availableStorage = host.totalStorageGb - host.capacity.usedStorageGb;
            const disabled = host.computedStatus.toLowerCase() !== "online";
            const totalRamGb = host.totalRamMb / 1024;
            const usedRamGb = host.telemetrySnapshot.memUsedMb != null
              ? host.telemetrySnapshot.memUsedMb / 1024
              : host.capacity.usedRamMb / 1024;
            const usedStorageGb = host.telemetrySnapshot.storageUsedGb ?? host.capacity.usedStorageGb;

            return (
              <button
                key={host.id}
                onClick={() => setSelectedHostId(host.id)}
                disabled={disabled}
                className={`group rounded-2xl border p-5 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isSelected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-indigo-300"}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{host.hostname}</h3>
                    <p className="text-xs text-slate-500">{host.ip}</p>
                  </div>
                  <HostStatusBadge status={host.status} lastSeenAt={host.lastSeenAt} />
                </div>
                <dl className="mt-4 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between">
                    <dt>CPU load</dt>
                    <dd>
                      {host.telemetrySnapshot.cpuPct != null
                        ? `${host.telemetrySnapshot.cpuPct.toFixed(1)}%`
                        : `${host.capacity.cpuUtilizationPct.toFixed(1)}% (allocated)`}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Memory in use</dt>
                    <dd>{`${usedRamGb.toFixed(1)}/${totalRamGb.toFixed(1)} GB`}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Storage in use</dt>
                    <dd>{`${usedStorageGb.toFixed(1)}/${host.totalStorageGb} GB`}</dd>
                  </div>
                </dl>
                <div className="mt-4">
                  <CapacityBar
                    cpuPct={host.telemetrySnapshot.cpuPct ?? host.capacity.cpuUtilizationPct}
                    ramPct={host.telemetrySnapshot.memPct ?? host.capacity.ramUtilizationPct}
                    storagePct={host.telemetrySnapshot.storagePct ?? host.capacity.storageUtilizationPct}
                  />
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  <p>Available: {availableCpu} cores, {(availableRam / 1024).toFixed(1)} GB RAM, {availableStorage} GB storage</p>
                  {host.telemetrySnapshot.sampledAt && (
                    <p className="mt-1">
                      Last heartbeat {formatRelativeLastSeen(host.telemetrySnapshot.sampledAt) ?? "just now"}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {hostsWithStatus.length === 0 && !hostsLoading && (
          <p className="text-sm text-slate-500">No hosts reported yet. Install an agent to begin provisioning.</p>
        )}
      </section>
    </main>
  );
}

function HostSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}
