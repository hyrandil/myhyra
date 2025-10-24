using System;
using System.Collections.Generic;
using System.Linq;
using HvShop.Api.Models.Hosts;
using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HvShop.Api.Controllers;

[ApiController]
[Route("api/hosts")]
[Authorize(Policy = "AdminOnly")]
public class AdminHostsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public AdminHostsController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<HostSummaryDto>>> GetHostsAsync(CancellationToken cancellationToken)
    {
        var utcNow = DateTimeOffset.UtcNow;

        var hosts = await _db.Hosts
            .AsNoTracking()
            .Include(h => h.Vms)
            .OrderBy(h => h.Hostname)
            .ToListAsync(cancellationToken);

        var summaries = hosts.Select(host => HostDtoMapper.ToSummary(host, utcNow)).ToList();

        return Ok(summaries);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<HostDetailDto>> GetHostAsync(Guid id, CancellationToken cancellationToken)
    {
        var utcNow = DateTimeOffset.UtcNow;

        var host = await _db.Hosts
            .AsNoTracking()
            .Include(h => h.Vms)
            .FirstOrDefaultAsync(h => h.Id == id, cancellationToken);

        if (host is null)
        {
            return NotFound();
        }

        var summary = HostDtoMapper.ToSummary(host, utcNow);

        var metrics = await _db.HostMetrics
            .AsNoTracking()
            .Where(m => m.HostId == id)
            .OrderByDescending(m => m.Ts)
            .Take(50)
            .Select(m => new HostMetricDto(m.Ts, m.CpuPct, m.MemPct, m.MemUsedMb, m.StorageUsedGb))
            .ToListAsync(cancellationToken);

        var vms = host.Vms
            .OrderBy(vm => vm.Name)
            .Select(vm => new HostVmDto(
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
                vm.OwnerId))
            .ToList();

        return Ok(new HostDetailDto(summary, metrics, vms));
    }

    [HttpGet("{id:guid}/metrics")]
    public async Task<IActionResult> GetHostMetricsAsync(Guid id, DateTimeOffset? from, DateTimeOffset? to, CancellationToken cancellationToken)
    {
        var metricsQuery = _db.HostMetrics.Where(m => m.HostId == id);
        if (from.HasValue)
        {
            metricsQuery = metricsQuery.Where(m => m.Ts >= from.Value);
        }
        if (to.HasValue)
        {
            metricsQuery = metricsQuery.Where(m => m.Ts <= to.Value);
        }

        var metrics = await metricsQuery
            .OrderByDescending(m => m.Ts)
            .Take(500)
            .ToListAsync(cancellationToken);

        return Ok(metrics);
    }
}
