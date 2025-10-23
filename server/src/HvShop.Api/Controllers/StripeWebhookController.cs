using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Stripe;

namespace HvShop.Api.Controllers;

[ApiController]
[Route("api/webhooks/stripe")]
public class StripeWebhookController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<StripeWebhookController> _logger;

    public StripeWebhookController(ApplicationDbContext db, ILogger<StripeWebhookController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> HandleAsync(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var payload = await reader.ReadToEndAsync(cancellationToken);
        var signatureHeader = Request.Headers["Stripe-Signature"].FirstOrDefault();
        if (signatureHeader == null)
        {
            return BadRequest();
        }

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(payload, signatureHeader, Environment.GetEnvironmentVariable("STRIPE_WEBHOOK_SECRET"));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Stripe webhook signature validation failed");
            return BadRequest();
        }

        if (stripeEvent.Type == Events.CheckoutSessionCompleted)
        {
            var session = stripeEvent.Data.Object as Stripe.Checkout.Session;
            if (session?.Metadata.TryGetValue("orderId", out var orderIdStr) == true && Guid.TryParse(orderIdStr, out var orderId))
            {
                var order = await _db.Orders.FindAsync(new object?[] { orderId }, cancellationToken);
                if (order != null)
                {
                    order.Status = "paid";
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }
        }

        return Ok();
    }
}
