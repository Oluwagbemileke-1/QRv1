using QRSystem.API.Core.Models;

namespace QRSystem.API.Infrastructure.Repositories.Interfaces
{
    public interface IFraudLogRepository
    {
        Task AddAsync(FraudLog entity);
        Task<IEnumerable<FraudLog>> GetBySessionAsync(Guid sessionId);
        Task<IEnumerable<FraudLog>> GetByIpAddressAsync(string ipAddress);
        Task<IEnumerable<FraudLog>> GetByUsernameAsync(string username);
        Task<int> GetFraudCountBySessionAsync(Guid sessionId);
        Task<bool> IpHasBeenFlaggedAsync(string ipAddress);
    }
}
