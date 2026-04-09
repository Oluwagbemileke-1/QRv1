using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QRSystem.API.Services.Interfaces;

namespace QRSystem.API.BackgroundServices
{
    public class QrRotationService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<QrRotationService> _logger;

        private static readonly TimeSpan RotationInterval = TimeSpan.FromSeconds(30);

        public QrRotationService(
            IServiceScopeFactory scopeFactory,
            ILogger<QrRotationService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("QR Rotation Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                var startTime = DateTime.UtcNow;

                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var qrService = scope.ServiceProvider.GetRequiredService<IQrService>();

                    await qrService.RotateExpiredQrCodesAsync();

                    _logger.LogInformation(
                        "QR rotation completed at {time}",
                        startTime
                    );
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred during QR rotation cycle");
                }

                await Task.Delay(RotationInterval, stoppingToken);
            }

            _logger.LogInformation("QR Rotation Service stopped");
        }
    }
}
