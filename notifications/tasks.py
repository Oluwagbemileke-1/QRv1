from django.core.mail import send_mail
from django.utils import timezone
from .models import EmailLog
import re

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
        send_mail(
            subject=subject,
            message=message,
            from_email="GM<gbemioduselu@gmail.com>",
            recipient_list=[email],
            fail_silently=False
        )

        log.status = "SENT"
        log.sent_at = timezone.now()
        log.save()

        return True

    except Exception as e:
        print("EMAIL FAILED:", email, str(e))

        log.status = "FAILED"
        log.error = str(e)
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