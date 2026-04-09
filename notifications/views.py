from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import EmailLog
from .tasks import resend_failed_email
from drf_yasg.utils import swagger_auto_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import permission_classes

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

        resend_failed_email.delay(log.id)

        return Response({"message": "Resend triggered"})

    except EmailLog.DoesNotExist:
        return Response({"error": "Log not found"}, status=404)