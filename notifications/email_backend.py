from django.core.mail.backends.smtp import EmailBackend as SMTPBackend
from django.utils import timezone
from notifications.models import EmailLog
import threading

class LoggingEmailBackend(SMTPBackend):

    def _send_and_log(self, message):
        log = EmailLog.objects.create(
            to_email=",".join(message.to),
            subject=message.subject,
            message=message.body,
            status="PENDING",
            last_attempt=timezone.now()
        )

        try:
            sent = super().send_messages([message])

            log.status = "SENT" if sent else "FAILED"
            log.sent_at = timezone.now() if sent else None
            log.save()

        except Exception as e:
            log.status = "FAILED"
            log.error = str(e)
            log.save()

    def send_messages(self, email_messages):
        threads = []

        for message in email_messages:
            t = threading.Thread(
                target=self._send_and_log,
                args=(message,)
            )
            t.start()
            threads.append(t)

        # DO NOT block request waiting for SMTP
        return len(email_messages)