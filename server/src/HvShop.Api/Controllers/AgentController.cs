using HvShop.Domain.Entities;
using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HvShop.Api.Controllers;

[ApiController]
[Route("api/agent")]
[AllowAnonymous]
public class AgentController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AgentController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpPost("register")]
    public async Task<ActionResult<AgentRegistrationResponse>> RegisterAsync([FromBody] AgentRegistrationRequest request, CancellationToken cancellationToken)
    {
        var host = await _db.Hosts.FirstOrDefaultAsync(h => h.Hostname == request.Hostname, cancellationToken);
        if (host == null)
        {
            host = new Host
            {
                Hostname = request.Hostname,
                Ip = request.Ip,
                AgentVersion = request.AgentVersion,
                Os = request.Os,
                HypervVersion = request.HyperVVersion,
                TotalCpuCores = request.TotalCpuCores,
                TotalRamMb = request.TotalRamMb,
                TotalStorageGb = request.TotalStorageGb,
                Status = "online",
                LastSeenAt = DateTimeOffset.UtcNow
            };
            _db.Hosts.Add(host);
        }
        else
        {
            host.Ip = request.Ip;
            host.AgentVersion = request.AgentVersion;
            host.Os = request.Os;
            host.HypervVersion = request.HyperVVersion;
            host.TotalCpuCores = request.TotalCpuCores;
            host.TotalRamMb = request.TotalRamMb;
            host.TotalStorageGb = request.TotalStorageGb;
            host.Status = "online";
            host.LastSeenAt = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(new AgentRegistrationResponse(host.Id, "issued-cert-placeholder"));
    }

    [HttpPost("{hostId:guid}/heartbeat")]
    public async Task<IActionResult> HeartbeatAsync(Guid hostId, [FromBody] HostHeartbeatDto dto, CancellationToken cancellationToken)
    {
        var host = await _db.Hosts.FirstOrDefaultAsync(h => h.Id == hostId, cancellationToken);
        if (host == null)
        {
            return NotFound();
        }

        host.Status = "online";
        host.LastSeenAt = DateTimeOffset.UtcNow;
        host.TotalCpuCores = dto.TotalCpuCores;
        host.TotalRamMb = dto.TotalRamMb;
        host.TotalStorageGb = dto.TotalStorageGb;
        host.AgentVersion = dto.AgentVersion ?? host.AgentVersion;
        host.Os = dto.Os ?? host.Os;

        _db.HostMetrics.Add(new HostMetric
        {
            HostId = hostId,
            Ts = dto.Ts,
            CpuPct = dto.CpuPct,
            MemUsedMb = dto.MemUsedMb,
            MemPct = dto.MemPct,
            StorageUsedGb = dto.StorageUsedGb
        });

        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpPost("{hostId:guid}/inventory")]
    public async Task<IActionResult> InventoryAsync(Guid hostId, [FromBody] HostInventoryDto dto, CancellationToken cancellationToken)
    {
        var host = await _db.Hosts.Include(h => h.Vms).FirstOrDefaultAsync(h => h.Id == hostId, cancellationToken);
        if (host == null)
        {
            return NotFound();
        }

        var knownVmIds = host.Vms.Select(vm => vm.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var vm in dto.VirtualMachines)
        {
            var existing = host.Vms.FirstOrDefault(v => v.Name == vm.Name);
            if (existing == null)
            {
                host.Vms.Add(new VirtualMachine
                {
                    Name = vm.Name,
                    CpuCores = vm.CpuCores,
                    MemoryMb = vm.MemoryMb,
                    StorageGb = vm.StorageGb,
                    State = vm.State,
                    OsImage = vm.OsImage,
                    Ip = vm.Ip,
                    HostId = host.Id
                });
            }
            else
            {
                existing.CpuCores = vm.CpuCores;
                existing.MemoryMb = vm.MemoryMb;
                existing.StorageGb = vm.StorageGb;
                existing.State = vm.State;
                existing.OsImage = vm.OsImage;
                existing.Ip = vm.Ip;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
            }
        }

        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}

public sealed record AgentRegistrationRequest(
    string Hostname,
    string Ip,
    string AgentVersion,
    string Os,
    string HyperVVersion,
    int TotalCpuCores,
    int TotalRamMb,
    int TotalStorageGb);

public sealed record AgentRegistrationResponse(Guid HostId, string CertificatePem);

public sealed record HostHeartbeatDto(
    string Hostname,
    string? Os,
    string? AgentVersion,
    int TotalCpuCores,
    int TotalRamMb,
    int TotalStorageGb,
    double CpuPct,
    int MemUsedMb,
    double MemPct,
    double StorageUsedGb,
    DateTimeOffset Ts);

public sealed record HostInventoryDto(IReadOnlyCollection<InventoryVmDto> VirtualMachines);

public sealed record InventoryVmDto(string Name, int CpuCores, int MemoryMb, int StorageGb, string State, string OsImage, string? Ip);
