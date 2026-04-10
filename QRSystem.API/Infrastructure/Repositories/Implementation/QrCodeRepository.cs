using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using QRSystem.API.Core.Data;
using QRSystem.API.Core.Models;
using QRSystem.API.Infrastructure.Repositories.Interfaces;

namespace QRSystem.API.Infrastructure.Repositories.Implementations
{
    public class QrCodeRepository : IQrCodeRepository
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;

        public QrCodeRepository(AppDbContext context, IMemoryCache cache)
        {
            _context = context;
            _cache = cache;
        }

        public async Task<QrCode?> GetByIdAsync(Guid id)
            => await _context.QrCodes.FindAsync(id);

        public async Task AddAsync(QrCode entity)
        {
            await _context.QrCodes.AddAsync(entity);
            await _context.SaveChangesAsync();

            // cache the newly created QR immediately so the first scan hits cache
            var cacheKey = $"active_qr_{entity.EventId}";
            _cache.Set(cacheKey, entity, TimeSpan.FromSeconds(55));
        }

        public async Task UpdateAsync(QrCode entity)
        {
            _context.QrCodes.Update(entity);
            await _context.SaveChangesAsync();

            // update cache with the new version
            var cacheKey = $"active_qr_{entity.EventId}";
            _cache.Set(cacheKey, entity, TimeSpan.FromSeconds(55));
        }

        public async Task<QrCode?> GetActiveQrBySessionAsync(Guid eventId)
        {
            var cacheKey = $"active_qr_{eventId}";

            // return from cache if available - avoids DB hit on every scan
            if (_cache.TryGetValue(cacheKey, out QrCode? cachedQr))
                return cachedQr;

            // not in cache - go to DB
            var qrCode = await _context.QrCodes
                .Where(q => q.EventId == eventId
                         && q.IsActive
                         && q.ExpiresAt > DateTime.UtcNow)
                .FirstOrDefaultAsync();

            if (qrCode != null)
            {
                // cache for 55 seconds - slightly less than 1 minute rotation
                // so cache always expires before the QR does
                _cache.Set(cacheKey, qrCode, TimeSpan.FromSeconds(55));
            }

            return qrCode;
        }

        public async Task<IEnumerable<QrCode>> GetBySessionAsync(Guid eventId)
            => await _context.QrCodes
                .Where(q => q.EventId == eventId)
                .OrderByDescending(q => q.GeneratedAt)
                .ToListAsync();

        public async Task DeactivateExpiredQrCodesAsync()
        {
            var expired = await _context.QrCodes
                .Where(q => q.IsActive && q.ExpiresAt <= DateTime.UtcNow)
                .ToListAsync();

            foreach (var qr in expired)
            {
                qr.Deactivate();
                // clear cache so next scan doesnt get the deactivated QR
                _cache.Remove($"active_qr_{qr.EventId}");
            }

            await _context.SaveChangesAsync();
        }

        public async Task<bool> SessionHasActiveQrAsync(Guid eventId)
        {
            var cacheKey = $"active_qr_{eventId}";

            // if its in cache it means theres an active QR
            if (_cache.TryGetValue(cacheKey, out _))
                return true;

            return await _context.QrCodes
                .AnyAsync(q => q.EventId == eventId
                            && q.IsActive
                            && q.ExpiresAt > DateTime.UtcNow);
        }
    }
}