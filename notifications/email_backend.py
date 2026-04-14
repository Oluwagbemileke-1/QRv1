from django.core.mail.backends.smtp import EmailBackend
from django.utils import timezone
from .models import EmailLog


class LoggingEmailBackend(EmailBackend):

    def send_messages(self, email_messages):
        results = []

        for message in email_messages:
            to_email = message.to[0] if message.to else None

            log = EmailLog.objects.create(
                to_email=to_email,
                subject=message.subject,
                message=message.body,
                status="PENDING",
                last_attempt=timezone.now()
            )

            try:
                sent = super().send_messages([message])

                if sent:
                    log.status = "SENT"
                    log.sent_at = timezone.now()
                else:
                    log.status = "FAILED"

                log.save()
                results.append(sent)

            except Exception as e:
                log.status = "FAILED"
                log.error = str(e)
                log.save()

                results.append(False)

        return sum(results)