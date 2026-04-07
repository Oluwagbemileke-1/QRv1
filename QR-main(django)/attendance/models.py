from django.db import models
from django.conf import settings
from events.models import Event

User = settings.AUTH_USER_MODEL

# Create your models here.
class Attendance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    qr_data = models.TextField(null=True, blank=True)
    scan_time = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_info = models.TextField(null=True, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'event')
        ordering =['-scan_time']
    def __str__(self):
        return f"{self.user} - {self.event.title}"