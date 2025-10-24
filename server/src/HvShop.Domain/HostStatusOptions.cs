using System;

namespace HvShop.Domain;

public static class HostStatusOptions
{
    public static readonly TimeSpan OfflineThreshold = TimeSpan.FromSeconds(90);

    public static string ComputeStatus(DateTimeOffset? lastSeenUtc, DateTimeOffset utcNow)
    {
        if (lastSeenUtc is null)
        {
            return "offline";
        }

        return utcNow - lastSeenUtc.Value <= OfflineThreshold ? "online" : "offline";
    }
}
