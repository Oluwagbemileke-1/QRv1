from django.db import models
from django.utils import timezone
from django.conf import settings

# Create your models here.
class EmailLog(models.Model):
    CHOICES = [
        ("PENDING","Pending"),
        ("SENT","Sent"),
        ("FAILED","Failed"),
    ]

    to_email = models.EmailField()
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=10, choices=CHOICES,default="PENDING")
    error = models.TextField(null=True, blank=True)
    retry_count = models.IntegerField(default=0)   
    last_attempt = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(default=timezone.now)
    sent_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.to_email} - {self.subject}"


class AuditLog(models.Model):
    STATUS_CHOICES = [
        ("SUCCESS", "Success"),
        ("FAILED", "Failed"),
        ("INFO", "Info"),
    ]

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=100)
    target_type = models.CharField(max_length=50, blank=True)
    target_id = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="SUCCESS")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.action} - {self.status}"
