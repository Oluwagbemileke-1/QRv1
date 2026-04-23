using QRSystem.API.Core.DTOs;

namespace QRSystem.API.Services.Interfaces
{
    public interface IScanService
    {
        Task<ScanResponseDto> ProcessScanAsync(string payload, string ipAddress, string username, string eventCode, string? location, double? latitude, double? longitude);
        Task<IEnumerable<ScanAttemptDto>> GetSessionScansAsync(Guid eventId);
        Task<IEnumerable<ScanAttemptDto>> GetSuccessfulScansAsync(Guid eventId);
        Task<EventStatsDto> GetSessionStatsAsync(Guid eventId);
    }
}
