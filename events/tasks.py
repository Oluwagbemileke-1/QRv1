from notifications.tasks import send_email_task

def create_event_email(title,description,event_code,email,first_name):

    subject="Event Created Successfully"
    message=f"""
Hi {first_name},

Your event "{title}" has been created successfully.

Event description: {description}

Event Code: {event_code}

Thanks,
QRAMS.
    """
    
    send_email_task(email, subject, message)

def send_invitation_email(first_name,title,description,date,start_time,end_time,location_name,event_code,email):
    subject=f"You've been invited to {title}"
    message=f"""
Hello {first_name},

You have been invited to an event

Event: {title}
Description: {description}
Date: {date}
Time: {start_time} - {end_time}
Location: {location_name}

Event Code: {event_code}

Please attend and scan the QR code at the venue

Thanks,
QRAMS.
    """
    print("INVITATION EMAIL SENT TO:", email)
    send_email_task(email, subject, message)

def send_bulk_invitation_email(event_id, user_ids):
    from events.models import Event
    from users.models import User

    event = Event.objects.get(id=event_id)
    users = User.objects.filter(id__in=user_ids).exclude(email__isnull=True).exclude(email='')

    if not users.exists():
        return

    # Send individual emails via Brevo
    for user in users:
        send_invitation_email(
            user.first_name,
            event.title,
            event.description,
            event.date,
            event.start_time,
            event.end_time,
            event.location_name,
            event.event_code,
            user.email
        )
    print(f"Bulk email sent to {users.count()} recipients")  


def send_creator_invitation_summary_email(event_id, user_ids):
    from events.models import Event
    from users.models import User

    event = Event.objects.select_related("created_by").get(id=event_id)
    creator = event.created_by

    if not creator or not creator.email:
        return

    users = User.objects.filter(id__in=user_ids).order_by("first_name", "last_name", "username")
    if not users.exists():
        return

    invited_lines = []
    for index, user in enumerate(users, start=1):
        fullname = f"{user.first_name} {user.last_name}".strip() or user.username
        invited_lines.append(f"{index}. {fullname}")

    subject = f"Invitations sent successfully for {event.title}"
    message = f"""
Hello {creator.first_name or creator.username},

You have successfully invited the following people to "{event.title}":

{chr(10).join(invited_lines)}

Event details:
Description: {event.description}
Date: {event.date}
Time: {event.start_time} - {event.end_time}
Location: {event.location_name}
Event Code: {event.event_code}

Thanks,
QRAMS.
    """
    send_email_task(creator.email, subject, message)

def send_event_update_email(first_name, title, description, date, start_time, end_time, location_name, event_code, email, reason="updated"):
    subject = f"Event {reason}: {title}"
    message = f"""
Hello {first_name},

An event you are connected to has been {reason}.

Event: {title}
Description: {description}
Date: {date}
Time: {start_time} - {end_time}
Location: {location_name}
Event Code: {event_code}

Please check the app for the latest details.

Thanks,
QRAMS.
    """
    send_email_task(email, subject, message)


def send_creator_event_status_email(first_name, title, description, date, start_time, end_time, location_name, event_code, email, action="updated"):
    subject = f"Your event was {action} successfully"
    message = f"""
Hello {first_name},

Your event "{title}" was {action} successfully.

Description: {description}
Date: {date}
Time: {start_time} - {end_time}
Location: {location_name}
Event Code: {event_code}

Please check the app for the latest details.

Thanks,
QRAMS.
    """
    send_email_task(email, subject, message)


def send_bulk_event_update_email(event_id, reason="updated"):
    from events.models import Event

    event = Event.objects.get(id=event_id)

    attendee_emails = list(
        event.attendees.exclude(email__isnull=True).exclude(email='').values_list('email', flat=True)
    )
    recipient_emails = set(attendee_emails)

    if not recipient_emails:
        return

    for email in recipient_emails:
        first_name = "there"
        user = event.attendees.filter(email=email).first()
        if user:
            first_name = user.first_name or user.username

        send_event_update_email(
            first_name=first_name,
            title=event.title,
            description=event.description,
            date=event.date,
            start_time=event.start_time,
            end_time=event.end_time,
            location_name=event.location_name,
            event_code=event.event_code,
            email=email,
            reason=reason
        )


def send_creator_event_update_email(event_id, action="updated"):
    from events.models import Event

    event = Event.objects.select_related("created_by").get(id=event_id)

    if not event.created_by or not event.created_by.email:
        return

    send_creator_event_status_email(
        first_name=event.created_by.first_name or event.created_by.username,
        title=event.title,
        description=event.description,
        date=event.date,
        start_time=event.start_time,
        end_time=event.end_time,
        location_name=event.location_name,
        event_code=event.event_code,
        email=event.created_by.email,
        action=action,
    )
