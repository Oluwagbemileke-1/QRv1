from django.contrib import admin
from .models import EmailLog


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