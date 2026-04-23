namespace QRSystem.API.Services.Interfaces
{
    public interface IDjangoValidationService
    {
        Task<(bool Allowed, string Message)> ValidateScanAccessAsync(
                 string username,
                 string eventCode,
                 string? ipAddress = null,
                 string? deviceInfo = null,
                 string? location = null,
                 double? latitude = null,
                 double? longitude = null

             );
    }

}
