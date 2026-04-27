from django.contrib import admin
from .models import EmailLog, AuditLog


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = (
        "to_email",
        "subject",
        "status",
        "created_at",
        "sent_at",
    )

    list_filter = ("status", "created_at")

    search_fields = ("to_email", "subject")

    readonly_fields = (
        "to_email",
        "subject",
        "message",
        "status",
        "error",
        "created_at",
        "sent_at",
    )

    ordering = ("-created_at",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "status", "actor", "target_type", "target_id", "ip_address", "created_at")
    list_filter = ("status", "action", "target_type", "created_at")
    search_fields = ("action", "target_id", "actor__username", "ip_address")
    readonly_fields = ("actor", "action", "target_type", "target_id", "status", "ip_address", "user_agent", "details", "created_at")
    ordering = ("-created_at",)
