using HvShop.Domain.Entities;
using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HvShop.Api.Controllers;

[ApiController]
[Route("api/pricing")]
[AllowAnonymous]
public class PricingController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public PricingController(ApplicationDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<PricingRule>> GetPricingAsync(CancellationToken cancellationToken)
    {
        var rule = await _db.PricingRules
            .AsNoTracking()
            .Where(r => r.Active)
            .OrderBy(r => r.Name)
            .FirstOrDefaultAsync(cancellationToken);

        if (rule is null)
        {
            return NotFound(new { message = "No active pricing rule configured" });
        }

        return Ok(rule);
    }
}
