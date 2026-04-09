namespace QRSystem.API.Core.Constants
{
    public static class FraudReasons
    {
        public const string DuplicateIp = "DuplicateIp";
        public const string ExpiredQrCode = "ExpiredQrCode";
        public const string Tampered = "Tampered";
        public const string RapidRescan = "RapidRescan";
        public const string AlreadyAttended = "AlreadyAttended";
        public const string MultipleAccountsSameIp = "MultipleAccountsSameIp";
    }
}
