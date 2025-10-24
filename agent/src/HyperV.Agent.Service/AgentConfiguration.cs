using System.Text.Json;

namespace HyperV.Agent.Service;

public class AgentConfiguration
{
    public string ServerUrl { get; set; } = "https://localhost:8080";
    public string EnrollmentToken { get; set; } = string.Empty;
    public string Hostname { get; set; } = Environment.MachineName;
    public string ConfigPath { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HyperVAgent", "agent.json");
    public string LogFilePath { get; set; } = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "HyperVAgent", "logs", "agent.log");

    public static AgentConfiguration Load()
    {
        var defaultConfig = new AgentConfiguration();
        if (!File.Exists(defaultConfig.ConfigPath))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(defaultConfig.ConfigPath)!);
            File.WriteAllText(defaultConfig.ConfigPath, JsonSerializer.Serialize(defaultConfig, new JsonSerializerOptions { WriteIndented = true }));
            return defaultConfig;
        }

        var json = File.ReadAllText(defaultConfig.ConfigPath);
        var config = JsonSerializer.Deserialize<AgentConfiguration>(json);
        if (config == null)
        {
            return defaultConfig;
        }

        Directory.CreateDirectory(Path.GetDirectoryName(config.LogFilePath)!);
        return config;
    }
}
