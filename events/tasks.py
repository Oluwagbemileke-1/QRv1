from notifications.tasks import send_email_task

def create_event_email(title,event_code,email,first_name):

    subject="Event Created Successfully"
    message=f"""
Hi {first_name},

Your event "{title}" has been created successfully.

Event Code: {event_code}

Thanks,
QRAMS.
    """
    
    send_email_task(email, subject, message)

def send_invitation_email(first_name,title,date,start_time,end_time,location_name,event_code,email):
    subject=f"You've been invited to {title}"
    message=f"""
Hello {first_name},

You have been invited to an event

Event: {title}
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
            event.date,
            event.start_time,
            event.end_time,
            event.location_name,
            event.event_code,
            user.email
        )
    print(f"Bulk email sent to {users.count()} recipients")  