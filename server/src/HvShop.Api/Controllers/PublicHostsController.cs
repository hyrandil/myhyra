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
[Route("api/public/hosts")]
[AllowAnonymous]
public class PublicHostsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PublicHostsController(ApplicationDbContext db)
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
            .OrderByDescending(h => h.LastSeenAt)
            .ToListAsync(cancellationToken);

        var hostIds = hosts.Select(h => h.Id).ToList();

        var latestMetrics = await _db.HostMetrics
            .AsNoTracking()
            .Where(m => hostIds.Contains(m.HostId))
            .OrderByDescending(m => m.Ts)
            .ToListAsync(cancellationToken);

        var metricLookup = latestMetrics
            .DistinctBy(m => m.HostId)
            .ToDictionary(m => m.HostId, m => m);

        var summaries = hosts
            .Select(h =>
            {
                metricLookup.TryGetValue(h.Id, out var metric);
                return HostDtoMapper.ToSummary(h, utcNow, metric);
            })
            .ToList();

        return Ok(summaries);
    }
}
