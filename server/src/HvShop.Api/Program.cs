using System.Text;
using System.Text.Json.Serialization;
using HvShop.Domain.Entities;
using HvShop.Infrastructure;
using HvShop.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddDatabaseDeveloperPageExceptionFilter();

builder.Services.AddCors(options =>
{
    var configuredOrigins = builder.Configuration.GetValue<string>("Cors:Origins")
        ?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    var origins = configuredOrigins is { Length: > 0 }
        ? configuredOrigins
        : new[] { "http://localhost:3000", "https://localhost:3000" };

    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["JWT_SECRET"] ?? "change-me")),
        ValidateLifetime = true
    };

    options.Events = new JwtBearerEvents
    {
        OnChallenge = context =>
        {
            context.HandleResponse();
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";

            var payload = JsonSerializer.Serialize(new { message = "Unauthorized" });
            return context.Response.WriteAsync(payload);
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy("AdminOnly", policy => policy.RequireClaim("role", "admin"));
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.Configure<AdminSeedOptions>(builder.Configuration.GetSection(AdminSeedOptions.SectionName));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.UseSwagger();
app.UseSwaggerUI();

var forceHttpsRedirect = builder.Configuration.GetValue<bool?>("ForceHttpsRedirect")
    ?? !app.Environment.IsDevelopment();

if (forceHttpsRedirect)
{
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

await using (var scope = app.Services.CreateAsyncScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<IDbInitializer>();
    await initializer.InitializeAsync();

    var adminSeedOptions = scope.ServiceProvider.GetRequiredService<IOptions<AdminSeedOptions>>();
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    if (!await dbContext.Users.AnyAsync(u => u.Email == adminSeedOptions.Value.Email))
    {
        dbContext.Users.Add(new User
        {
            Email = adminSeedOptions.Value.Email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminSeedOptions.Value.Password),
            Role = "admin"
        });

        await dbContext.SaveChangesAsync();
    }

    if (!await dbContext.PricingRules.AnyAsync(r => r.Active))
    {
        dbContext.PricingRules.Add(new PricingRule
        {
            Id = Guid.NewGuid(),
            Name = "Default",
            CpuPriceCents = 1500,
            RamPriceCentsPerGb = 700,
            StoragePriceCentsPerGb = 150,
            Currency = "EUR",
            Active = true
        });

        await dbContext.SaveChangesAsync();
    }
}

await app.RunAsync();

public sealed class AdminSeedOptions
{
    public const string SectionName = "AdminSeed";
    public string Email { get; set; } = "admin@example.com";
    public string Password { get; set; } = "ChangeMe123!";
}

