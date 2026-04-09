namespace QRSystem.API.Core.DTOs
{
    public class FraudLogDto
    {
        public string Username { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Reason { get; set; } = string.Empty;
        public string? Details { get; set; }
        public DateTime DetectedAt { get; set; }
    }
}
