namespace QRSystem.API.Services.Interfaces
{
    public interface IGeolocationService
    {
        Task<string?> GetLocationAsync(string? ipAddress);
    }

}
