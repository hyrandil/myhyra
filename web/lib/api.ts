export type HostCapacity = {
  usedCpuCores: number;
  usedRamMb: number;
  usedStorageGb: number;
  cpuUtilizationPct: number;
  ramUtilizationPct: number;
  storageUtilizationPct: number;
};

export type HostSummary = {
  id: string;
  hostname: string;
  fqdn?: string | null;
  ip: string;
  status: "online" | "offline" | string;
  lastSeenAt?: string | null;
  os: string;
  hypervVersion: string;
  agentVersion: string;
  totalCpuCores: number;
  totalRamMb: number;
  totalStorageGb: number;
  vmCount: number;
  capacity: HostCapacity;
};

export type HostMetric = {
  ts: string;
  cpuPct: number;
  memPct: number;
  memUsedMb: number;
  storageUsedGb: number;
};

export type HostVm = {
  id: string;
  name: string;
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  state: string;
  osImage: string;
  ip?: string | null;
  createdAt: string;
  updatedAt: string;
  ownerId?: string | null;
};

export type HostDetail = {
  host: HostSummary;
  metrics: HostMetric[];
  virtualMachines: HostVm[];
};

export type PricingRule = {
  id: string;
  name: string;
  cpuPriceCents: number;
  ramPriceCentsPerGb: number;
  storagePriceCentsPerGb: number;
  currency: string;
};

export type CheckoutSessionPayload = {
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
  osImage: string;
  hostId?: string | null;
};

export type CheckoutSessionResponse = {
  checkoutUrl: string;
  orderId: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: unknown,
  ) {
    super(message);
  }
}

type ApiRequestOptions = RequestInit & { token?: string | null };

async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, headers, ...init } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data ? String((data as { message?: string }).message) : response.statusText;
    throw new ApiError(message || "Request failed", response.status, data);
  }

  return data as T;
}

export function getHosts(token: string) {
  return apiFetch<HostSummary[]>("/api/hosts", { token });
}

export function getHost(id: string, token: string) {
  return apiFetch<HostDetail>(`/api/hosts/${id}`, { token });
}

export function getPublicHosts() {
  return apiFetch<HostSummary[]>("/api/public/hosts");
}

export function getPricing() {
  return apiFetch<PricingRule>("/api/pricing");
}

export function createCheckoutSession(payload: CheckoutSessionPayload, token: string) {
  return apiFetch<CheckoutSessionResponse>("/api/orders/checkout/session", {
    method: "POST",
    body: JSON.stringify(payload),
    token,
  });
}
