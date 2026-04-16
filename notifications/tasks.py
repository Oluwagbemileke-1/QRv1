from django.core.mail import send_mail
from django.utils import timezone
from .models import EmailLog
import re
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException
import os


def send_email_task(email, subject, message):
    # import pdb; pdb.set_trace()
    if not email or not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
        print("BLOCKED INVALID EMAIL:", email)
        return False

    log = EmailLog.objects.create(
        to_email=email,
        subject=subject,
        message=message,
        status="PENDING",
        last_attempt=timezone.now()
    )

    try:
        # Brevo API integration
        brevo_api_key = os.getenv("BREVO_API_KEY")
        sender_email = os.getenv("BREVO_SENDER_EMAIL", "me@oluwaseunapata.com")
        sender_name = os.getenv("BREVO_SENDER_NAME", "QRAMS QR Attendance")

        if not brevo_api_key:
            raise ValueError("BREVO_API_KEY is missing")

        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key['api-key'] = brevo_api_key
        api_instance = sib_api_v3_sdk.TransactionalEmailsApi(sib_api_v3_sdk.ApiClient(configuration))

        send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(
            to=[{"email": email}],
            sender={"email": sender_email, "name": sender_name},
            subject=subject,
            text_content=message,
        )
        api_response = api_instance.send_transac_email(send_smtp_email)
        response_payload = getattr(api_response, "to_dict", lambda: {"raw": str(api_response)})()

        log.status = "SENT"
        log.sent_at = timezone.now()
        log.error = f"Brevo accepted request: {response_payload}"
        log.save()
        print(f"BREVO SEND OK -> to={email} sender={sender_email} response={response_payload}")
        return True

    except ApiException as e:
        print("Brevo API Exception:", e)
        log.status = "FAILED"
        log.error = f"Brevo API Exception: {e}"
        log.retry_count += 1
        log.last_attempt = timezone.now()
        log.save()
        return False

    except Exception as e:
        print("EMAIL FAILED:", email, str(e))

        log.status = "FAILED"
        log.error = f"EMAIL FAILED: {e}"
        log.retry_count += 1
        log.last_attempt = timezone.now()
        log.save()

        return False
    
def resend_failed_email(log_id):

    try:
        log = EmailLog.objects.get(id=log_id)

        success = send_email_task(
            log.to_email,
            log.subject,
            log.message
        )

        if success:
            log.status = "SENT"
            log.error = None
        else:
            log.status = "FAILED"

        log.save()

    except EmailLog.DoesNotExist:
        print("LOG NOT FOUND:", log_id)
