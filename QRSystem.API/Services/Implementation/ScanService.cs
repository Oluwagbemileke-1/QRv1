using QRSystem.API.Core.Constants;
using QRSystem.API.Core.DTOs;
using QRSystem.API.Core.Models;
using QRSystem.API.Infrastructure.Repositories.Interfaces;
using QRSystem.API.Services.Interfaces;
using System.Security.Cryptography;
using System.Text;

namespace QRSystem.API.Infrastructure.Repositories.Implementation
{
    public class ScanService : IScanService
    {
        private readonly IScanAttemptRepository _scanRepository;
        private readonly IQrCodeRepository _qrCodeRepository;
        private readonly IFraudService _fraudService;
        private readonly ILogger<ScanService> _logger;
        private readonly string _secretKey;

        public ScanService(
            IScanAttemptRepository scanRepository,
            IQrCodeRepository qrCodeRepository,
            IFraudService fraudService,
            ILogger<ScanService> logger,
            IConfiguration configuration)
        {
            _scanRepository = scanRepository;
            _qrCodeRepository = qrCodeRepository;
            _fraudService = fraudService;
            _logger = logger;
            _secretKey = configuration["QrSettings:SecretKey"];
        }

        public async Task<ScanResponseDto> ProcessScanAsync(string payload, string? ipAddress, string username)
        {
            try
            {
                // 1. Validate payload format
                var parts = payload.Split(':');
                if (parts.Length != 3)
                {
                    _logger.LogWarning("Invalid payload format from {Username}, IP: {IpAddress}", username, ipAddress);
                    return new ScanResponseDto
                    {
                        Result = ScanResults.InvalidPayload,
                        Message = "Invalid QR code payload",
                        ScannedAt = DateTime.UtcNow
                    };
                }

                var eventId = Guid.Parse(parts[0]);
                var expiryTicks = parts[1];
                var signature = parts[2];
                var data = $"{parts[0]}:{parts[1]}";

                // 2. Verify signature
                using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_secretKey));
                var computedSignature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(data)));

                if (computedSignature != signature)
                {
                    _logger.LogWarning("Invalid signature for EventId: {EventId}", eventId);
                    return new ScanResponseDto
                    {
                        Result = ScanResults.InvalidPayload,
                        Message = "Invalid QR code",
                        ScannedAt = DateTime.UtcNow
                    };
                }

                // 3. Check expiry — fixed: DateTimeKind.Utc ensures correct comparison
                var expiry = new DateTime(long.Parse(expiryTicks), DateTimeKind.Utc);
                if (DateTime.UtcNow > expiry)
                {
                    _logger.LogWarning("Expired QR for EventId: {EventId}", eventId);
                    return new ScanResponseDto
                    {
                        Result = ScanResults.Expired,
                        Message = "QR code expired",
                        ScannedAt = DateTime.UtcNow
                    };
                }

                // 4. Look up active QR code
                var qrCode = await _qrCodeRepository.GetActiveQrBySessionAsync(eventId);
                if (qrCode == null)
                {
                    return new ScanResponseDto
                    {
                        Result = ScanResults.NotFound,
                        Message = "QR code not found",
                        ScannedAt = DateTime.UtcNow
                    };
                }

                // 5. Run fraud checks (duplicate IP, rapid rescan, already attended etc.)
                var isFraud = await _fraudService.CheckForFraudAsync(
                    ipAddress, username, eventId, qrCode, payload
                );

                if (isFraud)
                {
                    await _scanRepository.AddAsync(ScanAttempt.Create(
                        username, ipAddress, qrCode.Id, eventId, ScanResults.Fraud
                    ));

                    return new ScanResponseDto
                    {
                        Result = ScanResults.Fraud,
                        Message = "Fraudulent scan attempt detected",
                        ScannedAt = DateTime.UtcNow
                    };
                }

                // 6. Mark attendance
                await _scanRepository.AddAsync(ScanAttempt.Create(
                    username, ipAddress, qrCode.Id, eventId, ScanResults.Success
                ));

                // 7. Deactivate QR so it can't be reused
                qrCode.Deactivate();
                await _qrCodeRepository.UpdateAsync(qrCode);

                return new ScanResponseDto
                {
                    Result = ScanResults.Success,
                    Message = "Attendance marked successfully",
                    ScannedAt = DateTime.UtcNow
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing scan for Username: {Username}, IP: {IpAddress}", username, ipAddress);
                throw;
            }
        }

        public async Task<IEnumerable<ScanAttemptDto>> GetSessionScansAsync(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching all scans for EventId: {EventId}", eventId);

                var scans = await _scanRepository.GetBySessionAsync(eventId);
                var result = scans.Select(s => new ScanAttemptDto
                {
                    Username = s.Username,
                    IpAddress = s.IpAddress,
                    Result = s.Result,
                    Location = s.Location,
                    ScannedAt = s.ScannedAt
                }).ToList();

                _logger.LogInformation("Retrieved {Count} scans for EventId: {EventId}", result.Count, eventId);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching scans for EventId: {EventId}", eventId);
                throw;
            }
        }

        public async Task<IEnumerable<ScanAttemptDto>> GetSuccessfulScansAsync(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching successful scans for EventId: {EventId}", eventId);

                var scans = await _scanRepository.GetSuccessfulScansBySessionAsync(eventId);
                var result = scans.Select(s => new ScanAttemptDto
                {
                    Username = s.Username,
                    IpAddress = s.IpAddress,
                    Result = s.Result,
                    Location = s.Location,
                    ScannedAt = s.ScannedAt
                }).ToList();

                _logger.LogInformation("Retrieved {Count} successful scans for EventId: {EventId}", result.Count, eventId);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching successful scans for EventId {EventId}", eventId);
                throw;
            }
        }

        public async Task<EventStatsDto> GetSessionStatsAsync(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching event stats for EventId: {EventId}", eventId);

                var allScans = await _scanRepository.GetBySessionAsync(eventId);
                var successfulScans = await _scanRepository.GetSuccessfulScansBySessionAsync(eventId);
                var fraudCount = await _fraudService.GetFraudCountAsync(eventId);
                var uniqueIps = await _scanRepository.GetUniqueIpCountAsync(eventId);

                var stats = new EventStatsDto
                {
                    EventId = eventId,
                    TotalScans = allScans.Count(),
                    SuccessfulScans = successfulScans.Count(),
                    FraudAttempts = fraudCount,
                    UniqueIps = uniqueIps
                };

                _logger.LogInformation(
                    "Stats for EventId: {EventId} — Total: {Total}, Successful: {Successful}, Fraud: {Fraud}, UniqueIps: {UniqueIps}",
                    eventId, stats.TotalScans, stats.SuccessfulScans, stats.FraudAttempts, stats.UniqueIps);

                return stats;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching event stats for EventId: {Eventd}", eventId);
                throw;
            }
        }
    }
}
