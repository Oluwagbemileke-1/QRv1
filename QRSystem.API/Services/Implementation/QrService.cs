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

        public async Task<QrCodeResponseDto> GenerateQrAsync(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Starting QR generation for EventId: {EventId}", eventId);

                // deactivate any expired QRs for this event first
                _logger.LogDebug("Deactivating expired QR codes before generating new one for EventId: {EventId}", eventId);
                await _qrCodeRepository.DeactivateExpiredQrCodesAsync();



                // build the payload - what gets encoded into the QR image
                var payload = GeneratePayload(eventId);
                _logger.LogDebug("Payload generated for EventId: {EventId}", eventId);

                // build the QR image from the frontend check-in URL that includes the payload
                var checkInUrl =
                    $"{_settings.FrontendUrl.TrimEnd('/')}/check-in?payload={Uri.EscapeDataString(payload)}";

                var imageUrl = GenerateQrImage(checkInUrl);
                _logger.LogDebug("QR image generated for EventId: {EventId}", eventId);

                var qrCode = QrCode.Create(eventId, payload, imageUrl);
                await _qrCodeRepository.AddAsync(qrCode);

                _logger.LogInformation(
                    "QR code created successfully. QrCodeId: {QrCodeId}, EventId: {EventId}, ExpiresAt: {ExpiresAt}",
                    qrCode.Id, eventId, qrCode.ExpiresAt);

                // map model → DTO, payload never leaves this layer
                return new QrCodeResponseDto
                {
                    Id = qrCode.Id,
                    EventId = qrCode.EventId,
                    ImageUrl = qrCode.ImageUrl,
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
                _logger.LogInformation("Running expired QR code rotation job");
                await _qrCodeRepository.DeactivateExpiredQrCodesAsync();
                _logger.LogInformation("Expired QR code rotation completed");
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

        private string GenerateQrImage(string payload)
        {
            using var qrGenerator = new QRCodeGenerator();
            var qrCodeData = qrGenerator.CreateQrCode(payload, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            var qrCodeBytes = qrCode.GetGraphic(20);
            return $"data:image/png;base64,{Convert.ToBase64String(qrCodeBytes)}";
        }
    }
}
