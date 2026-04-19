from rest_framework import serializers
from .models import Attendance


class AttendanceCheckInSerializer(serializers.Serializer):
    latitude = serializers.FloatField(required=False, allow_null=True)
    longitude = serializers.FloatField(required=False, allow_null=True)
    event_code = serializers.CharField()
    qr_payload = serializers.CharField(required=False, allow_blank=False)
    payload = serializers.CharField(required=False, allow_blank=False)

    def validate(self, attrs):
        qr_payload = attrs.get("qr_payload") or attrs.get("payload")
        if not qr_payload:
            raise serializers.ValidationError({
                "qr_payload": "This field is required."
            })
        attrs["qr_payload"] = qr_payload
        return attrs


class AttendanceSerializer(serializers.ModelSerializer):

    user = serializers.SerializerMethodField()
    event = serializers.SerializerMethodField()


    class Meta:
        model = Attendance
        fields = (
            "id",
            "user",
            "event",
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
    

