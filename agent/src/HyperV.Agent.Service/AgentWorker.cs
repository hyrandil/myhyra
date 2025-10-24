using System.Diagnostics;
using System.IO;
using System.Net.Http.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.VisualBasic.Devices;

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
        var driveLetter = ResolveDriveLetter(_configuration.SystemDrive);
        double totalStorageGb = 0;
        try
        {
            (_, totalStorageGb, _) = ReadDisk(driveLetter);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sample disk size for drive {Drive}", driveLetter);
        }

        var totalRamMb = GetTotalRamMb();

            var response = await client.PostAsJsonAsync("/api/agent/register", new
            {
                Hostname = _configuration.Hostname,
                Ip = "127.0.0.1",
                AgentVersion = "0.1.0",
                Os = Environment.OSVersion.VersionString,
                HyperVVersion = "10.0",
                TotalCpuCores = Environment.ProcessorCount,
                TotalRamMb = totalRamMb,
                TotalStorageGb = (int)Math.Round(totalStorageGb)
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
        var driveLetter = ResolveDriveLetter(_configuration.SystemDrive);

        var metrics = await CollectMetricsAsync(driveLetter, cancellationToken);

        var response = await client.PostAsJsonAsync($"/api/agent/{hostId}/heartbeat", new
        {
            Hostname = _configuration.Hostname,
            Os = Environment.OSVersion.VersionString,
            AgentVersion = "0.1.0",
            TotalCpuCores = Environment.ProcessorCount,
            TotalRamMb = GetTotalRamMb(),
            TotalStorageGb = (int)Math.Round(metrics.TotalStorageGb),
            CpuPct = metrics.CpuPct,
            MemUsedMb = metrics.MemUsedMb,
            MemPct = metrics.MemPct,
            StorageUsedGb = metrics.StorageUsedGb,
            Ts = DateTimeOffset.UtcNow
        }, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Heartbeat failed: {StatusCode}", response.StatusCode);
        }
    }

    private async Task<HostMetricSample> CollectMetricsAsync(string driveLetter, CancellationToken cancellationToken)
    {
        double cpuPct = 0;
        try
        {
            cpuPct = await ReadCpuPctAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sample CPU usage");
        }

        int memUsedMb = 0;
        double memPct = 0;
        try
        {
            (memUsedMb, memPct) = ReadMem();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sample memory usage");
        }

        double storageUsedGb = 0;
        double totalStorageGb = 0;
        try
        {
            (storageUsedGb, totalStorageGb, _) = ReadDisk(driveLetter);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to sample disk usage for drive {Drive}", driveLetter);
        }

        return new HostMetricSample(cpuPct, memUsedMb, memPct, storageUsedGb, totalStorageGb);
    }

    private static async Task<double> ReadCpuPctAsync(CancellationToken cancellationToken, int sampleMilliseconds = 500)
    {
        using var counter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
        _ = counter.NextValue();
        await Task.Delay(sampleMilliseconds, cancellationToken).ConfigureAwait(false);
        return Math.Round(counter.NextValue(), 1);
    }

    private static (int usedMb, double pct) ReadMem()
    {
        var info = new ComputerInfo();
        var total = (double)info.TotalPhysicalMemory;
        var available = (double)info.AvailablePhysicalMemory;
        var used = total - available;
        var usedMb = (int)Math.Round(used / (1024 * 1024));
        var pct = total > 0 ? Math.Round(used / total * 100, 1) : 0;
        return (usedMb, pct);
    }

    private static (double usedGb, double totalGb, double pctUsed) ReadDisk(string driveLetter)
    {
        var drive = new DriveInfo($"{driveLetter}:\\");
        var totalGb = drive.TotalSize / 1_000_000_000.0;
        var freeGb = drive.TotalFreeSpace / 1_000_000_000.0;
        var usedGb = totalGb - freeGb;
        var pct = totalGb > 0 ? Math.Round(usedGb / totalGb * 100, 1) : 0;
        return (Math.Round(usedGb, 1), Math.Round(totalGb, 1), pct);
    }

    private static int GetTotalRamMb()
    {
        var info = new ComputerInfo();
        return (int)Math.Round(info.TotalPhysicalMemory / (1024 * 1024.0));
    }

    private static string ResolveDriveLetter(string? drive)
    {
        if (string.IsNullOrWhiteSpace(drive))
        {
            return "C";
        }

        var trimmed = drive.Trim().TrimEnd(':');
        return trimmed.Length == 1 ? trimmed.ToUpperInvariant() : "C";
    }

    private sealed record HostMetricSample(double CpuPct, int MemUsedMb, double MemPct, double StorageUsedGb, double TotalStorageGb);

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
