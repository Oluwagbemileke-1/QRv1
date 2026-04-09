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

        public QrService(
            IQrCodeRepository qrCodeRepository,
            IOptions<QrSettings> options,
            ILogger<QrService> logger)
        {
            _qrCodeRepository = qrCodeRepository;
            _settings = options.Value;
            _logger = logger;
        }

        public async Task<QrCodeResponseDto> GenerateQrAsync(Guid sessionId)
        {
            try
            {
                _logger.LogInformation("Starting QR generation for SessionId: {SessionId}", sessionId);

                // deactivate any expired QRs for this session first
                _logger.LogDebug("Deactivating expired QR codes before generating new one for SessionId: {SessionId}", sessionId);
                await _qrCodeRepository.DeactivateExpiredQrCodesAsync();

                // build the payload - what gets encoded into the QR image
                var payload = GeneratePayload(sessionId);
                _logger.LogDebug("Payload generated for SessionId: {SessionId}", sessionId);

                // build the QR image from the payload
                var imageUrl = GenerateQrImage(payload);
                _logger.LogDebug("QR image generated for SessionId: {SessionId}", sessionId);

                var qrCode = QrCode.Create(sessionId, payload, imageUrl);
                await _qrCodeRepository.AddAsync(qrCode);

                _logger.LogInformation(
                    "QR code created successfully. QrCodeId: {QrCodeId}, SessionId: {SessionId}, ExpiresAt: {ExpiresAt}",
                    qrCode.Id, sessionId, qrCode.ExpiresAt);

                // map model → DTO, payload never leaves this layer
                return new QrCodeResponseDto
                {
                    Id = qrCode.Id,
                    SessionId = qrCode.SessionId,
                    ImageUrl = qrCode.ImageUrl,
                    GeneratedAt = qrCode.GeneratedAt,
                    ExpiresAt = qrCode.ExpiresAt,
                    //Payload = payload
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating QR code for SessionId: {SessionId}", sessionId);
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

        private string GeneratePayload(Guid sessionId)
        {
            var expiryTicks = DateTime.UtcNow.AddMinutes(1).Ticks;
            var data = $"{sessionId}:{expiryTicks}";

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
