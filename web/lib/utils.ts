import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HOST_OFFLINE_THRESHOLD_MS = 90_000;

export function deriveHostStatus(status?: string, lastSeenAt?: string | null, thresholdMs = HOST_OFFLINE_THRESHOLD_MS) {
  const normalized = (status ?? "").toLowerCase();

  if (lastSeenAt) {
    const timestamp = new Date(lastSeenAt).getTime();
    if (!Number.isNaN(timestamp)) {
      const delta = Date.now() - timestamp;
      if (delta > thresholdMs) {
        return "offline" as const;
      }
    }
  }

  if (normalized === "online" || normalized === "offline") {
    return normalized as const;
  }

  return normalized.length > 0 ? normalized : "unknown";
}

export function formatRelativeLastSeen(lastSeenAt?: string | null) {
  if (!lastSeenAt) {
    return null;
  }

  const timestamp = new Date(lastSeenAt).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.round(diffMs / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffSeconds) < 60) {
    return rtf.format(-diffSeconds, "second");
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(-diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  return rtf.format(-diffHours, "hour");
}
