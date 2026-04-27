from rest_framework import serializers
from .models import Event
from datetime import date

class EventSerializer(serializers.ModelSerializer):
    date = serializers.DateField(format="%d-%m-%Y")
    start_time = serializers.TimeField(format="%I:%M %p")
    end_time = serializers.TimeField(format="%I:%M %p")
    created_by = serializers.SerializerMethodField()
    deleted_by = serializers.SerializerMethodField()
    deleted_at = serializers.DateTimeField(read_only=True, allow_null=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = (
            "id",
            "title",
            "description",
            "date",
            "start_time",
            "end_time",
            "location_name",
            "latitude",
            "longitude",
            "event_code",
            "status",
            "created_by",
            "created_at",
            "deleted_at",
            "deleted_by",
        )
        read_only_fields = ['created_by', 'created_at', 'event_code']
        extra_kwargs = {
            "location_name": {"required": True, "allow_blank": False},
            "latitude": {"required": True},
            "longitude": {"required": True},
        }


    def get_created_by(self, obj):
        fullname = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return {
            "id": obj.created_by.id ,
            "username": obj.created_by.username,
            "fullname": fullname if fullname.strip() else obj.created_by.username
        }

    def get_deleted_by(self, obj):
        if not obj.deleted_by:
            return None

        fullname = f"{obj.deleted_by.first_name} {obj.deleted_by.last_name}".strip()
        return {
            "id": obj.deleted_by.id,
            "username": obj.deleted_by.username,
            "fullname": fullname if fullname.strip() else obj.deleted_by.username,
        }

    def get_status(self, obj):
        return obj.status.title()
    
    def validate(self,data):
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        date_value = data.get("date")

        if date_value:
            if date_value < date.today():
                raise serializers.ValidationError({"time": "Event date must be today or in the future"})
        if start_time and end_time:
            if start_time >= end_time:
                raise serializers.ValidationError({"time":"End time must be after start time"})

        location_name = data.get("location_name")
        if location_name is not None and not str(location_name).strip():
            raise serializers.ValidationError({"location_name": "Location name is required"})

        return data

class UpdateEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ("title", "description", "date", "start_time", "end_time", "location_name", "latitude", "longitude")
        extra_kwargs = {field: {"required": False} for field in fields}
    def validate(self, data):
        instance = self.instance

        if not data:
            raise serializers.ValidationError({"detail":"No input data provided."})
        
        
        new_date = data.get("date", instance.date)
        start_time = data.get("start_time", instance.start_time)
        end_time = data.get("end_time", instance.end_time)

        if instance.date < date.today():
                    raise serializers.ValidationError({"detail":"Cannot update past events"})
        
        if new_date and new_date < date.today():
            raise serializers.ValidationError("Event date must be in the future.")
        
     
        if start_time and end_time and start_time >= end_time:
            raise serializers.ValidationError(
                "End time must be after start time"
            )

        if "location_name" in data and not str(data.get("location_name", "")).strip():
            raise serializers.ValidationError({"location_name": "Location name is required"})

        has_lat = "latitude" in data
        has_lon = "longitude" in data
        if has_lat != has_lon:
            raise serializers.ValidationError({
                "location": "latitude and longitude must be updated together"
            })
        
        return data
        
class AllSerializer(EventSerializer):
     class Meta(EventSerializer.Meta):
          fields = EventSerializer.Meta.fields + ('is_active',)
