from rest_framework.throttling import AnonRateThrottle


class RegisterRateThrottle(AnonRateThrottle):
    scope = "register"


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class VerificationConfirmRateThrottle(AnonRateThrottle):
    scope = "verification_confirm"


class ResendVerificationRateThrottle(AnonRateThrottle):
    scope = "resend_verification"


class ForgotPasswordRateThrottle(AnonRateThrottle):
    scope = "forgot_password"


class VerifyOtpRateThrottle(AnonRateThrottle):
    scope = "verify_otp"


class ResetPasswordRateThrottle(AnonRateThrottle):
    scope = "reset_password"


class ResendOtpRateThrottle(AnonRateThrottle):
    scope = "resend_otp"
