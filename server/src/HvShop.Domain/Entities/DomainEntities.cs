namespace HvShop.Domain.Entities;

public class Role
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public ICollection<RolePermission> Permissions { get; set; } = new List<RolePermission>();
}

public class RolePermission
{
    public Guid Id { get; set; }
    public string Permission { get; set; } = string.Empty;
    public Guid RoleId { get; set; }
    public Role? Role { get; set; }
}

public class Host
{
    public Guid Id { get; set; }
    public string Hostname { get; set; } = string.Empty;
    public string? Fqdn { get; set; }
    public string Ip { get; set; } = string.Empty;
    public string AgentVersion { get; set; } = string.Empty;
    public string Os { get; set; } = string.Empty;
    public string HypervVersion { get; set; } = string.Empty;
    public int TotalCpuCores { get; set; }
    public int TotalRamMb { get; set; }
    public int TotalStorageGb { get; set; }
    public string Status { get; set; } = "unknown";
    public DateTimeOffset? LastSeenAt { get; set; }
    public ICollection<VirtualMachine> Vms { get; set; } = new List<VirtualMachine>();
    public ICollection<HostMetric> Metrics { get; set; } = new List<HostMetric>();
}

public class VirtualMachine
{
    public Guid Id { get; set; }
    public Guid HostId { get; set; }
    public Host? Host { get; set; }
    public Guid? OwnerId { get; set; }
    public User? Owner { get; set; }
    public string Name { get; set; } = string.Empty;
    public int CpuCores { get; set; }
    public int MemoryMb { get; set; }
    public int StorageGb { get; set; }
    public string State { get; set; } = "provisioning";
    public string OsImage { get; set; } = string.Empty;
    public string? Ip { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<ProvisioningJob> Jobs { get; set; } = new List<ProvisioningJob>();
}

public class HostMetric
{
    public Guid Id { get; set; }
    public Guid HostId { get; set; }
    public Host? Host { get; set; }
    public DateTimeOffset Ts { get; set; }
    public double CpuPct { get; set; }
    public int MemUsedMb { get; set; }
    public double MemPct { get; set; }
    public double StorageUsedGb { get; set; }
}

public class Order
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
    public string Status { get; set; } = "pending";
    public long TotalCents { get; set; }
    public string Currency { get; set; } = "EUR";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string PaymentProvider { get; set; } = "stripe";
    public string? PaymentIntentId { get; set; }
    public ICollection<OrderItem> Items { get; set; } = new List<OrderItem>();
}

public class OrderItem
{
    public Guid Id { get; set; }
    public Guid OrderId { get; set; }
    public Order? Order { get; set; }
    public Guid? HostId { get; set; }
    public Host? Host { get; set; }
    public Guid? VmId { get; set; }
    public VirtualMachine? Vm { get; set; }
    public int CpuCores { get; set; }
    public int MemoryMb { get; set; }
    public int StorageGb { get; set; }
    public string OsImage { get; set; } = string.Empty;
    public string? HostnameRequest { get; set; }
    public int Quantity { get; set; } = 1;
    public long UnitPriceCents { get; set; }
}

public class ProvisioningJob
{
    public Guid Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public string Status { get; set; } = "queued";
    public Guid HostId { get; set; }
    public Host? Host { get; set; }
    public Guid? VmId { get; set; }
    public VirtualMachine? Vm { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public string? Error { get; set; }
}

public class ApiKey
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string HashedKey { get; set; } = string.Empty;
    public string Role { get; set; } = "customer";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastUsedAt { get; set; }
    public Guid UserId { get; set; }
    public User? User { get; set; }
}

public class AuditLog
{
    public Guid Id { get; set; }
    public Guid? ActorUserId { get; set; }
    public User? ActorUser { get; set; }
    public Guid? ActorApiKeyId { get; set; }
    public ApiKey? ActorApiKey { get; set; }
    public string Action { get; set; } = string.Empty;
    public string TargetType { get; set; } = string.Empty;
    public Guid? TargetId { get; set; }
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public string? Ip { get; set; }
    public string DetailsJson { get; set; } = "{}";
}

public class PricingRule
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public long CpuPriceCents { get; set; }
    public long RamPriceCentsPerGb { get; set; }
    public long StoragePriceCentsPerGb { get; set; }
    public string Currency { get; set; } = "EUR";
    public bool Active { get; set; } = true;
}

public class Image
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Version { get; set; } = string.Empty;
    public string OsType { get; set; } = string.Empty;
    public string PathOrCatalogId { get; set; } = string.Empty;
    public string? DefaultCredentialsHint { get; set; }
}
