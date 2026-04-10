using QRSystem.API.Core.Models;

namespace QRSystem.API.Infrastructure.Repositories.Interfaces
{
    public interface IFraudLogRepository
    {
        Task AddAsync(FraudLog entity);
        Task<IEnumerable<FraudLog>> GetBySessionAsync(Guid eventId);
        Task<IEnumerable<FraudLog>> GetByIpAddressAsync(string ipAddress);
        Task<IEnumerable<FraudLog>> GetByUsernameAsync(string username);
        Task<int> GetFraudCountBySessionAsync(Guid eventId);
        Task<bool> IpHasBeenFlaggedAsync(string ipAddress);
    }
}
