using Microsoft.AspNetCore.Mvc;
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

        // POST api/qr/generate/{sessionId}
        // admin calls this to generate a new QR for a session
        [HttpPost("generate/{sessionId}")]
        public async Task<IActionResult> GenerateQr(Guid sessionId)
        {
            try
            {
                _logger.LogInformation("Generating QR code for SessionId: {SessionId}", sessionId);
                var result = await _qrService.GenerateQrAsync(sessionId);
                _logger.LogInformation("QR code generated successfully for SessionId: {SessionId}", sessionId);
                return Ok(GenericResponse<object>.Success(result, "QR code generated successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating QR code for SessionId: {SessionId}", sessionId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while generating the QR code", "500"));
            }
        }
    }
}

