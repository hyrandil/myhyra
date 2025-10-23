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
    public async Task<IActionResult> GetPricingAsync(CancellationToken cancellationToken)
    {
        var rules = await _db.PricingRules.Where(r => r.Active).ToListAsync(cancellationToken);
        return Ok(rules);
    }
}
