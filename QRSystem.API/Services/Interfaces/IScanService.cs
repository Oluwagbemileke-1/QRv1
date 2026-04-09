using QRSystem.API.Core.DTOs;

namespace QRSystem.API.Services.Interfaces
{
    public interface IScanService
    {
        Task<ScanResponseDto> ProcessScanAsync(string payload, string ipAddress, string username);
        Task<IEnumerable<ScanAttemptDto>> GetSessionScansAsync(Guid sessionId);
        Task<IEnumerable<ScanAttemptDto>> GetSuccessfulScansAsync(Guid sessionId);
        Task<SessionStatsDto> GetSessionStatsAsync(Guid sessionId);
    }
}
