using QRSystem.API.Core.Models;

namespace QRSystem.API.Infrastructure.Repositories.Interfaces
{
    public interface IQrCodeRepository
    {
        Task<QrCode?> GetByIdAsync(Guid id);
        Task AddAsync(QrCode entity);
        Task UpdateAsync(QrCode entity);
        Task<QrCode?> GetActiveQrBySessionAsync(Guid sessionId);
        Task DeactivateExpiredQrCodesAsync();
        Task<bool> SessionHasActiveQrAsync(Guid sessionId);
    }
}
