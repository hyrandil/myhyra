using System.Linq;
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
    public async Task<IActionResult> GetHostsAsync(CancellationToken cancellationToken)
    {
        var hosts = await _db.Hosts
            .OrderByDescending(h => h.LastSeenAt)
            .Select(h => new
            {
                h.Id,
                h.Hostname,
                h.Status,
                h.TotalCpuCores,
                h.TotalRamMb,
                h.TotalStorageGb,
                h.LastSeenAt
            })
            .ToListAsync(cancellationToken);

        return Ok(hosts);
    }
}
