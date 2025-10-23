using HyperV.Agent.Service;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;

var builder = Host.CreateApplicationBuilder(args);
var config = AgentConfiguration.Load();

builder.Services.AddSingleton(config);
builder.Services.AddHostedService<AgentWorker>();

builder.Logging.ClearProviders();
Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.File(config.LogFilePath, rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Services.AddLogging(logging =>
{
    logging.AddSerilog();
});

builder.Services.AddHttpClient("control-plane", client =>
{
    client.BaseAddress = new Uri(config.ServerUrl);
});

var host = builder.Build();

if (OperatingSystem.IsWindows())
{
    await host.RunAsync();
}
else
{
    Console.WriteLine("Agent is intended to run on Windows.");
}
