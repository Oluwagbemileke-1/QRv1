using Microsoft.AspNetCore.Mvc;
using QRSystem.API.Core.Models;
using QRSystem.API.Services.Interfaces;
using System.Diagnostics.Tracing;

namespace QRSystem.API.Controllers
{
    [ApiController]
    [Route("api/qr")]
    public class QrController : ControllerBase
    {
        private readonly IQrService _qrService;
        private readonly ILogger<QrController> _logger;

        public QrController(IQrService qrService, ILogger<QrController> logger)
        {
            _qrService = qrService;
            _logger = logger;
        }

        // POST api/qr/generate/{eventId}
        // admin calls this to generate a new QR for an event
        [HttpPost("generate/{eventId}")]
        public async Task<IActionResult> GenerateQr(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Generating QR code for EventId: {EventId}", eventId);
                var result = await _qrService.GenerateQrAsync(eventId);
                _logger.LogInformation("QR code generated successfully for EventId: {EventId}", eventId);
                return Ok(GenericResponse<object>.Success(result, "QR code generated successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating QR code for EventId: {EventId}", eventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while generating the QR code", "500"));
            }
        }
    }
}

