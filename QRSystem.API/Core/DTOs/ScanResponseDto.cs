namespace QRSystem.API.Core.DTOs
{
    public class ScanResponseDto
    {
        public string Result { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime ScannedAt { get; set; }
    }
}
