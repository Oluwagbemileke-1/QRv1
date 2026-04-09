using QRSystem.API.Core.Models;

namespace QRSystem.API.Infrastructure.Repositories.Interfaces
{
    public interface IScanAttemptRepository
    {
        Task AddAsync(ScanAttempt entity);
        Task<bool> IpAlreadyScannedAsync(string ipAddress, Guid sessionId);
        Task<bool> UserAlreadyScannedAsync(string username, Guid sessionId);
        Task<IEnumerable<ScanAttempt>> GetBySessionAsync(Guid sessionId);
        Task<IEnumerable<ScanAttempt>> GetSuccessfulScansBySessionAsync(Guid sessionId);
        Task<int> GetUniqueIpCountAsync(Guid sessionId);
        Task<IEnumerable<ScanAttempt>> GetByIpAddressAsync(string ipAddress);
    }
}
