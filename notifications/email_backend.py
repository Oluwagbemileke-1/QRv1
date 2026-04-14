from django.core.mail.backends.smtp import EmailBackend as SMTPBackend
from django.utils import timezone
from notifications.models import EmailLog

class LoggingEmailBackend(SMTPBackend):

    def send_messages(self, email_messages):
        sent_count = 0

        for message in email_messages:
            log = EmailLog.objects.create(
                to_email=",".join(message.to),
                subject=message.subject,
                message=message.body,
                status="PENDING",
                last_attempt=timezone.now()
            )

            try:
                # actually send email
                result = super().send_messages([message])

                if result:
                    log.status = "SENT"
                    log.sent_at = timezone.now()
                    sent_count += 1
                else:
                    log.status = "FAILED"

            except Exception as e:
                log.status = "FAILED"
                log.error = str(e)

            log.save()

        return sent_count