using QRSystem.API.Core.Constants;

namespace QRSystem.API.Core.Models
{
    public class ScanAttempt
    {
        public Guid Id { get; private set; }
        public string Username { get; private set; } = string.Empty;
        public string IpAddress { get; private set; } = string.Empty;
        public string? Location { get; private set; }
        public double? Latitude { get; private set; }
        public double? Longitude { get; private set; }
        public DateTime ScannedAt { get; private set; }
        public string Result { get; private set; } = string.Empty;
        public Guid? QrCodeId { get; private set; }
        public Guid EventId { get; private set; }

        // Navigation
        public QrCode QrCode { get; private set; } = null!;

        private ScanAttempt() { }

        public static ScanAttempt Create(
            string username,
            string ipAddress,
            Guid? qrCodeId,
            Guid eventId,
            string result,
            string? location = null,
            double? latitude = null,
            double? longitude = null)
        {
            return new ScanAttempt
            {
                Id = Guid.NewGuid(),
                Username = username,
                IpAddress = ipAddress,
                QrCodeId = qrCodeId,
                EventId = eventId,
                Result = result,
                Location = location,
                Latitude = latitude,
                Longitude = longitude,
                ScannedAt = DateTime.UtcNow
            };
        }
    }
}
