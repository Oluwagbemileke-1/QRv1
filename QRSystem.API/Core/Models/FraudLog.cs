using QRSystem.API.Core.Constants;
namespace QRSystem.API.Core.Models
{
    public class FraudLog
    {
        public Guid Id { get; private set; }
        public string IpAddress { get; private set; } = string.Empty;
        public string Username { get; private set; } = string.Empty;
        public string Reason { get; private set; }
        public string? Details { get; private set; }
        public DateTime DetectedAt { get; private set; }
        public Guid EventId { get; private set; }
        public Guid? QrCodeId { get; private set; }

        private FraudLog() { }

        public static FraudLog Create(
            string username,
            string ipAddress,
            Guid eventId,
            Guid? qrCodeId,
            string reason,
            string? details = null)
        {
            return new FraudLog
            {
                Id = Guid.NewGuid(),
                Username = username,
                IpAddress = ipAddress,
                EventId = eventId,
                QrCodeId = qrCodeId,
                Reason = reason,
                Details = details,
                DetectedAt = DateTime.UtcNow
            };
        }
    }
}
