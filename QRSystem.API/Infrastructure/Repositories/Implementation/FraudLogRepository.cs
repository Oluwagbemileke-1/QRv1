using Microsoft.EntityFrameworkCore;
using QRSystem.API.Core.Data;
using QRSystem.API.Core.Models;
using QRSystem.API.Infrastructure.Repositories.Interfaces;

namespace QRSystem.API.Infrastructure.Repositories.Implementations
{
    public class FraudLogRepository : IFraudLogRepository
    {
        private readonly AppDbContext _context;
        public FraudLogRepository(AppDbContext context)
        {
            _context = context;
        }
        public async Task AddAsync(FraudLog entity)
        {
            await _context.FraudLogs.AddAsync(entity);
            await _context.SaveChangesAsync();
        }

        public async Task<IEnumerable<FraudLog>> GetBySessionAsync(Guid eventId)
            => await _context.FraudLogs
                .Where(f => f.EventId == eventId)
                .OrderByDescending(f => f.DetectedAt)
                .ToListAsync();

        public async Task<IEnumerable<FraudLog>> GetByIpAddressAsync(string ipAddress)
            => await _context.FraudLogs
                .Where(f => f.IpAddress == ipAddress)
                .OrderByDescending(f => f.DetectedAt)
                .ToListAsync();

        public async Task<IEnumerable<FraudLog>> GetByUsernameAsync(string username)
            => await _context.FraudLogs
                .Where(f => f.Username == username)
                .OrderByDescending(f => f.DetectedAt)
                .ToListAsync();

        public async Task<int> GetFraudCountBySessionAsync(Guid eventId)
            => await _context.FraudLogs
                .CountAsync(f => f.EventId == eventId);

        public async Task<bool> IpHasBeenFlaggedAsync(string ipAddress)
            => await _context.FraudLogs
                .AnyAsync(f => f.IpAddress == ipAddress);
    }
}
