using System;
using System.Collections.Generic;
using System.Linq;
using HvShop.Domain;
using HvShop.Domain.Entities;
using HostEntity = HvShop.Domain.Entities.Host;

namespace HvShop.Api.Models.Hosts;

public sealed record HostCapacityDto(
    int UsedCpuCores,
    int UsedRamMb,
    int UsedStorageGb,
    double CpuUtilizationPct,
    double RamUtilizationPct,
    double StorageUtilizationPct);

public sealed record HostSummaryDto(
    Guid Id,
    string Hostname,
    string? Fqdn,
    string Ip,
    string Status,
    DateTimeOffset? LastSeenAt,
    string Os,
    string HypervVersion,
    string AgentVersion,
    int TotalCpuCores,
    int TotalRamMb,
    int TotalStorageGb,
    int VmCount,
    HostCapacityDto Capacity);

public sealed record HostMetricDto(
    DateTimeOffset Ts,
    double CpuPct,
    double MemPct,
    int MemUsedMb,
    double StorageUsedGb);

public sealed record HostVmDto(
    Guid Id,
    string Name,
    int CpuCores,
    int MemoryMb,
    int StorageGb,
    string State,
    string OsImage,
    string? Ip,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    Guid? OwnerId);

public sealed record HostDetailDto(
    HostSummaryDto Host,
    IReadOnlyList<HostMetricDto> Metrics,
    IReadOnlyList<HostVmDto> VirtualMachines);

public static class HostDtoMapper
{
    public static HostSummaryDto ToSummary(HostEntity host, DateTimeOffset utcNow)
    {
        var vmCount = host.Vms?.Count ?? 0;
        var usedCpu = host.Vms?.Sum(vm => vm.CpuCores) ?? 0;
        var usedRam = host.Vms?.Sum(vm => vm.MemoryMb) ?? 0;
        var usedStorage = host.Vms?.Sum(vm => vm.StorageGb) ?? 0;

        double cpuPct = host.TotalCpuCores > 0 ? Math.Min(100, (double)usedCpu / host.TotalCpuCores * 100) : 0;
        double ramPct = host.TotalRamMb > 0 ? Math.Min(100, (double)usedRam / host.TotalRamMb * 100) : 0;
        double storagePct = host.TotalStorageGb > 0 ? Math.Min(100, (double)usedStorage / host.TotalStorageGb * 100) : 0;

        var capacity = new HostCapacityDto(
            usedCpu,
            usedRam,
            usedStorage,
            Math.Round(cpuPct, 2),
            Math.Round(ramPct, 2),
            Math.Round(storagePct, 2));

        var status = HostStatusOptions.ComputeStatus(host.LastSeenAt, utcNow);

        return new HostSummaryDto(
            host.Id,
            host.Hostname,
            host.Fqdn,
            host.Ip,
            status,
            host.LastSeenAt,
            host.Os,
            host.HypervVersion,
            host.AgentVersion,
            host.TotalCpuCores,
            host.TotalRamMb,
            host.TotalStorageGb,
            vmCount,
            capacity);
    }
}
