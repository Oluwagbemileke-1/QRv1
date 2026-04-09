namespace QRSystem.API.Core.Models
{
    public class GenericResponse<T> where T : class
    {
        public bool isSuccessful { get; set; }
        public string ResponseMessage { get; set; } = string.Empty;
        public string ResponseCode { get; set; } = string.Empty;
        public T? Data { get; set; }

        public static GenericResponse<T> Success(T data, string message = "Request successful", string code = "00")
        {
            return new GenericResponse<T>
            {
                isSuccessful = true,
                ResponseMessage = message,
                ResponseCode = code,
                Data = data
            };
        }

        public static GenericResponse<T> Failure(string message = "Request failed", string code = "99")
        {
            return new GenericResponse<T>
            {
                isSuccessful = false,
                ResponseMessage = message,
                ResponseCode = code,
                Data = null
            };
        }

    }
}
