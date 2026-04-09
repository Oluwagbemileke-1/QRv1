namespace QRSystem.API.Core.DTOs
{
    public class ScanAttemptDto
    {
        public string Username { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Result { get; set; } = string.Empty;
        public string? Location { get; set; }
        public DateTime ScannedAt { get; set; }
    }
}
