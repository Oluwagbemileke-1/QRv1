using Microsoft.AspNetCore.Mvc;
using QRSystem.API.Core.Constants;
using QRSystem.API.Core.DTOs;
using QRSystem.API.Core.Models;
using QRSystem.API.Services.Interfaces;

namespace QRSystem.API.Controllers
{
    [ApiController]
    [Route("api/scan")]
    public class ScanController : ControllerBase
    {
        private readonly IScanService _scanService;
        private readonly ILogger<ScanController> _logger;

        public ScanController(IScanService scanService, ILogger<ScanController> logger)
        {
            _scanService = scanService;
            _logger = logger;
        }

        [HttpPost]
        public async Task<IActionResult> Scan([FromBody] ScanRequestDto request)
        {
            if (request == null)
            {
                _logger.LogWarning("Scan request body is null");
                return BadRequest(GenericResponse<object>.Failure("Invalid request", "400"));
            }

            try
            {
                var ipAddress = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()
                         ?? HttpContext.Connection.RemoteIpAddress?.ToString();

                _logger.LogInformation(
                    "Processing scan from IP: {IpAddress}, Username: {Username}, Lat: {Latitude}, Lng: {Longitude}",
                    ipAddress, request.Username, request.Latitude, request.Longitude
                );

                var result = await _scanService.ProcessScanAsync(
                    payload: request.Payload,
                    ipAddress: ipAddress,
                    username: request.Username,
                    eventCode: request.EventCode,
                    location: request.Location,
                    latitude: request.Latitude,
                    longitude: request.Longitude
                );

                if (result.Result == ScanResults.Success)
                {
                    _logger.LogInformation("Scan successful for Username: {Username}", request.Username);
                    return Ok(GenericResponse<object>.Success(result, result.Message));
                }

                if (result.Result == ScanResults.Fraud)
                {
                    _logger.LogWarning("Fraudulent scan detected for Username: {Username}, IP: {IpAddress}", request.Username, ipAddress);
                    return StatusCode(403, GenericResponse<object>.Failure(result.Message, "403"));
                }

                if (result.Result == ScanResults.ServiceUnavailable)
                {
                    _logger.LogWarning(
                        "Scan validation service unavailable for Username: {Username}, IP: {IpAddress}",
                        request.Username,
                        ipAddress
                    );
                    return StatusCode(503, GenericResponse<object>.Failure(result.Message, "503"));
                }

                _logger.LogWarning("Scan failed for Username: {Username}", request.Username);
                return BadRequest(GenericResponse<object>.Failure(result.Message, "400"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error processing scan for Username: {Username}", request.Username);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while processing the scan", "500"));
            }
        }

        [HttpGet("event/{eventId}")]
        public async Task<IActionResult> GetSessionScans(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching all scans for EventId: {EventId}", eventId);
                var scans = await _scanService.GetSessionScansAsync(eventId);
                _logger.LogInformation("Retrieved {Count} scans for EventId: {EventId}", scans.Count(), eventId);
                return Ok(GenericResponse<object>.Success(scans, "Scans retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching scans for EventId: {EventId}", eventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching the scans", "500"));
            }
        }

        [HttpGet("event/{eventId}/successful")]
        public async Task<IActionResult> GetSuccessfulScans(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching successful scans for EventId: {EventId}", eventId);
                var scans = await _scanService.GetSuccessfulScansAsync(eventId);
                _logger.LogInformation("Retrieved {Count} successful scans for EventId: {EventId}", scans.Count(), eventId);
                return Ok(GenericResponse<object>.Success(scans, "Successful scans retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching successful scans for EventId: {EventId}", eventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching successful scans", "500"));
            }
        }

        [HttpGet("user/{username}/successful")]
        public async Task<IActionResult> GetSuccessfulScansForUser(string username)
        {
            try
            {
                _logger.LogInformation("Fetching successful scans for Username: {Username}", username);
                var scans = await _scanService.GetSuccessfulScansForUserAsync(username);
                _logger.LogInformation("Retrieved {Count} successful scans for Username: {Username}", scans.Count(), username);
                return Ok(GenericResponse<object>.Success(scans, "Successful scans retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching successful scans for Username: {Username}", username);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching successful scans", "500"));
            }
        }

        [HttpGet("event/{eventId}/count")]
        public async Task<IActionResult> GetAttendanceCount(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching attendance count for EventId: {EventId}", eventId);
                var scans = await _scanService.GetSuccessfulScansAsync(eventId);
                var count = scans.Count();
                _logger.LogInformation("Attendance count for EventId: {EventId} is {Count}", eventId, count);
                return Ok(GenericResponse<object>.Success(new { eventId, attendanceCount = count }, "Attendance count retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching attendance count for EventId: {EventId}", eventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching the attendance count", "500"));
            }
        }

        [HttpGet("event/{eventId}/stats")]
        public async Task<IActionResult> GetSessionStats(Guid eventId)
        {
            try
            {
                _logger.LogInformation("Fetching event stats for EventId: {EventId}", eventId);
                var stats = await _scanService.GetSessionStatsAsync(eventId);
                _logger.LogInformation("Successfully retrieved stats for EventId: {EventId}", eventId);
                return Ok(GenericResponse<object>.Success(stats, "Event stats retrieved successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching event stats for EventId: {EventId}", eventId);
                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching event stats", "500"));
            }
        }
    }
}






































//using Microsoft.AspNetCore.Mvc;
//using QRSystem.API.Core.DTOs;
//using QRSystem.API.Core.Models;
//using QRSystem.API.Services.Interfaces;

//namespace QRSystem.API.Controllers
//{
//    [ApiController]
//    [Route("api/scan")]
//    public class ScanController : ControllerBase
//    {
//        private readonly IScanService _scanService;
//        private readonly ILogger<ScanController> _logger;

//        public ScanController(IScanService scanService, ILogger<ScanController> logger)
//        {
//            _scanService = scanService;
//            _logger = logger;
//        }

//        // POST api/scan
//        // called when a user scans the QR code
//        [HttpPost]
//        public async Task<IActionResult> Scan([FromBody] ScanRequestDto request)
//        {
//            if (request == null)
//            {
//                _logger.LogWarning("Scan request body is null");
//                return BadRequest(GenericResponse<object>.Failure("Invalid request", "400"));
//            }

//            try
//            {
//                // Correct way — checks forwarded header first, falls back to direct connection
//                var ipAddress = HttpContext.Request.Headers["X-Forwarded-For"].FirstOrDefault()
//                         ?? HttpContext.Connection.RemoteIpAddress?.ToString();
//                _logger.LogInformation("Processing scan from IP: {IpAddress}, Username: {Username}", ipAddress, request.Username);

//                var result = await _scanService.ProcessScanAsync(
//                    payload: request.Payload,
//                    ipAddress: ipAddress,
//                    username: request.Username,
//                    eventCode: request.EventCode,
//                    location: request.Location
//                );



//                if(result.Result == Core.Constants.ScanResults.Success)
//{
//                    _logger.LogInformation("Scan successful for Username: {Username}", request.Username);
//                    return Ok(GenericResponse<object>.Success(result, result.Message));
//                }

//                if (result.Result == Core.Constants.ScanResults.Fraud)
//                {
//                    _logger.LogWarning("Fraudulent scan detected for Username: {Username}, IP: {IpAddress}", request.Username, ipAddress);
//                    return StatusCode(403, GenericResponse<object>.Failure(result.Message, "403"));
//                }

//                _logger.LogWarning("Scan failed for Username: {Username}", request.Username);
//                return BadRequest(GenericResponse<object>.Failure(result.Message, "400"));
//            }
//            catch (Exception ex)
//            {
//                _logger.LogError(ex, "Unexpected error processing scan for Username: {Username}", request.Username);
//                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while processing the scan", "500"));
//            }
//        }

//        // GET api/scan/event/{eventId}
//        // get all scans for an event
//        [HttpGet("event/{eventId}")]
//        public async Task<IActionResult> GetSessionScans(Guid eventId)
//        {
//            try
//            {
//                _logger.LogInformation("Fetching all scans for EventId: {EventId}", eventId);
//                var scans = await _scanService.GetSessionScansAsync(eventId);
//                _logger.LogInformation("Retrieved {Count} scans for EventId: {EventId}", scans.Count(), eventId);
//                return Ok(GenericResponse<object>.Success(scans, "Scans retrieved successfully"));
//            }
//            catch (Exception ex)
//            {
//                _logger.LogError(ex, "Error fetching scans for EventId: {EventId}", eventId);
//                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching the scans", "500"));
//            }
//        }

//        // GET api/scan/event/{eventId}/successful
//        // get only successful scans - who actually attended
//        [HttpGet("event/{eventId}/successful")]
//        public async Task<IActionResult> GetSuccessfulScans(Guid eventId)
//        {
//            try
//            {
//                _logger.LogInformation("Fetching successful scans for EventId: {EventId}", eventId);
//                var scans = await _scanService.GetSuccessfulScansAsync(eventId);
//                _logger.LogInformation("Retrieved {Count} successful scans for EventId: {EventId}", scans.Count(), eventId);
//                return Ok(GenericResponse<object>.Success(scans, "Successful scans retrieved successfully"));
//            }
//            catch (Exception ex)
//            {
//                _logger.LogError(ex, "Error fetching successful scans for EventId: {EventId}", eventId);
//                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching successful scans", "500"));
//            }
//        }

//        // GET api/scan/event/{eventId}/count
//        // get attendance count for a eventId - for dashboard
//        [HttpGet("event/{eventId}/count")]
//        public async Task<IActionResult> GetAttendanceCount(Guid eventId)
//        {
//            try
//            {
//                _logger.LogInformation("Fetching attendance count for EventId: {EventId}", eventId);
//                var scans = await _scanService.GetSuccessfulScansAsync(eventId);
//                var count = scans.Count();
//                _logger.LogInformation("Attendance count for EventId: {EventId} is {Count}", eventId, count);
//                return Ok(GenericResponse<object>.Success(new { eventId, attendanceCount = count }, "Attendance count retrieved successfully"));
//            }
//            catch (Exception ex)
//            {
//                _logger.LogError(ex, "Error fetching attendance count for EventId: {EventId}", eventId);
//                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching the attendance count", "500"));
//            }
//        }

//        // GET api/scan/event/{eventId}/stats
//        // get analytics for a event
//        [HttpGet("event/{eventId}/stats")]
//        public async Task<IActionResult> GetSessionStats(Guid eventId)
//        {
//            try
//            {
//                _logger.LogInformation("Fetching event stats for EventId: {EventId}", eventId);
//                var stats = await _scanService.GetSessionStatsAsync(eventId);
//                _logger.LogInformation("Successfully retrieved stats for EventId: {EventId}", eventId);
//                return Ok(GenericResponse<object>.Success(stats, "Event stats retrieved successfully"));
//            }
//            catch (Exception ex)
//            {
//                _logger.LogError(ex, "Error fetching event stats for EventId: {EventId}", eventId);
//                return StatusCode(500, GenericResponse<object>.Failure("An error occurred while fetching event stats", "500"));
//            }
//        }
//    }
//}



