from rest_framework import serializers
from .models import Event
from datetime import date

class EventSerializer(serializers.ModelSerializer):
    date = serializers.DateField(format="%d-%m-%Y")
    start_time = serializers.TimeField(format="%I:%M %p")
    end_time = serializers.TimeField(format="%I:%M %p")
    created_by = serializers.SerializerMethodField()

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
            "event_code",
            "created_by",
            "created_at"
        )
        read_only_fields = ['created_by', 'created_at', 'event_code']


    def get_created_by(self, obj):
        fullname = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return {
            "id": obj.created_by.id ,
            "username": obj.created_by.username,
            "fullname": fullname if fullname.strip() else obj.created_by.username
        }
    
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
        return data

class UpdateEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ("title", "description", "date", "start_time", "end_time", "location_name")
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
        
        return data
        
class AllSerializer(EventSerializer):
     class Meta(EventSerializer.Meta):
          fields = EventSerializer.Meta.fields + ('is_active',)