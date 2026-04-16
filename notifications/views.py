from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_yasg.utils import swagger_auto_schema

from .models import EmailLog
from .tasks import send_email_task


@swagger_auto_schema(
    method='post',
    tags=["Notifications"],
    operation_summary="Resend failed email",
    operation_description="Resends a failed email using its log ID"
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resend_email(request, log_id):

    try:
        log = EmailLog.objects.get(id=log_id)

        if log.status != "FAILED":
            return Response({"message": "Email is not failed"}, status=400)

        # 🔥 retry sending using Mailjet
        success = send_email_task(
            log.to_email,
            log.subject,
            log.message
        )

        if success:
            log.status = "SENT"
            log.sent_at = timezone.now()
            log.error = None
            log.save()
            return Response({"message": "Email resent successfully"})
        else:
            return Response({"message": "Failed to resend email"}, status=500)

    except EmailLog.DoesNotExist:
        return Response({"error": "Log not found"}, status=404)