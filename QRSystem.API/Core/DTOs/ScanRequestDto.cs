namespace QRSystem.API.Core.DTOs
{
    public class ScanRequestDto
    {
        public string Payload { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string EventCode { get; set; } = string.Empty;
        public string? Location { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }


    }
}
