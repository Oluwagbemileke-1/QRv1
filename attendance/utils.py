from datetime import datetime, timedelta, time
from django.utils import timezone


def this_week_range():
    today = timezone.localdate()
    start = today - timedelta(days=today.weekday())  # Monday
    end = start + timedelta(days=6)

    start_dt = timezone.make_aware(datetime.combine(start, time.min))
    end_dt = timezone.make_aware(datetime.combine(end, time.max))

    return start_dt, end_dt


def parse_datetime(date_str):
    """
    Accepts YYYY-MM-DD and returns timezone-aware datetime range
    """
    date_obj = datetime.strptime(date_str, "%Y-%m-%d").date()

    start = timezone.make_aware(datetime.combine(date_obj, time.min))
    end = timezone.make_aware(datetime.combine(date_obj, time.max))

    return start