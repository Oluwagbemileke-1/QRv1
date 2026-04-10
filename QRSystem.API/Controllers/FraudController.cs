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

        // GET api/fraud/event/{eventId}
        // get all fraud logs for an event
        [HttpGet("event/{eventId}")]
        public async Task<IActionResult> GetSessionFraudLogs(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching fraud logs for eventId: {eventId}", eventId);
                var logs = await _fraudService.GetSessionFraudLogsAsync(eventId);
                _logger.LogInformation("Retrieved {Count} fraud logs for EventId: {EventId}", logs.Count(), eventId);
                return Ok(GenericResponse<object>.Success(logs, "Fraud logs retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching fraud logs for EventId: {EventId}", eventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching fraud logs", "500"));
            }
        }

        // GET api/fraud/event/{eventId}/count
        // get total fraud count for an event - for dashboard
        [HttpGet("event/{eventId}/count")]
        public async Task<IActionResult> GetFraudCount(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching fraud count for EventId: {EventId}", eventId);
                var count = await _fraudService.GetFraudCountAsync(eventId);
                _logger.LogInformation("Fraud count for EventId: {EventId} is {Count}", eventId, count);
                return Ok(GenericResponse<object>.Success(new { eventId, fraudCount = count }, "Fraud count retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching fraud count for EventId: {EventId}", eventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching fraud count", "500"));
            }
        }
    }
}


