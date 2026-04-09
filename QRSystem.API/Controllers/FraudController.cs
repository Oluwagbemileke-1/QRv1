using Microsoft.AspNetCore.Mvc;
using QRSystem.API.Core.Models;
using QRSystem.API.Services.Interfaces;

namespace QRSystem.API.Controllers
{
    [ApiController]
    [Route("api/fraud")]
    public class FraudController : ControllerBase
    {
        private readonly IFraudService _fraudService;
        private readonly ILogger<FraudController> _logger;

        public FraudController(IFraudService fraudService, ILogger<FraudController> logger)
        {
            _fraudService = fraudService;
            _logger = logger;
        }

        // GET api/fraud/session/{sessionId}
        // get all fraud logs for a session
        [HttpGet("session/{sessionId}")]
        public async Task<IActionResult> GetSessionFraudLogs(Guid sessionId)
        {
            try
            {
                _logger.LogInformation("Fetching fraud logs for SessionId: {SessionId}", sessionId);
                var logs = await _fraudService.GetSessionFraudLogsAsync(sessionId);
                _logger.LogInformation("Retrieved {Count} fraud logs for SessionId: {SessionId}", logs.Count(), sessionId);
                return Ok(GenericResponse<object>.Success(logs, "Fraud logs retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching fraud logs for SessionId: {SessionId}", sessionId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching fraud logs", "500"));
            }
        }

        // GET api/fraud/session/{sessionId}/count
        // get total fraud count for a session - for dashboard
        [HttpGet("session/{sessionId}/count")]
        public async Task<IActionResult> GetFraudCount(Guid sessionId)
        {
            try
            {
                _logger.LogInformation("Fetching fraud count for SessionId: {SessionId}", sessionId);
                var count = await _fraudService.GetFraudCountAsync(sessionId);
                _logger.LogInformation("Fraud count for SessionId: {SessionId} is {Count}", sessionId, count);
                return Ok(GenericResponse<object>.Success(new { sessionId, fraudCount = count }, "Fraud count retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching fraud count for SessionId: {SessionId}", sessionId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching fraud count", "500"));
            }
        }
    }
}


