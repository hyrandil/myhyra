using System.Net.Http.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HyperV.Agent.Service;

public class AgentWorker : BackgroundService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AgentConfiguration _configuration;
    private readonly ILogger<AgentWorker> _logger;
    private Guid? _hostId;

    public AgentWorker(IHttpClientFactory httpClientFactory, AgentConfiguration configuration, ILogger<AgentWorker> logger)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RegisterAsync(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_hostId == null)
                {
                    await RegisterAsync(stoppingToken);
                }

                if (_hostId != null)
                {
                    await SendHeartbeatAsync(_hostId.Value, stoppingToken);
                    await SendInventoryAsync(_hostId.Value, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Agent loop error");
            }

            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task RegisterAsync(CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("control-plane");
        var response = await client.PostAsJsonAsync("/api/agent/register", new
        {
            Hostname = _configuration.Hostname,
            Ip = "127.0.0.1",
            AgentVersion = "0.1.0",
            Os = Environment.OSVersion.VersionString,
            HyperVVersion = "10.0",
            TotalCpuCores = Environment.ProcessorCount,
            TotalRamMb = (int)(GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / (1024 * 1024)),
            TotalStorageGb = 512
        }, cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            var result = await response.Content.ReadFromJsonAsync<RegistrationResponse>(cancellationToken: cancellationToken);
            if (result != null)
            {
                _hostId = result.HostId;
                _logger.LogInformation("Registered with host id {HostId}", _hostId);
            }
        }
        else
        {
            _logger.LogWarning("Registration failed with status {StatusCode}", response.StatusCode);
        }
    }

    private async Task SendHeartbeatAsync(Guid hostId, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("control-plane");
        var response = await client.PostAsJsonAsync($"/api/agent/{hostId}/heartbeat", new
        {
            Hostname = _configuration.Hostname,
            Os = Environment.OSVersion.VersionString,
            AgentVersion = "0.1.0",
            TotalCpuCores = Environment.ProcessorCount,
            TotalRamMb = (int)(GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / (1024 * 1024)),
            TotalStorageGb = 512,
            CpuPct = 20.0,
            MemUsedMb = 4096,
            MemPct = 30.5,
            StorageUsedGb = 100.5,
            Ts = DateTimeOffset.UtcNow
        }, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Heartbeat failed: {StatusCode}", response.StatusCode);
        }
    }

    private async Task SendInventoryAsync(Guid hostId, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient("control-plane");
        var inventory = new
        {
            VirtualMachines = new[]
            {
                new
                {
                    Name = "example-vm",
                    CpuCores = 2,
                    MemoryMb = 4096,
                    StorageGb = 60,
                    State = "Running",
                    OsImage = "win2022-core",
                    Ip = "192.168.0.10"
                }
            }
        };

        var response = await client.PostAsJsonAsync($"/api/agent/{hostId}/inventory", inventory, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Inventory failed: {StatusCode}", response.StatusCode);
        }
    }

    private sealed record RegistrationResponse(Guid HostId, string CertificatePem);
}
