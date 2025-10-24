"use client";

import { Badge } from "../ui/badge";

export function HostStatusBadge({ status, lastSeenAt }: { status: string; lastSeenAt?: string | null }) {
  const normalized = status.toLowerCase();
  const variant = normalized === "online" ? "success" : "danger";
  const label = normalized === "online" ? "Online" : "Offline";

  const lastSeen = lastSeenAt ? new Date(lastSeenAt) : null;
  const tooltip = lastSeen ? `Last seen ${lastSeen.toLocaleString()}` : undefined;

  return (
    <Badge variant={variant} title={tooltip} aria-label={tooltip ?? label}>
      {label}
    </Badge>
  );
}
