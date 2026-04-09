from django.urls import path
from .consumers import AttendanceConsumer

websocket_urlpatterns = [
    path("ws/attendance/<int:event_id>/", AttendanceConsumer.as_asgi()),
]