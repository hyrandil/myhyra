namespace HvShop.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? PasswordHash { get; set; }
    public string? ExternalIdpSub { get; set; }
    public string Role { get; set; } = "customer";
    public ICollection<Order> Orders { get; set; } = new List<Order>();
    public ICollection<ApiKey> ApiKeys { get; set; } = new List<ApiKey>();
}
