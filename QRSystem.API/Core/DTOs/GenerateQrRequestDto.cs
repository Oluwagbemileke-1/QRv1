namespace QRSystem.API.Core.DTOs
{
    public class GenerateQrRequestDto
    {
        public Guid EventId { get; set; }
        public string EventCode { get; set; } = string.Empty;
    }
}
