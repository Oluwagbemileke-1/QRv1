using QRSystem.API.Services.Interfaces;
using System.Text.Json;

namespace QRSystem.API.Services.Implementation
{
    public class GeoLocationService
    {
        public class GeolocationService : IGeolocationService
        {
            private readonly HttpClient _httpClient;
            private readonly ILogger<GeolocationService> _logger;

            public GeolocationService(HttpClient httpClient, ILogger<GeolocationService> logger)
            {
                _httpClient = httpClient;
                _logger = logger;
            }

            public async Task<string?> GetLocationAsync(string? ipAddress)
            {
                if (string.IsNullOrEmpty(ipAddress) || ipAddress == "::1" || ipAddress == "127.0.0.1")
                    return "Local";

                try
                {
                    var response = await _httpClient.GetFromJsonAsync<JsonElement>(
                        $"http://ip-api.com/json/{ipAddress}?fields=country,regionName,city,status");

                    if (response.GetProperty("status").GetString() == "success")
                    {
                        var city = response.GetProperty("city").GetString();
                        var region = response.GetProperty("regionName").GetString();
                        var country = response.GetProperty("country").GetString();
                        return $"{city}, {region}, {country}";
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to get location for IP: {IpAddress}", ipAddress);
                }

                return null;
            }
        }
    }
}
