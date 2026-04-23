from datetime import datetime
from django.db import models
from django.conf import settings
from django.utils import timezone
import random,string,uuid
# Create your models here.
User = settings.AUTH_USER_MODEL

def generate_event_code(length=6):
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))

class Event(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField()
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    location_name = models.CharField(max_length=255)
    latitude = models.FloatField()
    longitude = models.FloatField()

    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    attendees = models.ManyToManyField(User, related_name="events")
    event_code = models.CharField(max_length=6, unique=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
            if not self.event_code:
                while True:
                    code = generate_event_code()
                    if not Event.objects.filter(event_code=code).exists():
                        self.event_code = code
                        break
            super().save(*args, **kwargs)

    @property
    def status(self):
        if not self.is_active:
            return "deleted"

        start_dt = timezone.make_aware(datetime.combine(self.date, self.start_time))
        end_dt = timezone.make_aware(datetime.combine(self.date, self.end_time))
        now = timezone.localtime()

        if now < start_dt:
            return "upcoming"
        if start_dt <= now <= end_dt:
            return "active"
        return "past"

    def __str__(self):
        return f"{self.title}  {(self.created_by)}"
    
    class Meta:
        indexes = [
            models.Index(fields=['date']),
        ]
