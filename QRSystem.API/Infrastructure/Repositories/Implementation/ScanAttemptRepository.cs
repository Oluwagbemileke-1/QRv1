using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using QRSystem.API.Core.Constants;
using QRSystem.API.Core.Data;
using QRSystem.API.Core.Models;
using QRSystem.API.Infrastructure.Repositories.Interfaces;

namespace QRSystem.API.Infrastructure.Repositories.Implementations
{
    public class ScanAttemptRepository : IScanAttemptRepository
    {
        private readonly AppDbContext _context;

        public ScanAttemptRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(ScanAttempt entity)
        {
            await _context.ScanAttempts.AddAsync(entity);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> IpAlreadyScannedAsync(string ipAddress, Guid eventId)
            => await _context.ScanAttempts
                .AnyAsync(s => s.IpAddress == ipAddress
                            && s.EventId == eventId
                            && s.Result == ScanResults.Success);

        public async Task<bool> UserAlreadyScannedAsync(string username, Guid eventId)
            => await _context.ScanAttempts
                .AnyAsync(s => s.Username == username
                            && s.EventId == eventId
                            && s.Result == ScanResults.Success);

        public async Task<IEnumerable<ScanAttempt>> GetBySessionAsync(Guid eventId)
            => await _context.ScanAttempts
                .Where(s => s.EventId == eventId)
                .OrderByDescending(s => s.ScannedAt)
                .ToListAsync();

        public async Task<IEnumerable<ScanAttempt>> GetSuccessfulScansBySessionAsync(Guid eventId)
            => await _context.ScanAttempts
                .Where(s => s.EventId == eventId
                            && s.Result == ScanResults.Success)
                .OrderByDescending(s => s.ScannedAt)
                .ToListAsync();

        public async Task<IEnumerable<ScanAttempt>> GetSuccessfulScansByUsernameAsync(string username)
            => await _context.ScanAttempts
                .Where(s => s.Username == username
                            && s.Result == ScanResults.Success)
                .OrderByDescending(s => s.ScannedAt)
                .ToListAsync();

        public async Task<int> GetUniqueIpCountAsync(Guid eventId)
            => await _context.ScanAttempts
                .Where(s => s.EventId == eventId)
                .Select(s => s.IpAddress)
                .Distinct()
                .CountAsync();

        public async Task<IEnumerable<ScanAttempt>> GetByIpAddressAsync(string ipAddress)
            => await _context.ScanAttempts
                .Where(s => s.IpAddress == ipAddress)
                .OrderByDescending(s => s.ScannedAt)
                .ToListAsync();
    }

}
