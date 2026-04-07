from rest_framework.decorators import api_view,permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from events.models import Event
from users.models import User
from .models import Attendance
from .serializers import AttendanceSerializer,AttendanceCheckInSerializer
import math
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi

# Create your views here.

def calculate_distance(lat1,lon1,lat2,lon2):
    R = 6371000  # meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2 +
        math.cos(phi1) * math.cos(phi2) *
        math.sin(delta_lambda / 2) ** 2
    )

    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))
   
def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0]
    return request.META.get('REMOTE_ADDR')

@swagger_auto_schema(
    method='post',
    tags=["📍 ATTENDANCE"],
    operation_summary="Check In",
    operation_description="**User checks into an event using event code + location**",
    request_body=AttendanceCheckInSerializer
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_in(request):
    serializer = AttendanceCheckInSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    data = serializer.validated_data
    event_code = data["event_code"]
    userlat = serializer.validated_data.get("latitude")
    userlon = serializer.validated_data.get("longitude")
    try:
        event = Event.objects.get(event_code=event_code, is_active=True)
    except Event.DoesNotExist:
        return Response({"error":"Invalid event code"}, status=status.HTTP_404_NOT_FOUND)
    
    if not event.attendees.filter(id=request.user.id).exists():
        return Response({"error":"Not assigned to event"}, status=status.HTTP_403_FORBIDDEN)
    
    if Attendance.objects.filter(user=request.user, event=event).exists():
        return Response({"error":"Already marked attendance"}, status=status.HTTP_400_BAD_REQUEST)
    
    if timezone.now().date() != event.date:
        return Response({"error":"Wrong event day"}, status=status.HTTP_400_BAD_REQUEST)
    
    now = timezone.localtime().time()
    if not(event.start_time <= now and now <= event.end_time):
        return Response({"error":"Not within attendance time"}, status=status.HTTP_400_BAD_REQUEST)
    

    print("NOW:", now)
    print("START:", event.start_time)
    print("END:", event.end_time)

    if event.latitude is not None and event.longitude is not None:
        if userlat is None or userlon is None:
            return Response(
                {"error": "Location is required for this event"},
                status=status.HTTP_400_BAD_REQUEST
            )
        distance = calculate_distance(
            userlat, userlon,
            event.latitude, event.longitude
        )
        ALLOWED_RADIUS = 100
        if distance > ALLOWED_RADIUS:
            return Response({"error": f"You are too far from the event location ({round(distance)}m away)"}, status=status.HTTP_403_FORBIDDEN)

    ip = get_client_ip(request)
    device_info = request.META.get("HTTP_USER_AGENT", "")

    if Attendance.objects.filter(
        event=event,
        ip_address=ip,
        device_info=device_info
    ).exists():
        return Response(
        {"error": "This device already checked in for this event"},
        status=status.HTTP_403_FORBIDDEN
    )

    attendance = Attendance.objects.create(
        user=request.user,
        event=event,
        ip_address=ip,
        device_info = device_info,
        latitude=userlat,
        longitude=userlon
    )

    return Response({"message":"Attendace recorded", "event":event.title,"ip":ip,"device":device_info}, status=status.HTTP_201_CREATED)

@swagger_auto_schema(
    method='get',
    tags=["📍 ATTENDANCE"],
    operation_summary="My Attendance",
    operation_description="**View user's attendance records**"
)  
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_attendance(request):
    records = Attendance.objects.filter(user=request.user)
    serializer = AttendanceSerializer(records, many=True)
    return Response(serializer.data)


@swagger_auto_schema(
    method='get',
    tags=["📊 DASHBOARD"],
    operation_summary="Admin Dashboard",
    operation_description="**System statistics overview**"
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if request.user.role != "admin":
        return Response ({"error":"Not allowed"}, status=status.HTTP_403_FORBIDDEN)
    total_events = Event.objects.filter(created_by=request.user, is_active = True).count()
    total_users = User.objects.count()
    total_attendance = Attendance.objects.count()

    today = timezone.now().date()
    today_attendance = Attendance.objects.filter(scan_time__date=today).count()
    return Response({
        "total_events":total_events,
        "total_users":total_users,
        "total_attendance":total_attendance,
        "today_attendance": today_attendance
    })

@swagger_auto_schema(
    method='get',
    tags=["📊 DASHBOARD"],
    operation_summary="Event Dashboard",
    operation_description="**Analytics for a specific event**",
    manual_parameters=[
        openapi.Parameter('event_id', openapi.IN_PATH, type=openapi.TYPE_INTEGER)
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def event_dashboard(request,event_id):
    if request.user.role != 'admin':
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error":"Event not found"}, status=status.HTTP_404_NOT_FOUND)
    
    total_invited = event.attendees.count()
    total_checked_in = Attendance.objects.filter(event=event).count()
    attendance_rate = 0
    if total_invited > 0 :
        attendance_rate = (total_checked_in / total_invited) * 100
    records = Attendance.objects.filter(event=event)
    attendees =[]

    for record in records:
        fullname = f"{record.user.first_name} {record.user.last_name}".strip()
        attendees.append({
            "username":record.user.username,
            "fullname":fullname if fullname else record.user.username,
            "scan_time":record.scan_time,
            "ip":record.ip_address,
        })
    return Response({
        "event":event.title,
        "invited":total_invited,
        "checked_in":total_checked_in,
        "attendance_rate": round(attendance_rate, 2),
        "attendees":attendees
    })

@swagger_auto_schema(
    method='get',
    tags=["📍 COUNT"],
    operation_summary="LIVE COUNT",
    operation_description="**View LIVE COUNT**",
    manual_parameters=[
        openapi.Parameter('event_id', openapi.IN_PATH, type=openapi.TYPE_INTEGER)
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def live_attendance(request,event_id):
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return Response({"error":"Event not found"}, status=status.HTTP_404_NOT_FOUND)
    
    count = Attendance.objects.filter(event=event).count()

    return Response({
        "event":event.title,
        "live_count":count
    })