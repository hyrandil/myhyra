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
    public async Task<IActionResult> GetHostsAsync(CancellationToken cancellationToken)
    {
        var hosts = await _db.Hosts
            .Select(h => new
            {
                h.Id,
                h.Hostname,
                h.Ip,
                h.Status,
                h.AgentVersion,
                h.Os,
                h.TotalCpuCores,
                h.TotalRamMb,
                h.TotalStorageGb,
                h.LastSeenAt
            })
            .ToListAsync(cancellationToken);

        return Ok(hosts);
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
