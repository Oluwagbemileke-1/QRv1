using Microsoft.AspNetCore.Mvc;
using QRSystem.API.Core.DTOs;
using QRSystem.API.Core.Models;
using QRSystem.API.Services.Interfaces;

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

        [HttpPost("generate")]
        public async Task<IActionResult> GenerateQr([FromBody] GenerateQrRequestDto request)
        {
            try
            {
                _logger.LogInformation("Generating QR code for EventId: {EventId}", request.EventId);

                var result = await _qrService.GenerateQrAsync(request.EventId, request.EventCode);

                _logger.LogInformation("QR code generated successfully for EventId: {EventId}", request.EventId);
                return Ok(GenericResponse<object>.Success(result, "QR code generated successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating QR code for EventId: {EventId}", request.EventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while generating the QR code", "500"));
            }
        }
    }
}
