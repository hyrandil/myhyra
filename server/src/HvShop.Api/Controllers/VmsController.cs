using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using HvShop.Domain;
using HvShop.Domain.Entities;
using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HvShop.Api.Controllers;

[ApiController]
[Route("api/vms")]
public class VmsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public VmsController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAsync(CancellationToken cancellationToken)
    {
        var isAdmin = User.HasClaim("role", "admin");
        var query = _db.VirtualMachines.AsQueryable();
        if (!isAdmin)
        {
            var userId = GetUserId();
            query = query.Where(vm => vm.OwnerId == userId);
        }

        var vms = await query.Select(vm => new
        {
            vm.Id,
            vm.Name,
            vm.CpuCores,
            vm.MemoryMb,
            vm.StorageGb,
            vm.State,
            vm.OsImage,
            vm.Ip,
            vm.CreatedAt,
            vm.UpdatedAt,
            vm.HostId
        }).ToListAsync(cancellationToken);

        return Ok(vms);
    }

    [HttpPost]
    public async Task<IActionResult> CreateAsync([FromBody] CreateVmRequest request, CancellationToken cancellationToken)
    {
        var ownerId = GetUserId();
        var utcNow = DateTimeOffset.UtcNow;

        var hostsQuery = _db.Hosts
            .Include(h => h.Vms)
            .AsQueryable();

        Host? host = null;

        if (request.HostId.HasValue)
        {
            host = await hostsQuery.FirstOrDefaultAsync(h => h.Id == request.HostId.Value, cancellationToken);
            if (host == null)
            {
                return NotFound(new { message = "Requested host not found" });
            }

            var status = HostStatusOptions.ComputeStatus(host.LastSeenAt, utcNow);
            if (!string.Equals(status, "online", StringComparison.OrdinalIgnoreCase))
            {
                return UnprocessableEntity(new { message = "Requested host is offline" });
            }

            if (!HasCapacity(host, request, out var capacity))
            {
                return UnprocessableEntity(new
                {
                    message = "Insufficient capacity on requested host",
                    capacity
                });
            }
        }
        else
        {
            var candidateHosts = await hostsQuery
                .OrderByDescending(h => h.LastSeenAt)
                .ToListAsync(cancellationToken);

            host = candidateHosts
                .FirstOrDefault(h =>
                    string.Equals(HostStatusOptions.ComputeStatus(h.LastSeenAt, utcNow), "online", StringComparison.OrdinalIgnoreCase)
                    && HasCapacity(h, request, out _));

            if (host == null)
            {
                return UnprocessableEntity(new { message = "No host has sufficient capacity for the requested VM" });
            }
        }

        var vm = new VirtualMachine
        {
            Id = Guid.NewGuid(),
            HostId = host.Id,
            Name = request.Name,
            CpuCores = request.CpuCores,
            MemoryMb = request.MemoryMb,
            StorageGb = request.StorageGb,
            OsImage = request.OsImage,
            State = "queued",
            OwnerId = ownerId,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        _db.VirtualMachines.Add(vm);
        _db.ProvisioningJobs.Add(new ProvisioningJob
        {
            Id = Guid.NewGuid(),
            HostId = host.Id,
            VmId = vm.Id,
            Type = "CreateVm",
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                request.Name,
                request.CpuCores,
                request.MemoryMb,
                request.StorageGb,
                request.OsImage,
                request.NetworkId,
                request.SshKeys,
                request.UserData
            }),
            Status = "queued",
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);

        return Accepted(new { vm.Id, vm.HostId });
    }

    [HttpPost("{id:guid}/actions")]
    public async Task<IActionResult> ExecuteActionAsync(Guid id, [FromBody] VmActionRequest request, CancellationToken cancellationToken)
    {
        var vm = await _db.VirtualMachines.FirstOrDefaultAsync(v => v.Id == id, cancellationToken);
        if (vm == null)
        {
            return NotFound();
        }

        var ownerId = GetUserId();
        if (vm.OwnerId != ownerId && !User.HasClaim("role", "admin"))
        {
            return Forbid();
        }

        _db.ProvisioningJobs.Add(new ProvisioningJob
        {
            Id = Guid.NewGuid(),
            HostId = vm.HostId,
            VmId = vm.Id,
            Type = request.Action,
            PayloadJson = System.Text.Json.JsonSerializer.Serialize(request.Payload ?? new object()),
            Status = "queued",
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);
        return Accepted();
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }

    private static bool HasCapacity(Host host, CreateVmRequest request, out object capacity)
    {
        var vms = host.Vms ?? new List<VirtualMachine>();

        var usedCpu = vms.Sum(vm => vm.CpuCores);
        var usedRam = vms.Sum(vm => vm.MemoryMb);
        var usedStorage = vms.Sum(vm => vm.StorageGb);

        var availableCpu = host.TotalCpuCores - usedCpu;
        var availableRam = host.TotalRamMb - usedRam;
        var availableStorage = host.TotalStorageGb - usedStorage;

        capacity = new
        {
            availableCpuCores = Math.Max(availableCpu, 0),
            availableRamMb = Math.Max(availableRam, 0),
            availableStorageGb = Math.Max(availableStorage, 0)
        };

        return availableCpu >= request.CpuCores
            && availableRam >= request.MemoryMb
            && availableStorage >= request.StorageGb;
    }
}

public sealed record CreateVmRequest(
    Guid? HostId,
    string Name,
    int CpuCores,
    int MemoryMb,
    int StorageGb,
    string OsImage,
    string? NetworkId,
    IReadOnlyCollection<string>? SshKeys,
    string? UserData);

public sealed record VmActionRequest(string Action, object? Payload);
