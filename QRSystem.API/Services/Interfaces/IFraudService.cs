using QRSystem.API.Core.DTOs;
using QRSystem.API.Core.Models;

namespace QRSystem.API.Services.Interfaces
{
    public interface IFraudService
    {
        Task<bool> CheckForFraudAsync(
            string ipAddress,
            string username,
            Guid sessionId,
            QrCode? qrCode,
            string scannedPayload);

        Task LogFraudAsync(
            string ipAddress,
            string username,
            Guid sessionId,
            Guid? qrCodeId,
            string reason,
            string? details = null);

        Task<IEnumerable<FraudLogDto>> GetSessionFraudLogsAsync(Guid sessionId);
        Task<int> GetFraudCountAsync(Guid sessionId);
    }
}
