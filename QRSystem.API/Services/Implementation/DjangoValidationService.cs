using System.Net.Http.Json;
using System.Text.Json;
using QRSystem.API.Services.Interfaces;

namespace QRSystem.API.Services.Implementations
{
    public class DjangoValidationService : IDjangoValidationService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<DjangoValidationService> _logger;
        private readonly string _internalToken;

        public DjangoValidationService(
            HttpClient httpClient,
            ILogger<DjangoValidationService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _internalToken = configuration["InternalService:Token"] ?? string.Empty;
        }

        public async Task<(bool Allowed, string Message)> ValidateScanAccessAsync(
            string username,
            string eventCode,
            string? ipAddress = null,
            string? deviceInfo = null,
            string? location = null,
            double? latitude = null,
            double? longitude = null
        )
        {
            try
            {
                var payload = new
                {
                    username,
                    event_code = eventCode,
                    ip_address = ipAddress,
                    device_info = deviceInfo,
                    location,
                    latitude,
                    longitude
                };

                using var request = new HttpRequestMessage(
                    HttpMethod.Post,
                    "api/attendance/validate-scan-access/"
                );

                request.Headers.Add("X-Internal-Token", _internalToken);
                request.Content = JsonContent.Create(payload);

                var response = await _httpClient.SendAsync(request);

                JsonElement json = default;
                try
                {
                    json = await response.Content.ReadFromJsonAsync<JsonElement>();
                }
                catch
                {
                }

                string message = "Validation failed";

                if (json.ValueKind == JsonValueKind.Object)
                {
                    if (json.TryGetProperty("message", out var msg))
                        message = msg.GetString() ?? message;
                    else if (json.TryGetProperty("error", out var err))
                        message = err.GetString() ?? message;
                    else if (json.TryGetProperty("detail", out var detail))
                        message = detail.GetString() ?? message;
                }

                if (!response.IsSuccessStatusCode)
                    return (false, message);

                bool allowed = false;
                if (json.ValueKind == JsonValueKind.Object &&
                    json.TryGetProperty("allowed", out var allowedProp))
                {
                    allowed = allowedProp.GetBoolean();
                }

                return (allowed, message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Django validate-scan-access for username {Username}", username);
                return (false, "Validation service unavailable");
            }
        }
    }
}
