using Hangfire;
using Hangfire.PostgreSql;
using HvShop.Infrastructure;
using HvShop.Infrastructure.Persistence;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddHangfire(config =>
{
    config.UseSimpleAssemblyNameTypeSerializer()
          .UseRecommendedSerializerSettings()
          .UsePostgreSqlStorage(builder.Configuration.GetConnectionString("Default") ?? builder.Configuration["DATABASE_URL"] ?? "Host=localhost;Database=hvshop;Username=postgres;Password=postgres");
});

builder.Services.AddHangfireServer();

builder.Services.AddHostedService<ProvisioningDispatcher>();
builder.Services.AddHostedService<MetricsRollupService>();

var host = builder.Build();

await host.RunAsync();

public class ProvisioningDispatcher : BackgroundService
{
    private readonly IServiceProvider _provider;
    private readonly ILogger<ProvisioningDispatcher> _logger;

    public ProvisioningDispatcher(IServiceProvider provider, ILogger<ProvisioningDispatcher> logger)
    {
        _provider = provider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var job = db.ProvisioningJobs
                .Where(j => j.Status == "queued")
                .OrderBy(j => j.CreatedAt)
                .FirstOrDefault();
            if (job != null)
            {
                job.Status = "dispatched";
                job.StartedAt = DateTimeOffset.UtcNow;
                await db.SaveChangesAsync(stoppingToken);
                _logger.LogInformation("Dispatched job {JobId} to host {HostId}", job.Id, job.HostId);
            }
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}

public class MetricsRollupService : BackgroundService
{
    private readonly IServiceProvider _provider;
    private readonly ILogger<MetricsRollupService> _logger;

    public MetricsRollupService(IServiceProvider provider, ILogger<MetricsRollupService> logger)
    {
        _provider = provider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _provider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var cutoff = DateTimeOffset.UtcNow.AddDays(-7);
            var stale = db.HostMetrics.Where(m => m.Ts < cutoff);
            db.HostMetrics.RemoveRange(stale);
            await db.SaveChangesAsync(stoppingToken);
            _logger.LogInformation("Rolled up metrics older than {Cutoff}", cutoff);
            await Task.Delay(TimeSpan.FromMinutes(30), stoppingToken);
        }
    }
}
