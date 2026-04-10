namespace QRSystem.API.Core.DTOs
{
    public class QrCodeResponseDto
    {
        public Guid Id { get; set; }
        public Guid EventId { get; set; }
        public string ImageUrl { get; set; } = string.Empty;
        public DateTime GeneratedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
        //public string? Payload { get; set; }

    }
}
