from rest_framework import serializers
from .models import Attendance


class AttendanceCheckInSerializer(serializers.Serializer):
        latitude = serializers.FloatField(required=False, allow_null=True)
        longitude = serializers.FloatField(required=False, allow_null=True)
        event_code = serializers.CharField()

class AttendanceSerializer(serializers.ModelSerializer):

    user = serializers.SerializerMethodField()
    event = serializers.SerializerMethodField()


    class Meta:
        model = Attendance
        fields = (
            "id",
            "user",
            "event",
            "qr_data",
            "scan_time",
            "ip_address",
            "device_info",
            "latitude",
            "longitude",
        )

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "username": obj.user.username,
            "fullname": f"{obj.user.first_name} {obj.user.last_name}".strip(),
            "email": obj.user.email
        }
    
    def get_event(self, obj):
        return {
            "id": obj.event.id,
            "title": obj.event.title,
            "date": obj.event.date,
            "location": obj.event.location_name
        }
    

