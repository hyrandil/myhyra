using HvShop.Domain.Entities;
using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe.Checkout;
using System.Security.Claims;

namespace HvShop.Api.Controllers;

[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _configuration;

    public OrdersController(ApplicationDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<IActionResult> GetAsync(CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var isAdmin = User.HasClaim("role", "admin");
        var query = _db.Orders.Include(o => o.Items).AsQueryable();
        if (!isAdmin)
        {
            query = query.Where(o => o.UserId == userId);
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync(cancellationToken);
        return Ok(orders);
    }

    [HttpPost("checkout/session")]
    [ProducesResponseType(typeof(CheckoutSessionResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateCheckoutSession([FromBody] CheckoutSessionRequest request, CancellationToken cancellationToken)
    {
        var userId = GetUserId();
        var pricing = await _db.PricingRules.FirstOrDefaultAsync(p => p.Active, cancellationToken);
        if (pricing == null)
        {
            return BadRequest(new { message = "Pricing not configured" });
        }

        var total = (request.CpuCores * pricing.CpuPriceCents)
                    + ((request.MemoryMb / 1024) * pricing.RamPriceCentsPerGb)
                    + (request.StorageGb * pricing.StoragePriceCentsPerGb);

        var order = new Order
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Status = "pending",
            Currency = pricing.Currency,
            TotalCents = total,
            CreatedAt = DateTimeOffset.UtcNow,
            PaymentProvider = "stripe"
        };

        order.Items.Add(new OrderItem
        {
            Id = Guid.NewGuid(),
            CpuCores = request.CpuCores,
            MemoryMb = request.MemoryMb,
            StorageGb = request.StorageGb,
            OsImage = request.OsImage,
            Quantity = 1,
            UnitPriceCents = total
        });

        _db.Orders.Add(order);
        await _db.SaveChangesAsync(cancellationToken);

        var domain = _configuration["PUBLIC_URL"] ?? "http://localhost:3000";
        var options = new SessionCreateOptions
        {
            Mode = "payment",
            CustomerEmail = User.Identity?.Name,
            LineItems = new List<SessionLineItemOptions>
            {
                new()
                {
                    Quantity = 1,
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = pricing.Currency.ToLowerInvariant(),
                        UnitAmount = total,
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"VM {request.CpuCores}C/{request.MemoryMb}MB/{request.StorageGb}GB"
                        }
                    }
                }
            },
            SuccessUrl = $"{domain}/orders?success=true",
            CancelUrl = $"{domain}/orders?canceled=true",
            Metadata = new Dictionary<string, string>
            {
                ["orderId"] = order.Id.ToString()
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options, cancellationToken: cancellationToken);

        order.PaymentIntentId = session.Id;
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(new CheckoutSessionResponse(session.Url!, order.Id));
    }

    private Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var guid) ? guid : Guid.Empty;
    }
}

public sealed record CheckoutSessionRequest(int CpuCores, int MemoryMb, int StorageGb, string OsImage);

public sealed record CheckoutSessionResponse(string CheckoutUrl, Guid OrderId);
