namespace QRSystem.API.Core.DTOs
{
    public class QrCodeResponseDto
    {
        public Guid Id { get; set; }
        public Guid EventId { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public DateTimeOffset GeneratedAt { get; set; }
        public DateTimeOffset ExpiresAt { get; set; }
        public string? Payload { get; set; }

    }
}
