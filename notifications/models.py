from django.db import models
from django.utils import timezone

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