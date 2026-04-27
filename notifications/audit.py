from notifications.models import AuditLog


def log_audit(action, request=None, user=None, target_type="", target_id="", status="SUCCESS", details=None):
    try:
        actor = user
        if actor is None and request is not None and getattr(request, "user", None) and request.user.is_authenticated:
            actor = request.user

        ip_address = None
        user_agent = None
        if request is not None:
            forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if forwarded_for:
                ip_address = forwarded_for.split(",")[0].strip()
            else:
                ip_address = request.META.get("REMOTE_ADDR")
            user_agent = request.META.get("HTTP_USER_AGENT", "")

        AuditLog.objects.create(
            actor=actor,
            action=action,
            target_type=target_type,
            target_id=str(target_id or ""),
            status=status,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details or {},
        )
    except Exception as exc:
        print(f"AUDIT LOG ERROR ({action}): {exc}")
