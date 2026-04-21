using QRSystem.API.Core.DTOs;

namespace QRSystem.API.Services.Interfaces
{
    public interface IQrService
    {
        Task<QrCodeResponseDto> GenerateQrAsync(Guid eventId, string eventCode);
        Task RotateExpiredQrCodesAsync();
    }
}
