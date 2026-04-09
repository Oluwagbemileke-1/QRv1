using QRSystem.API.Core.Models;

namespace QRSystem.API.Core.Models
{
    public class QrCode
    {
        public Guid Id { get; private set; }
        public string Payload { get; private set; } = string.Empty;
        public string ImageUrl { get; private set; } = string.Empty;
        public DateTime GeneratedAt { get; private set; }
        public DateTime ExpiresAt { get; private set; }
        public bool IsActive { get; private set; }
        public Guid SessionId { get; private set; }

        public ICollection<ScanAttempt> ScanAttempts { get; private set; } = new List<ScanAttempt>();

        private QrCode() { }

        public static QrCode Create(Guid sessionId, string payload, string imageUrl)
        {
            return new QrCode
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId,
                Payload = payload,
                ImageUrl = imageUrl,
                GeneratedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(1),
                IsActive = true
            };
        }

        public void Deactivate() => IsActive = false;
        public bool IsExpired() => DateTime.UtcNow > ExpiresAt;
    }
}