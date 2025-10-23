using HvShop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace HvShop.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default") ?? configuration["DATABASE_URL"] ?? "Host=localhost;Database=hvshop;Username=postgres;Password=postgres";
        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddScoped<IDbInitializer, DbInitializer>();

        return services;
    }
}

public interface IDbInitializer
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
}

internal class DbInitializer : IDbInitializer
{
    private readonly ApplicationDbContext _dbContext;

    public DbInitializer(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await _dbContext.Database.MigrateAsync(cancellationToken);
    }
}
