from rest_framework.decorators import api_view,permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.conf import settings
from events.models import Event
from users.models import User
from .models import Attendance
from .serializers import AttendanceSerializer,AttendanceCheckInSerializer, ValidateScanAccessSerializer
import math,csv
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.http import HttpResponse
from .utils import this_week_range,parse_datetime
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib.pagesizes import landscape, A4,A3
from datetime import timedelta
from rest_framework.pagination import PageNumberPagination
from .utils import validate_qr_code
from notifications.audit import log_audit

HARD_CODED_ALLOWED_RADIUS_M = 150


@swagger_auto_schema(
    method='post',
    tags=["ATTENDANCE"],
    operation_summary="Validate Scan Access",
    operation_description="Internal endpoint for .NET to confirm event code and invited-user access",
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=["username", "event_code"],
        properties={
            "username": openapi.Schema(type=openapi.TYPE_STRING),
            "event_code": openapi.Schema(type=openapi.TYPE_STRING),
        },
    ),
)
@api_view(['POST'])
@permission_classes([AllowAny])
def validate_scan_access(request):
    internal_token = request.headers.get("X-Internal-Token")
    if internal_token != settings.INTERNAL_SERVICE_TOKEN:
        return Response(
            {"allowed": False, "message": "Unauthorized internal request"},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = ValidateScanAccessSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {"allowed": False, "message": "Invalid request payload"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    payload = serializer.validated_data
    username = payload.get("username")
    event_code = payload.get("event_code")
    userlat = payload.get("latitude")
    userlon = payload.get("longitude")
    ip_address = payload.get("ip_address")
    device_info = payload.get("device_info")

    try:
        user = User.objects.get(username=username, is_active=True, is_verified=True)
    except User.DoesNotExist:
        return Response(
            {"allowed": False, "message": "User not found or not eligible"},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        event = Event.objects.get(event_code__iexact=event_code, is_active=True)
    except Event.DoesNotExist:
        return Response(
            {"allowed": False, "message": "Invalid event code"},
            status=status.HTTP_404_NOT_FOUND,
        )

    access = get_scan_access_result(user, event, userlat, userlon, ip_address, device_info)
    return Response(
        {
            "allowed": access["allowed"],
            "message": access["message"],
        },
        status=access["status"],
    )



# Create your views here.


def is_event_admin(user):
    return bool(user and user.is_authenticated and (user.role == "admin" or user.is_superuser))


def can_manage_event(user, event):
    return bool(user and user.is_authenticated and (user.is_superuser or event.created_by_id == user.id))

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

def calc_col_widths(data, total_width):
    cols = len(data[0])
    max_lengths = [0] * cols

    # find longest value in each column
    for row in data:
        for i, cell in enumerate(row):
            max_lengths[i] = max(max_lengths[i], len(str(cell)))

    total = sum(max_lengths)

    # fallback if empty data
    if total == 0:
        return [total_width / cols] * cols

    # proportional widths
    return [
        (length / total) * total_width
        for length in max_lengths
    ]


def can_view_event_attendance(user, event):
    if can_manage_event(user, event):
        return True
    return event.attendees.filter(id=user.id).exists()


def get_scan_access_result(user, event, userlat=None, userlon=None, ip_address=None, device_info=None):
    if userlat is None or userlon is None:
        return {"allowed": False, "message": "Location is required for check-in", "status": status.HTTP_400_BAD_REQUEST}

    try:
        userlat = float(userlat)
        userlon = float(userlon)
    except (TypeError, ValueError):
        return {"allowed": False, "message": "Invalid location coordinates", "status": status.HTTP_400_BAD_REQUEST}

    if event.latitude is None or event.longitude is None:
        return {"allowed": False, "message": "Event location is not configured", "status": status.HTTP_400_BAD_REQUEST}

    if not event.attendees.filter(id=user.id).exists():
        return {"allowed": False, "message": "User was not invited to this event", "status": status.HTTP_403_FORBIDDEN}

    if Attendance.objects.filter(user=user, event=event).exists():
        return {"allowed": False, "message": "Attendance already recorded", "status": status.HTTP_400_BAD_REQUEST}

    if timezone.now().date() != event.date:
        return {"allowed": False, "message": "Wrong event day", "status": status.HTTP_400_BAD_REQUEST}

    now = timezone.localtime().time()
    if not (event.start_time <= now <= event.end_time):
        return {"allowed": False, "message": "Not within attendance time", "status": status.HTTP_400_BAD_REQUEST}

    distance = calculate_distance(userlat, userlon, event.latitude, event.longitude)
    if distance > HARD_CODED_ALLOWED_RADIUS_M:
        return {
            "allowed": False,
            "message": f"You are too far from the event location ({round(distance)}m away)",
            "status": status.HTTP_403_FORBIDDEN,
        }

    return {"allowed": True, "message": "Scan allowed", "status": status.HTTP_200_OK}


@swagger_auto_schema(
    method='post',
    tags=["📍 ATTENDANCE"],
    operation_summary="Check In",
    operation_description="**User checks into an event using event code, payload, and optional location**",
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
    payload = data["payload"]
    location = (data.get("location") or "").strip()
    userlat = data.get("latitude")
    userlon = data.get("longitude")
    try:
        event = Event.objects.get(event_code=event_code, is_active=True)
    except Event.DoesNotExist:
        return Response({"error":"Invalid event code"}, status=status.HTTP_404_NOT_FOUND)
    
    ip = get_client_ip(request)
    device_info = request.META.get("HTTP_USER_AGENT", "")

    access = get_scan_access_result(request.user, event, userlat, userlon, ip, device_info)
    if not access["allowed"]:
        return Response({"error": access["message"]}, status=access["status"])

    # Validate QR with .NET API
    validation = validate_qr_code(
        payload,
        request.user.username,
        event_code,
        ip_address=ip,
        location=location or event.location_name,
        latitude=userlat,
        longitude=userlon,
    )
    if not validation['valid']:
        if validation['fraud_detected']:
            return Response({"error": validation['message']}, status=status.HTTP_403_FORBIDDEN)
        return Response({"error": validation['message']}, status=status.HTTP_400_BAD_REQUEST)

    attendance = Attendance.objects.create(
        user=request.user,
        event=event,
        ip_address=ip,
        device_info = device_info,
        location=location or event.location_name,
        latitude=userlat,
        longitude=userlon
    )
    log_audit(
        "ATTENDANCE_RECORDED",
        request=request,
        user=request.user,
        target_type="attendance",
        target_id=attendance.id,
        details={"event_id": str(event.id), "event_code": event.event_code},
    )

    return Response(
        {
            "message": "Attendance recorded",
            "event": event.title,
            "ip": ip,
            "device": device_info,
            "location": attendance.location,
        },
        status=status.HTTP_201_CREATED,
    )

@swagger_auto_schema(
    method='get',
    tags=["📍 ATTENDANCE"],
    operation_summary="My Attendance (Filtered)",
    operation_description="View attendance with optional filters (event_id, this_week)",
    manual_parameters=[
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="Event UUID",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        ),

        openapi.Parameter(
            'this_week',
            openapi.IN_QUERY,
            description="Set to true to filter this week's attendance",
            type=openapi.TYPE_BOOLEAN
        ),
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_attendance(request):
    attendance_records = Attendance.objects.filter(user=request.user).select_related("user", "event", "event__created_by").order_by("-scan_time")
    assigned_events = Event.objects.filter(attendees=request.user, is_active=True).select_related("created_by").order_by("-date", "-start_time")

    event_id = request.GET.get("event_id")
    if event_id:
        attendance_records = attendance_records.filter(event_id=event_id)
        assigned_events = assigned_events.filter(id=event_id)

    if request.GET.get("this_week") == "true":
        today = timezone.now().date()
        start_week = today - timedelta(days=7)
        attendance_records = attendance_records.filter(scan_time__date__gte=start_week)
        assigned_events = assigned_events.filter(date__gte=start_week)

    attendance_by_event_id = {record.event_id: record for record in attendance_records}

    rows = []
    for event in assigned_events:
        attendance = attendance_by_event_id.get(event.id)
        # Show attended events immediately; show un-attended events once they are in the past.
        if not attendance and event.status != "past":
            continue

        if attendance:
            serialized = AttendanceSerializer(attendance).data
            serialized["status"] = "present"
            rows.append(serialized)
            continue

        rows.append(
            {
                "id": f"missed-{event.id}",
                "user": {
                    "id": request.user.id,
                    "username": request.user.username,
                    "fullname": f"{request.user.first_name} {request.user.last_name}".strip(),
                    "email": request.user.email,
                },
                "event": {
                    "id": event.id,
                    "title": event.title,
                    "event_code": event.event_code,
                    "date": event.date,
                    "location": event.location_name,
                },
                "event_title": event.title,
                "event_code": event.event_code,
                "scan_time": None,
                "ip_address": None,
                "device_info": None,
                "location": event.location_name,
                "latitude": event.latitude,
                "longitude": event.longitude,
                "status": "missed",
            }
        )

    paginator = PageNumberPagination()
    page = paginator.paginate_queryset(rows, request)

    total_attended = sum(1 for row in rows if row["status"] == "present")
    total_missed = sum(1 for row in rows if row["status"] == "missed")

    event_counts = {}
    for row in rows:
        event_key = str(row["event"]["id"])
        event_counts[event_key] = event_counts.get(event_key, 0) + 1

    return Response(
        {
            "count": paginator.page.paginator.count,
            "next": paginator.get_next_link(),
            "previous": paginator.get_previous_link(),
            "total_events": len(rows),
            "total_attended": total_attended,
            "total_missed": total_missed,
            "per_event_count": event_counts,
            "records": page,
            "results": page,
        },
        status=status.HTTP_200_OK,
    )

@swagger_auto_schema(
    method='get',
    tags=["📍 ATTENDANCE"],
    operation_summary="Check My Attendance for Event",
    operation_description="Check if user attended a specific event",
    manual_parameters=[
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="Event UUID",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        )
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_event_attendance(request, event_id):

    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)

    # 🔥 ensure user is assigned
    if not event.attendees.filter(id=request.user.id).exists():
        return Response({"error": "Not assigned to this event"}, status=403)

    record = Attendance.objects.filter(
        user=request.user,
        event=event
    ).first()

    return Response({
        "event": event.title,
        "attended": bool(record),
        "scan_time": record.scan_time.strftime("%Y-%m-%d %H:%M") if record else None,
        "location": event.location_name,
        "created_by": event.created_by.username
    })


@swagger_auto_schema(
    method='get',
    tags=["📊 DASHBOARD"],
    operation_summary="Admin Dashboard",
    operation_description="**System statistics overview for an event admin or superuser**"
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    if not is_event_admin(request.user):
        return Response ({"error":"Not allowed"}, status=status.HTTP_403_FORBIDDEN)
    admin_events = Event.objects.filter(is_active=True) if request.user.is_superuser else Event.objects.filter(created_by=request.user, is_active=True)
    total_events = admin_events.count()
    total_users = User.objects.count()
    total_attendance = Attendance.objects.filter(event__in=admin_events).count()

    today = timezone.now().date()
    today_attendance = Attendance.objects.filter(
        event__in=admin_events,
        scan_time__date=today,
    ).count()
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
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="Event UUID",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        )
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def event_dashboard(request,event_id):
    if not is_event_admin(request.user):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error":"Event not found"}, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_event(request.user, event):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)
    
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
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="Event UUID",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        )
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def live_attendance(request,event_id):
    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error":"Event not found"}, status=status.HTTP_404_NOT_FOUND)

    if not can_view_event_attendance(request.user, event):
        return Response({"error":"Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    today = timezone.localdate()
    now = timezone.localtime().time()
    is_live = event.date == today and event.start_time <= now <= event.end_time
    count = Attendance.objects.filter(event=event).count()
    currently_present = count if is_live else 0

    return Response({
        "event":event.title,
        "event_id": event.id,
        "live_count":count,
        "current_attendance":count,
        "currently_present": currently_present,
        "final_attendance": count,
        "is_live": is_live
    })

@swagger_auto_schema(
    method='get',
    tags=["📍 Full Attendance"],
    operation_summary="Full AttendanceT",
    operation_description="**View Full AttendanceT**",
    manual_parameters=[
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="Event UUID",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        )
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def event_attendance_admin(request, event_id):
    
    if not is_event_admin(request.user):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    try:
        event = Event.objects.select_related("created_by").get(id=event_id)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_event(request.user, event):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    records = Attendance.objects.filter(event=event).select_related("user","event")

    serializer = AttendanceSerializer(records, many=True)

    return Response({
        "event": event.title,
        "created_by": event.created_by.username,
        "count": records.count(),
        "records": serializer.data
    })

@swagger_auto_schema(
    method='get',
    tags=["📥 EXPORT"],
    operation_summary="Export Event Attendance (CSV)",
    operation_description="Download attendance for a specific event as CSV",
    manual_parameters=[
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="Event UUID",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        )
    ],
    responses={
    200: openapi.Response(
        description="CSV file",
        schema=openapi.Schema(type=openapi.TYPE_FILE)
    )
}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_event_csv(request,event_id):

    if not is_event_admin(request.user):
        return Response({"error":"Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    event = Event.objects.get(id=event_id)
    if not can_manage_event(request.user, event):
        return Response({"error":"Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{event.title}_attendance.csv"'

    writer = csv.writer(response)
    writer.writerow(["First Name", "Last Name", "Username", "Email", "Location", "Scan Date", "Scan Time", "IP", "Device"])

    records = Attendance.objects.filter(event=event).select_related("user")

    for r in records:
        writer.writerow([
            r.user.first_name,
            r.user.last_name,
            r.user.username,
            r.user.email,
            event.location_name,
            r.scan_time.date(),
            r.scan_time.time().strftime("%H:%M"),
            r.ip_address or "",
            r.device_info or ""
        ])

    return response

@swagger_auto_schema(
    method='get',
    tags=["📥 EXPORT"],
    operation_summary="Export Event Attendance (PDF)",
    operation_description="Download attendance for a specific event as PDF",
    manual_parameters=[
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="Event UUID",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        )
    ],
    responses={
    200: openapi.Response(
        description="PDF file",
        schema=openapi.Schema(type=openapi.TYPE_FILE)
    )
}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_event_pdf(request, event_id):

    if not is_event_admin(request.user):
        return Response({"error": "Not allowed"}, status=403)

    try:
        event = Event.objects.select_related("created_by").get(id=event_id)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=404)

    if not can_manage_event(request.user, event):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    records = Attendance.objects.filter(event=event).select_related("user", "event")

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{event.title}_attendance.pdf"'

    doc = SimpleDocTemplate(response,pagesize=landscape(A4))

    data = [[
        "First Name", "Last Name", "Username", "Email",
        "Location", "Scan Date", "Scan Time", "IP", "Device"
    ]]
    for r in records:
        data.append([
            r.user.first_name,
            r.user.last_name,
            r.user.username,
            r.user.email,
            event.location_name,
            r.scan_time.date(),
            r.scan_time.time().strftime("%H:%M"),
            r.ip_address or "",
            r.device_info or ""
        ])

    table = Table(data,  repeatRows=1)

    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, colors.black),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 7),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))


    doc.build([table])

    return response

@swagger_auto_schema(
    method='get',
    tags=["📥 EXPORT"],
    operation_summary="Export This Week Attendance (CSV)",
    operation_description="Download all attendance records for this week",
    responses={
    200: openapi.Response(
        description="CSV file",
        schema=openapi.Schema(type=openapi.TYPE_FILE)
    )
}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_this_week_csv(request):
    if not is_event_admin(request.user):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    start, end = this_week_range()

    records = Attendance.objects.filter(
        scan_time__gte=start,
        scan_time__lt=end
    ).select_related("user", "event")
    if not request.user.is_superuser:
        records = records.filter(event__created_by=request.user)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="this_week_attendance.csv"'

    writer = csv.writer(response)
    writer.writerow(["First Name", "Last Name", "Username", "Email","Event ", "Location", "Scan Date", "Scan Time", "IP", "Device"])

    for r in records:
        writer.writerow([
            r.user.first_name,
            r.user.last_name,
            r.user.username,
            r.user.email,
            r.event.title,
            r.event.location_name,
            r.scan_time.date(),
            r.scan_time.time().strftime("%H:%M"),
            r.ip_address or "",
            r.device_info or "",
        ])

    return response


@swagger_auto_schema(
    method='get',
    tags=["📥 EXPORT"],
    operation_summary="Export This Week Attendance (PDF)",
    operation_description="Download all attendance records for this week",
    responses={
    200: openapi.Response(
        description="PDF file",
        schema=openapi.Schema(type=openapi.TYPE_FILE)
    )
}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_this_week_pdf(request):
    if not is_event_admin(request.user):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    start, end = this_week_range()

    records = Attendance.objects.filter(
        scan_time__gte=start,
        scan_time__lt=end
    ).select_related("user", "event")
    if not request.user.is_superuser:
        records = records.filter(event__created_by=request.user)

    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="this_week_attendance.pdf"'

    doc = SimpleDocTemplate(
        response,
        pagesize=landscape(A3),
        leftMargin=10,
        rightMargin=10,
        topMargin=10,
        bottomMargin=10,
    )

    data = [[
        "First Name", "Last Name", "Username", "Email", "Event",
        "Location","Scan Date", "Scan Time", "IP", "Device"
    ]]

    # col_widths = [60, 60, 50, 100, 70, 120, 50, 50, 65, 250]
    # col_widths = [60, 60, 50, 100, 65, 95, 65, 50, 65, 250]
   
    for r in records:
        data.append([
            r.user.first_name,
            r.user.last_name,
            r.user.username,
            r.user.email,
            r.event.title,
            r.event.location_name,
            r.scan_time.date(),
            r.scan_time.time().strftime("%H:%M"),
            r.ip_address or "",
            r.device_info or ""
        ])
    page_width, _ = landscape(A3)
    usable_width = page_width - 20  # margins

    # AUTO-FIT WIDTHS
    col_widths = calc_col_widths(data, usable_width)

    table = Table(data, colWidths=col_widths, repeatRows=1)

    table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.grey),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, colors.black),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))

    doc.build([table])

    return response


@swagger_auto_schema(
    method='get',
    tags=["📥 EXPORT"],
    operation_summary="Export Attendance by Date Range (CSV)",
    operation_description="Download attendance records between start_date and end_date",
    manual_parameters=[
        openapi.Parameter(
            'start_date',
            openapi.IN_QUERY,
            description="Start date (YYYY-MM-DD)",
            type=openapi.TYPE_STRING,
            required=True
        ),
        openapi.Parameter(
            'end_date',
            openapi.IN_QUERY,
            description="End date (YYYY-MM-DD)",
            type=openapi.TYPE_STRING,
            required=True
        ),
    ],
    responses={
        200: openapi.Response(
            description="CSV file",
            schema=openapi.Schema(type=openapi.TYPE_FILE)
        )
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_custom_range_csv(request):

    if not is_event_admin(request.user):
        return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)

    start_raw = request.GET.get("start_date")
    end_raw = request.GET.get("end_date")

    if not start_raw or not end_raw:
        return Response(
            {"error": "start_date and end_date required (YYYY-MM-DD)"},
            status=status.HTTP_400_BAD_REQUEST
        )

    start, _= parse_datetime(start_raw)
    _, end = parse_datetime(end_raw)

    records = Attendance.objects.filter(
        scan_time__gte=start,
        scan_time__lt=end
    ).select_related("user", "event")
    if not request.user.is_superuser:
        records = records.filter(event__created_by=request.user)

    response = HttpResponse(content_type='text/csv')
    response["Content-Disposition"] = 'attachment; filename="custom_range.csv"'

    writer = csv.writer(response)
    writer.writerow([
        "First Name", "Last Name", "Username", "Email",
        "Event", "Date", "Time", "IP", "Device"
    ])

    for r in records:
        writer.writerow([
            r.user.first_name,
            r.user.last_name,
            r.user.username,
            r.user.email,
            r.event.title,
            r.scan_time.date(),
            r.scan_time.time().strftime("%H:%M"),
            r.ip_address or "",
            r.device_info or ""
        ])

    return response

@swagger_auto_schema(
    method='get',
    tags=["📥 EXPORT"],
    operation_summary="Export Attendance by Date Range (PDF)",
    operation_description="Download attendance records between start_date and end_date",
    manual_parameters=[
        openapi.Parameter(
            'start_date',
            openapi.IN_QUERY,
            description="Start date (YYYY-MM-DD)",
            type=openapi.TYPE_STRING,
            required=True
        ),
        openapi.Parameter(
            'end_date',
            openapi.IN_QUERY,
            description="End date (YYYY-MM-DD)",
            type=openapi.TYPE_STRING,
            required=True
        ),
    ],
    responses={
        200: openapi.Response(
            description="PDF file",
            schema=openapi.Schema(type=openapi.TYPE_FILE)
        )
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_custom_range_pdf(request):

    if not is_event_admin(request.user):
        return Response({"error": "Not allowed"}, status=403)

    start_raw = request.GET.get("start_date")
    end_raw = request.GET.get("end_date")

    if not start_raw or not end_raw:
        return Response(
            {"error": "start_date and end_date required (YYYY-MM-DD)"},
            status=400
        )

    start, _= parse_datetime(start_raw)
    _, end = parse_datetime(end_raw)

    records = Attendance.objects.filter(
        scan_time__gte=start,
        scan_time__lt=end
    ).select_related("user", "event")
    if not request.user.is_superuser:
        records = records.filter(event__created_by=request.user)
    
    response = HttpResponse(content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="attendance_range.pdf"'

    doc = SimpleDocTemplate(
        response,
        pagesize=landscape(A3),
        leftMargin=10,
        rightMargin=10,
        topMargin=10,
        bottomMargin=10,
    )

    data = [[
        "First Name", "Last Name", "Username", "Email",
        "Event", "Location", "Scan Date", "Scan Time", "IP", "Device"
    ]]

    # col_widths = [60, 60, 80, 140, 120, 120, 70, 60, 90, 180]

    for r in records:
        data.append([
            r.user.first_name,
            r.user.last_name,
            r.user.username,
            r.user.email,
            r.event.title,
            r.event.location_name,
            r.scan_time.date(),
            r.scan_time.time().strftime("%H:%M"),
            r.ip_address or "",
            r.device_info or "",
        ])

    page_width, _ = landscape(A3)
    usable_width = page_width - 20  # margins

    # AUTO-FIT WIDTHS
    col_widths = calc_col_widths(data, usable_width)

    # CREATE TABLE
    table = Table(data, colWidths=col_widths, repeatRows=1)

    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    doc.build([table])

    return response
