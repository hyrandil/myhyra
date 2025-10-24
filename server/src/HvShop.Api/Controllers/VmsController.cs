using HvShop.Domain.Entities;
using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

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
        var host = request.HostId.HasValue
            ? await _db.Hosts.FirstOrDefaultAsync(h => h.Id == request.HostId.Value, cancellationToken)
            : await _db.Hosts.OrderBy(h => h.LastSeenAt).FirstOrDefaultAsync(cancellationToken);

        if (host == null)
        {
            return BadRequest(new { message = "No host available" });
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
