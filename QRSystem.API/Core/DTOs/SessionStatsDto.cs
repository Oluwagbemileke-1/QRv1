namespace QRSystem.API.Core.DTOs
{
    public class SessionStatsDto
    {
        public Guid SessionId { get; set; }
        public int TotalScans { get; set; }
        public int SuccessfulScans { get; set; }
        public int FraudAttempts { get; set; }
        public int UniqueIps { get; set; }
    }
}
