using Microsoft.Extensions.Options;
using QRSystem.API.Core.DTOs;
using QRSystem.API.Core.Models;
using QRSystem.API.Core.Settings;
using QRSystem.API.Infrastructure.Repositories.Interfaces;
using QRSystem.API.Services.Interfaces;
using QRCoder;
using System.Security.Cryptography;
using System.Text;

namespace QRSystem.API.Infrastructure.Repositories.Implementation
{
    public class QrService : IQrService
    {
        private readonly IQrCodeRepository _qrCodeRepository;
        private readonly QrSettings _settings;
        private readonly ILogger<QrService> _logger;

        private static readonly TimeZoneInfo _watZone =
            TimeZoneInfo.FindSystemTimeZoneById("Africa/Lagos");

        public QrService(
            IQrCodeRepository qrCodeRepository,
            IOptions<QrSettings> options,
            ILogger<QrService> logger)
        {
            _qrCodeRepository = qrCodeRepository;
            _settings = options.Value;
            _logger = logger;
        }

        public async Task<QrCodeResponseDto> GenerateQrAsync(Guid eventId, string eventCode)
        {
            try
            {
                _logger.LogInformation("Starting QR generation for EventId: {EventId}", eventId);

                await _qrCodeRepository.DeactivateExpiredQrCodesAsync();

                var payload = GeneratePayload(eventId);
                _logger.LogDebug("Payload generated for EventId: {EventId}", eventId);

                var checkInUrl =
                    $"{_settings.FrontendUrl.TrimEnd('/')}/check-in" +
                    $"?payload={Uri.EscapeDataString(payload)}" +
                    $"&event_code={Uri.EscapeDataString(eventCode)}";

                var imageUrl = GenerateQrImage(checkInUrl);
                _logger.LogDebug("QR image generated for EventId: {EventId}", eventId);

                var qrCode = QrCode.Create(eventId, payload, imageUrl);
                await _qrCodeRepository.AddAsync(qrCode);

                return new QrCodeResponseDto
                {
                    Id = qrCode.Id,
                    EventId = qrCode.EventId,
                    ImageUrl = qrCode.ImageUrl,
                    Payload = payload,
                    GeneratedAt = TimeZoneInfo.ConvertTimeFromUtc(qrCode.GeneratedAt, _watZone),
                    ExpiresAt = TimeZoneInfo.ConvertTimeFromUtc(qrCode.ExpiresAt, _watZone),
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating QR code for EventId: {EventId}", eventId);
                throw;
            }
        }

        public async Task RotateExpiredQrCodesAsync()
        {
            try
            {
                await _qrCodeRepository.DeactivateExpiredQrCodesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error rotating expired QR codes");
                throw;
            }
        }

        private string GeneratePayload(Guid eventId)
        {
            var expiryTicks = DateTime.UtcNow.AddMinutes(1).Ticks;
            var data = $"{eventId}:{expiryTicks}";

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_settings.SecretKey));
            var signatureBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
            var signature = Convert.ToBase64String(signatureBytes);

            return $"{data}:{signature}";
        }

        private string GenerateQrImage(string content)
        {
            using var qrGenerator = new QRCodeGenerator();
            var qrCodeData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            var qrCodeBytes = qrCode.GetGraphic(20);
            return $"data:image/png;base64,{Convert.ToBase64String(qrCodeBytes)}";
        }
    }
}











