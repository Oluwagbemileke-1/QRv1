from django.contrib import admin
from .models import Attendance

# Register your models here.


class AttendanceInline(admin.TabularInline):  # clean table style
    model = Attendance
    extra = 0
    readonly_fields = (
        "user",
        "scan_time",
        "ip_address",
        "device_info",
        "latitude",
        "longitude"
    )
    can_delete = False
admin.site.register(Attendance)