from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Q
from .models import Event
from datetime import date
from django.utils import timezone
from .serializers import EventSerializer, UpdateEventSerializer,AllSerializer
from rest_framework.pagination import PageNumberPagination
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from events.tasks import send_invitation_email,create_event_email,send_bulk_invitation_email
import re
from attendance.utils import generate_qr_code

User = get_user_model()


def is_event_admin(user):
    return bool(user and user.is_authenticated and (user.role == "admin" or user.is_superuser))


def can_manage_event(user, event):
    return bool(user and user.is_authenticated and (user.is_superuser or event.created_by_id == user.id))


def split_events_by_status(events):
    now = timezone.localtime()
    upcoming = []
    active = []
    past = []

    for event in events:
        start_dt = timezone.make_aware(
            timezone.datetime.combine(event.date, event.start_time)
        )
        end_dt = timezone.make_aware(
            timezone.datetime.combine(event.date, event.end_time)
        )

        if now < start_dt:
            upcoming.append(event)
        elif start_dt <= now <= end_dt:
            active.append(event)
        else:
            past.append(event)

    return upcoming, active, past
def get_assignment_preview(event, user_ids):
    users = User.objects.filter(id__in=user_ids)

    
    input_ids = set(user_ids)
    found_ids = set(users.values_list("id", flat=True))

    missing_ids = list(input_ids - found_ids)

    existing_ids = set(event.attendees.values_list("id", flat=True))

    new_users = users.exclude(id__in=existing_ids)
    already_assigned_users = users.filter(id__in=existing_ids)

    return {
        "users": users,
        "new_users": new_users,
        "existing_ids": existing_ids,
        "missing_ids": missing_ids,
        "summary": {
            "will_receive_email": new_users.count(),
            "already_assigned": already_assigned_users.count(),
            "invalid_ids": len(missing_ids)
        },
        "details": {
            "to_be_added": list(new_users.values("id", "email", "first_name")),
            "already_assigned": list(already_assigned_users.values("id", "email")),
            "invalid_ids": missing_ids
        }
    }
# Create your views here.
@swagger_auto_schema(
    method='post',
    tags=["📅 EVENTS"],
    operation_summary="Create Event",
    operation_description="Event admin or superuser creates a new event",
    request_body=EventSerializer,
    responses={
        201: openapi.Response("Event created"),
        403: "Only event admins or superusers can create events"
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_event(request):
    if not is_event_admin(request.user):
        return Response({"error": "Only event admins or superusers can create events"}, status=403)
    serializer = EventSerializer(data=request.data)
    if serializer.is_valid():
        data = serializer.validated_data

        existing = Event.objects.filter(
            created_by=request.user,
            date=data.get("date"),
            is_active=True
        )

        for e in existing:
            if data["start_time"] < e.end_time and data["end_time"] > e.start_time:
                return Response(
                    {"error": "This event overlaps with another event you created"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        event=serializer.save(created_by=request.user)
        create_event_email(event.title,event.event_code,request.user.email,request.user.first_name)

        return Response(
            {"message": "Event created successfully", "data": serializer.data},
            status=status.HTTP_201_CREATED
        )

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@swagger_auto_schema(
    method='post',
    tags=["📅 EVENTS"],
    operation_summary="Generate Event QR",
    operation_description="Generate a QR code for an existing event when the owner is ready to start attendance.",
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
        200: "QR generated successfully",
        403: "Not allowed",
        404: "Event not found"
    }
)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_event_qr(request, event_id):
    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_event(request.user, event):
        return Response({"error": "You are not allowed to generate a QR for this event"}, status=status.HTTP_403_FORBIDDEN)

    qr_data = generate_qr_code(str(event.id))
    if not qr_data:
        return Response({"error": "Failed to generate QR code"}, status=status.HTTP_502_BAD_GATEWAY)

    return Response({
        "message": "QR code generated successfully",
        "event_id": str(event.id),
        "event_title": event.title,
        "data": qr_data
    }, status=status.HTTP_200_OK)




@swagger_auto_schema(
    method='post',
    tags=["📅 EVENTS"],
    operation_summary="Preview Assign Users",
    operation_description="Preview users before assignment (no DB changes)",
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
    request_body=openapi.Schema(
        type=openapi.TYPE_OBJECT,
        required=["user_ids"],
        properties={
            "user_ids": openapi.Schema(
                type=openapi.TYPE_ARRAY,
                items=openapi.Items(type=openapi.TYPE_INTEGER)
            )
        }
    ),
    responses={
        200: openapi.Response(
            description="Preview result",
            examples={
                "application/json": {
                    "summary": {
                        "will_receive_email": 2,
                        "already_assigned": 1,
                        "invalid_ids": 1
                    }
                }
            }
        )
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preview_assign(request, event_id):

    if not is_event_admin(request.user):
        return Response({"error":"Only event admins or superusers can preview assignments"}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        event= Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error":"Event not found"}, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_event(request.user, event):
        return Response({"error":"Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    
    user_ids = request.data.get("user_ids", [])
    if not user_ids:
        return Response({"error": "No users provided"}, status=status.HTTP_400_BAD_REQUEST)
    
    preview = get_assignment_preview(event, user_ids)

    return Response({
        "summary": preview["summary"],
        "details": preview["details"]
    })



@swagger_auto_schema(
    method='get',
    tags=["📅 EVENTS"],
    operation_summary="List Events",
    operation_description="**List all events (search + filter)**",
    manual_parameters=[
        openapi.Parameter('search', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('date', openapi.IN_QUERY, type=openapi.TYPE_STRING),
        openapi.Parameter('status', openapi.IN_QUERY, type=openapi.TYPE_STRING),
    ]
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_events(request):
    if request.user.is_superuser:
        events = Event.objects.filter(is_active=True).select_related('created_by').order_by('-date')
    elif request.user.role =="admin":
        events = Event.objects.filter(created_by=request.user, is_active=True).select_related('created_by').order_by('-date')
    else:
        events = Event.objects.filter(attendees=request.user, is_active=True).select_related('created_by').order_by('-date')
    events = events.order_by('-date')
    search = request.GET.get("search")
    if search:
        events = events.filter(
            Q(title__icontains=search) |
            Q(description__icontains=search) 
        )
    filter_date = request.GET.get("date")
    if filter_date:
        events = events.filter(date=filter_date)

    status_filter = request.GET.get("status", "").lower()
    if status_filter in {"upcoming", "active", "past"}:
        upcoming, active, past = split_events_by_status(list(events))
        status_map = {
            "upcoming": upcoming,
            "active": active,
            "past": past,
        }
        events = status_map[status_filter]

    paginator = PageNumberPagination()
    result_page = paginator.paginate_queryset(events, request)
    serializer = EventSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)

@swagger_auto_schema(
    method='post',
    tags=["📅 EVENTS"],
    operation_summary="Assign Users",
    operation_description="Assign users to event (requires confirm=true)",
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
    request_body=openapi.Schema(
    type=openapi.TYPE_OBJECT,
    required=["user_ids", "confirm"],
    properties={
        "user_ids": openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(type=openapi.TYPE_INTEGER)
        ),
        "confirm": openapi.Schema(type=openapi.TYPE_BOOLEAN)
    },
    example={
        "user_ids": [1, 2, 3],
        "confirm": True
    }
),
    responses={
        200: "Assignment successful or preview returned",
        400: "Missing confirmation or invalid input",
        403: "Event admin or superuser only"
    }
)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def assign(request, event_id):
    if not is_event_admin(request.user):
        return Response({"error": "Only event admins or superusers can assign users"}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_event(request.user, event):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    
    user_ids = request.data.get("user_ids", [])
    confirm = request.data.get("confirm", False)

    if not user_ids:
        return Response({"error":"No user provided"}, status=status.HTTP_400_BAD_REQUEST)
    preview = get_assignment_preview(event, user_ids)

    
    if not confirm:
        return Response({
            "message": "Confirmation required",
            "preview": preview["summary"]
        }, status=400)

    new_users = preview["new_users"]

   
    new_users = new_users.exclude(email=None).exclude(email="")

    
    event.attendees.add(*new_users)

    
    send_bulk_invitation_email(
        event.id,
        list(new_users.values_list("id", flat=True))
    )

    return Response({
        "message": "Assignment complete",
        "added": list(new_users.values_list("id", flat=True)),
        "summary": preview["summary"]
    })

@swagger_auto_schema(
    method='get',
    tags=["📅 EVENTS"],
    operation_summary="My Events",
    operation_description="**Get user's assigned events (past & upcoming)**",
    manual_parameters=[
        openapi.Parameter(
            'search',
            openapi.IN_QUERY,
            description="Search by title or description",
            type=openapi.TYPE_STRING
        ),
        openapi.Parameter(
            'date',
            openapi.IN_QUERY,
            description="Filter by date (YYYY-MM-DD)",
            type=openapi.TYPE_STRING
        ),
    ],
    responses={200: EventSerializer(many=True)}
)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_events(request):
    events = Event.objects.filter(attendees=request.user, is_active=True).select_related('created_by')

    search = request.GET.get("search")
    if search:
        events = events.filter(
            Q(title__icontains=search) |
            Q(description__icontains=search) 
        )
    filter_date = request.GET.get ("date")
    if filter_date:
        events = events.filter(
            date=filter_date
        )

    event_list = list(events)
    upcoming, active, past = split_events_by_status(event_list)

    return Response ({
        "upcoming": EventSerializer(upcoming, many=True).data,
        "active": EventSerializer(active, many=True).data,
        "past": EventSerializer(past, many=True).data
    })

@swagger_auto_schema(
    method='get',
    tags=["📅 EVENTS"],
    operation_summary="Event Detail",
    operation_description="**Get event details**",
    manual_parameters=[
        openapi.Parameter('event_id', openapi.IN_PATH, type=openapi.TYPE_STRING, format='uuid')
    ],
    responses={
    200: EventSerializer,
    403: "Permission denied",
    404: "Event not found"
}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def event_detail(request, event_id):
    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=status.HTTP_404_NOT_FOUND)
    if not can_manage_event(request.user, event) and not event.attendees.filter(id=request.user.id).exists():
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    serializer = EventSerializer(event)
    return Response({"success": "Event retrieved", "data": serializer.data}, status=status.HTTP_200_OK)

@swagger_auto_schema(
    method='put',
    tags=["📅 EVENTS"],
    operation_summary="Update Event",
    operation_description="**Update event details**",
    request_body=UpdateEventSerializer,
    manual_parameters=[
        openapi.Parameter('event_id', openapi.IN_PATH, type=openapi.TYPE_STRING, format='uuid')
    ]
)
@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_event(request, event_id):
    try:
        event = Event.objects.get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error": "Event not found"}, status=status.HTTP_404_NOT_FOUND)
    
    if not can_manage_event(request.user, event):
        return Response({"error": "You are not allowed to edit this event"}, status=status.HTTP_403_FORBIDDEN)
    serializer = UpdateEventSerializer(event, data=request.data, partial=True)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data

    no_change = True
    for field, value in data.items():
        if getattr(event,field) != value:
            no_change = False
            break

    if no_change:
        return Response(
            {"detail":"No changes detected"}, status=status.HTTP_400_BAD_REQUEST
        )
    
    existing = Event.objects.filter(
        date=data.get("date", event.date),
        is_active=True
    ).exclude(id=event.id)
    if not request.user.is_superuser:
        existing = existing.filter(created_by=request.user)

    start_time = data.get("start_time", event.start_time)
    end_time = data.get("end_time", event.end_time)

    for e in existing:
        if start_time < e.end_time and end_time > e.start_time:
            return Response(
                {"error": "This update causes a time overlap with another event"},
                status=status.HTTP_400_BAD_REQUEST
            )
    

    serializer.save()

    return Response(
        {"message": "Event updated successfully", "data": serializer.data},
        status=status.HTTP_200_OK
    )
  
@swagger_auto_schema(
    method='delete',
    tags=["📅 EVENTS"],
    operation_summary="Delete Event",
    operation_description="**Soft delete event**",
    manual_parameters=[
        openapi.Parameter('event_id', openapi.IN_PATH, type=openapi.TYPE_STRING, format='uuid')
    ],
    responses={
    200: "Event deleted",
    403: "Not allowed",
    404: "Not found"
}
)
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_event(request, event_id):
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return Response({"error":"Event not found"}, status=status.HTTP_404_NOT_FOUND)
    
    if not can_manage_event(request.user, event):
        return Response({"error":"You are not allowed to delete this event."}, status=status.HTTP_403_FORBIDDEN)
    event.is_active = False
    event.save()

    return Response({"message": "Event deleted"}, status=status.HTTP_200_OK)

@swagger_auto_schema(
    method='get',
    tags=["📅 EVENTS"],
    operation_summary="All Events",
    operation_description="**Superusers can view all events. Event admins see events they created.**",
    manual_parameters=[
    openapi.Parameter('search', openapi.IN_QUERY, type=openapi.TYPE_STRING),
    openapi.Parameter(
            'date',
            openapi.IN_QUERY,
            description="Filter by date (YYYY-MM-DD)",
            type=openapi.TYPE_STRING
        ),
    openapi.Parameter('status', openapi.IN_QUERY, type=openapi.TYPE_STRING),
],
    responses={200: AllSerializer(many=True)}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def allevents(request):
    if not is_event_admin(request.user):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    events = Event.objects.all() if request.user.is_superuser else Event.objects.filter(created_by=request.user)
    search = request.GET.get('search')
    if search:
        events = Event.objects.filter(
            Q(title__icontains=search) |
            Q(description__icontains=search)
        )
    eventdate = request.GET.get('date')
    if eventdate:
        events = events.filter(
            Q(date__exact=eventdate)
        )
    status_filter = request.GET.get("status", "").lower()
    if status_filter in {"upcoming", "active", "past", "deleted"}:
        if status_filter == "deleted":
            events = events.filter(is_active=False)
        else:
            active_events = events.filter(is_active=True)
            upcoming, active, past = split_events_by_status(list(active_events))
            status_map = {
                "upcoming": upcoming,
                "active": active,
                "past": past,
            }
            events = status_map[status_filter]
    paginator = PageNumberPagination()
    result_page = paginator.paginate_queryset(events, request)
    serializer = AllSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)

@swagger_auto_schema(
    method='get',
    tags=["📅 EVENTS"],
    operation_summary="Event Attendees",
    operation_description="**Get all users assigned to an event**",
    manual_parameters=[
        openapi.Parameter(
            'event_id',
            openapi.IN_PATH,
            description="ID of the event",
            type=openapi.TYPE_STRING,
            format='uuid',
            required=True
        ),
        openapi.Parameter('search', openapi.IN_QUERY, type=openapi.TYPE_STRING)

    ],
    responses={200: "List of attendees"}
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def event_attendees(request, event_id):
    try:
        event = Event.objects.select_related('created_by').get(id=event_id, is_active=True)
    except Event.DoesNotExist:
        return Response({"error":"Event not found"}, status=status.HTTP_404_NOT_FOUND)

    if not can_manage_event(request.user, event):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)
    
    users = event.attendees.order_by('username')
    search = request.GET.get('search',None)
    if search:
        users = users.filter(
            Q(username__icontains=search) | 
            Q(email__icontains=search) |
            Q(first_name__icontains=search) | 
            Q(last_name__icontains=search)
        )

    paginator = PageNumberPagination()
    result_page = paginator.paginate_queryset(users, request)
    data = [
        {
            "id": user.id,
            "username":user.username,
            "email":user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
            "role": user.role,
        }
        for user in result_page
    ]

    return paginator.get_paginated_response({
        "event": event.title,
        "attendees": data
    })


