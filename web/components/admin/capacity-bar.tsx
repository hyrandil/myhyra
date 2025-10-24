"use client";

import { cn } from "../../lib/utils";

export function CapacityBar({
  cpuPct,
  ramPct,
  storagePct,
}: {
  cpuPct: number;
  ramPct: number;
  storagePct: number;
}) {
  return (
    <div className="space-y-2">
      <CapacityRow label="CPU" value={cpuPct} />
      <CapacityRow label="Memory" value={ramPct} />
      <CapacityRow label="Storage" value={storagePct} />
    </div>
  );
}

function CapacityRow({ label, value }: { label: string; value: number }) {
  const percentage = Math.min(100, Math.max(0, value));
  const intent = percentage < 70 ? "ok" : percentage < 90 ? "warn" : "error";
  const colors = {
    ok: "bg-emerald-500",
    warn: "bg-amber-500",
    error: "bg-rose-500",
  } as const;

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-2 w-full rounded-full bg-slate-200">
        <div className={cn("h-2 rounded-full transition-all", colors[intent])} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
