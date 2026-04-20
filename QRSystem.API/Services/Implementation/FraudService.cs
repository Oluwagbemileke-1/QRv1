using Microsoft.Extensions.Options;
using QRSystem.API.Core.Constants;
using QRSystem.API.Core.DTOs;
using QRSystem.API.Core.Models;
using QRSystem.API.Core.Settings;
using QRSystem.API.Infrastructure.Repositories.Interfaces;
using QRSystem.API.Services.Interfaces;
using System.Security.Cryptography;
using System.Text;

namespace QR.API.Services.Implementations
{
    public class FraudService : IFraudService
    {
        private readonly IFraudLogRepository _fraudLogRepository;
        private readonly IScanAttemptRepository _scanRepository;
        private readonly QrSettings _settings;
        private readonly ILogger<FraudService> _logger;
        private static readonly TimeZoneInfo _watZone =
       TimeZoneInfo.FindSystemTimeZoneById("Africa/Lagos");

        public FraudService(
            IFraudLogRepository fraudLogRepository,
            IScanAttemptRepository scanRepository,
            IOptions<QrSettings> options,
            ILogger<FraudService> logger)
        {
            _fraudLogRepository = fraudLogRepository;
            _scanRepository = scanRepository;
            _settings = options.Value;
            _logger = logger;
        }

        public async Task<bool> CheckForFraudAsync(
            string? ipAddress,
            string username,
            Guid eventId,
            QrCode? qrCode,
            string scannedPayload)
        {
            try
            {
                _logger.LogDebug(
                    "Running fraud checks for Username: {Username}, IP: {IpAddress}, EventId: {EventId}",
                    username, ipAddress, eventId);

                // check 1 - QR does not exist
                if (qrCode == null)
                {
                    _logger.LogWarning("Fraud check 1 failed — no active QR found. Username: {Username}, EventId: {EventId}", username, eventId);
                    await LogFraudAsync(ipAddress, username, eventId, Guid.Empty,
                        FraudReasons.Tampered, details: "No active QR found for this event");
                    return true;
                }
                // check 2 - QR has expired
                if (qrCode.IsExpired())
                {
                    _logger.LogWarning(
                        "Fraud check 2 failed — QR code expired. Username: {Username}, QrCodeId: {QrCodeId}, EventId: {EventId}",
                        username, qrCode.Id, eventId);
                    await LogFraudAsync(ipAddress, username, eventId, qrCode.Id,
                        FraudReasons.ExpiredQrCode, details: "Attempted to use an expired QR code");
                    return true;
                }

                // check 3 - payload tampered / signature invalid
                if (!VerifyPayload(scannedPayload))
                {
                    _logger.LogWarning(
                        "Fraud check 3 failed — payload signature mismatch. Username: {Username}, IP: {IpAddress}, EventId: {EventId}",
                        username, ipAddress, eventId);
                    await LogFraudAsync(ipAddress, username, eventId, qrCode.Id,
                        FraudReasons.Tampered, details: "Payload signature mismatch detected");
                    return true;
                }

                // fetch all event scans ONCE and reuse for all remaining checks
                // this replaces 4 separate DB calls with 1
                var sessionScans = (await _scanRepository.GetBySessionAsync(eventId)).ToList();
                _logger.LogDebug("Loaded {Count} existing scans for EventId: {EventId}", sessionScans.Count, eventId);

                // check 4 - same IP already has a successful scan in this event
                var duplicateIp = sessionScans.Any(s => s.IpAddress == ipAddress && s.Result == ScanResults.Success);
                if (duplicateIp)
                {
                    _logger.LogWarning(
                        "Fraud check 4 failed — duplicate IP with successful scan. IP: {IpAddress}, EventId: {EventId}",
                        ipAddress, eventId);
                    await LogFraudAsync(ipAddress, username, eventId, qrCode.Id,
                        FraudReasons.DuplicateIp,
                        details: $"IP {ipAddress} already used to scan in this event");
                    return true;
                }

                // check 5 - multiple accounts scanning from same IP in this event
                var scansFromIp = sessionScans.Where(s => s.IpAddress == ipAddress).ToList();
                if (scansFromIp.Count > 1)
                {
                    _logger.LogWarning(
                        "Fraud check 5 failed — multiple accounts from same IP. IP: {IpAddress}, Count: {Count}, EventId: {EventId}",
                        ipAddress, scansFromIp.Count, eventId);
                    await LogFraudAsync(ipAddress, username, eventId, qrCode.Id,
                        FraudReasons.MultipleAccountsSameIp,
                        details: $"IP {ipAddress} used by multiple accounts in this event");
                    return true;
                }

                // check 6 - same user scanning too fast within 30 seconds
                var lastScan = sessionScans
                    .Where(s => s.Username == username)
                    .OrderByDescending(s => s.ScannedAt)
                    .FirstOrDefault();

                if (lastScan != null && (DateTime.UtcNow - lastScan.ScannedAt).TotalSeconds < 30)
                {
                    var secondsAgo = (DateTime.UtcNow - lastScan.ScannedAt).TotalSeconds;
                    _logger.LogWarning(
                        "Fraud check 6 failed — rapid rescan. Username: {Username} scanned {Seconds:F1}s ago, EventId: {EventId}",
                        username, secondsAgo, eventId);
                    await LogFraudAsync(ipAddress, username, eventId, qrCode.Id,
                        FraudReasons.RapidRescan,
                        details: $"{username} scanned again within 30 seconds");
                    return true;
                }

                // check 7 - user already attended this event
                var alreadyAttended = sessionScans.Any(s => s.Username == username && s.Result == ScanResults.Success);
                if (alreadyAttended)
                {
                    _logger.LogWarning(
                        "Fraud check 7 failed — user already attended. Username: {Username}, EventId: {EventId}",
                        username, eventId);
                    await LogFraudAsync(ipAddress, username, eventId, qrCode.Id,
                        FraudReasons.AlreadyAttended,
                        details: $"{username} already marked attendance for this event");
                    return true;
                }

                _logger.LogDebug(
                    "All fraud checks passed for Username: {Username}, IP: {IpAddress}, EventId: {EventId}",
                    username, ipAddress, eventId);

                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error running fraud checks for Username: {Username}, EventId: {EventId}", username, eventId);
                throw;
            }
        }

        public async Task LogFraudAsync(
            string? ipAddress,
            string username,
            Guid eventId,
            Guid? qrCodeId,
            string reason,
            string? details = null)
        {
            try
            {
                _logger.LogInformation(
                    "Logging fraud event — Username: {Username}, IP: {IpAddress}, EventId: {EventId}, Reason: {Reason}",
                    username, ipAddress, eventId, reason);

                var fraudLog = FraudLog.Create(
                    username: username,
                    ipAddress: ipAddress,
                    eventId: eventId,
                    qrCodeId: qrCodeId,
                    reason: reason,
                    details: details
                );

                await _fraudLogRepository.AddAsync(fraudLog);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error logging fraud event for Username: {Username}, EventId: {EventId}", username, eventId);
                throw;
            }
        }

        public async Task<IEnumerable<FraudLogDto>> GetSessionFraudLogsAsync(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching fraud logs for EventId: {EventId}", eventId);

                var logs = await _fraudLogRepository.GetBySessionAsync(eventId);
                var result = logs.Select(f => new FraudLogDto
                {
                    Username = f.Username,
                    IpAddress = f.IpAddress,
                    Reason = f.Reason,
                    Details = f.Details,
                    DetectedAt = TimeZoneInfo.ConvertTimeFromUtc(f.DetectedAt, _watZone) 
                }).ToList();

                _logger.LogInformation("Retrieved {Count} fraud logs for EventId: {EventId}", result.Count, eventId);
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching fraud logs for EventId: {EventId}", eventId);
                throw;
            }
        }

        public async Task<int> GetFraudCountAsync(Guid eventId)
        {
            try
            {
                _logger.LogDebug("Fetching fraud count for EventId: {EventId}", eventId);
                var count = await _fraudLogRepository.GetFraudCountBySessionAsync(eventId);
                _logger.LogDebug("Fraud count for EventId: {EventId} is {Count}", eventId, count);
                return count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching fraud count for EventId: {EventId}", eventId);
                throw;
            }
        }

        private bool VerifyPayload(string payload)
        {
            var parts = payload.Split(':');

            if (parts.Length != 3)
            {
                _logger.LogWarning("Payload verification failed — unexpected format, {PartCount} parts found", parts.Length);
                return false;
            }

            var eventId = parts[0];
            var expiryTicks = parts[1];
            var signature = parts[2];

            var data = $"{eventId}:{expiryTicks}";

            using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_settings.SecretKey));
            var computedBytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
            var computedSignature = Convert.ToBase64String(computedBytes);

            var isValidSignature = computedSignature == signature;

            if (!isValidSignature)
            {
                _logger.LogWarning("Payload signature verification failed for EventId: {eventId}", eventId);
                return false;
            }

            var expiry = new DateTime(long.Parse(expiryTicks), DateTimeKind.Utc);

            if (DateTime.UtcNow > expiry)
            {
                _logger.LogWarning("Payload expired for EventId: {EventId}", eventId);
                return false;
            }

            return true;
        }
    }
}



