using Microsoft.EntityFrameworkCore;
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

        public async Task<bool> IpAlreadyScannedAsync(string ipAddress, Guid sessionId)
            => await _context.ScanAttempts
                .AnyAsync(s => s.IpAddress == ipAddress
                            && s.SessionId == sessionId
                            && s.Result == ScanResults.Success);

        public async Task<bool> UserAlreadyScannedAsync(string username, Guid sessionId)
            => await _context.ScanAttempts
                .AnyAsync(s => s.Username == username
                            && s.SessionId == sessionId
                            && s.Result == ScanResults.Success);

        public async Task<IEnumerable<ScanAttempt>> GetBySessionAsync(Guid sessionId)
            => await _context.ScanAttempts
                .Where(s => s.SessionId == sessionId)
                .OrderByDescending(s => s.ScannedAt)
                .ToListAsync();

        public async Task<IEnumerable<ScanAttempt>> GetSuccessfulScansBySessionAsync(Guid sessionId)
            => await _context.ScanAttempts
                .Where(s => s.SessionId == sessionId
                            && s.Result == ScanResults.Success)
                .OrderByDescending(s => s.ScannedAt)
                .ToListAsync();

        public async Task<int> GetUniqueIpCountAsync(Guid sessionId)
            => await _context.ScanAttempts
                .Where(s => s.SessionId == sessionId)
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
