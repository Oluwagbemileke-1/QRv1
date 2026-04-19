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
        'event_status',
        'is_active',
        'created_by'
    )

    list_filter = ('is_active', 'date', 'created_by')
    readonly_fields = ("id", "created_by", "event_code", "created_at", "event_status_help")
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
            'fields': ('created_by', 'attendees', 'event_code', 'is_active', 'event_status_help')
        })
    )
    def event_status(self, obj):
        return obj.status.title()

    event_status.short_description = "Timeline Status"

    def event_status_help(self, obj):
        return "is_active means the event is not deleted. Timeline Status shows Upcoming, Active, Past, or Deleted."

    event_status_help.short_description = "Status Help"

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        else:
            # prevent changing created_by even if tampered
            obj.created_by = Event.objects.get(pk=obj.pk).created_by

        super().save_model(request, obj, form, change)

admin.site.register(Event, EventAdmin)
