using QRSystem.API.Core.Models;

namespace QRSystem.API.Infrastructure.Repositories.Interfaces
{
    public interface IScanAttemptRepository
    {
        Task AddAsync(ScanAttempt entity);
        Task<bool> IpAlreadyScannedAsync(string ipAddress, Guid eventId);
        Task<bool> UserAlreadyScannedAsync(string username, Guid eventId);
        Task<IEnumerable<ScanAttempt>> GetBySessionAsync(Guid eventId);
        Task<IEnumerable<ScanAttempt>> GetSuccessfulScansBySessionAsync(Guid eventId);
        Task<IEnumerable<ScanAttempt>> GetSuccessfulScansByUsernameAsync(string username);
        Task<int> GetUniqueIpCountAsync(Guid eventId);
        Task<IEnumerable<ScanAttempt>> GetByIpAddressAsync(string ipAddress);
    }
}
