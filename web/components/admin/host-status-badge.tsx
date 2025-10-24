"use client";

import { Badge } from "../ui/badge";
import { deriveHostStatus, formatRelativeLastSeen } from "../../lib/utils";

export function HostStatusBadge({ status, lastSeenAt }: { status: string; lastSeenAt?: string | null }) {
  const normalized = deriveHostStatus(status, lastSeenAt);
  let variant: "success" | "danger" | "warning";
  let label: string;

  switch (normalized) {
    case "online":
      variant = "success";
      label = "Online";
      break;
    case "offline":
      variant = "danger";
      label = "Offline";
      break;
    default:
      variant = "warning";
      label = normalized.length > 0 ? normalized : "Unknown";
      label = label.charAt(0).toUpperCase() + label.slice(1);
      break;
  }

  const relative = formatRelativeLastSeen(lastSeenAt);
  const tooltip = lastSeenAt ? `Last seen ${new Date(lastSeenAt).toLocaleString()}` : undefined;

  return (
    <Badge variant={variant} title={tooltip} aria-label={tooltip ?? label}>
      {relative ? `${label} · ${relative}` : label}
    </Badge>
  );
}
