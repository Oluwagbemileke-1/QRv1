from celery import shared_task
from django.core.mail import send_mail
from django.utils import timezone
from .models import EmailLog
import re

@shared_task(bind=True, max_retries=3)
def send_email_task(self, email, subject, message):
    
    if not email or not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
        print("BLOCKED INVALID EMAIL:", email)
        return
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
            from_email="noreply@qrattendance.com",
            recipient_list=[email],
            fail_silently=False
        )

        log.status = "SENT"
        log.sent_at = timezone.now()
        log.save()

    except Exception as e:
        print("EMAIL FAILED:", email, str(e))
        log.status = "FAILED"
        log.error = str(e)
        log.retry_count += 1
        log.last_attempt = timezone.now()
        log.save()

        raise self.retry(exc=e, countdown=60)
   
@shared_task
def resend_failed_email(log_id):
    from .models import EmailLog

    try:
        log = EmailLog.objects.get(id=log_id)

        send_mail(
            subject=log.subject,
            message=log.message,
            from_email="noreply@qrattendance.com",
            recipient_list=[log.to_email],
            fail_silently=False
        )

        log.status = "SENT"
        log.sent_at = timezone.now()
        log.error = None
        log.save()

    except Exception as e:
        log.status = "FAILED"
        log.error = str(e)
        log.save()