from django.contrib import admin
from .models import Event
from attendance.admin import AttendanceInline

class EventAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'title',
        'date',
        'start_time',
        'end_time',
        'is_active',
        'created_by'
    )


    readonly_fields = ("id", "created_by", "event_code", "created_at")
    inlines = [AttendanceInline]
    search_fields = (
        'title',
        'description',
        'location_name',
        'event_code'
    )

    ordering = ('-date',)

    filter_horizontal = ('attendees',)

    fieldsets = (
        ("Event Info", {
            'fields': ('title', 'description')
        }),
        ("Schedule", {
            'fields': ('date', 'start_time', 'end_time')
        }),
        ("Location", {
            'fields': ('location_name', 'latitude', 'longitude')
        }),
        ("Management", {
            'fields': ('created_by', 'attendees', 'event_code', 'is_active')
        })
    )
def save_model(self, request, obj, form, change):
    if not change:
        obj.created_by = request.user
    else:
        # prevent changing created_by even if tampered
        obj.created_by = Event.objects.get(pk=obj.pk).created_by

    super().save_model(request, obj, form, change)
admin.site.register(Event, EventAdmin)