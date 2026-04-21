from datetime import datetime, timedelta, time
from django.utils import timezone
import requests
import os


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

    return start, end


# .NET API integration functions
DOTNET_API_BASE = os.getenv('DOTNET_API_BASE', 'https://qr-attendance-project-2yh5.onrender.com')
DOTNET_API_TIMEOUT = int(os.getenv('DOTNET_API_TIMEOUT', '60'))


def generate_qr_code(event_id, event_code):
    """
    Call .NET API to generate QR code for an event
    """
    url = f"{DOTNET_API_BASE}/api/qr/generate"
    payload = {
        'eventId': str(event_id),
        'eventCode': event_code,
    }
    try:
        response = requests.post(url, json=payload, timeout=DOTNET_API_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        return data.get('data')
    except requests.RequestException as e:
        print(f"Error generating QR: {e}")
        return None


def validate_qr_code(qr_data, username):
    """
    Call .NET API to validate QR code and check for fraud
    """
    url = f"{DOTNET_API_BASE}/api/scan"
    payload = {
        'payload': qr_data,
        'username': username
    }
    try:
        response = requests.post(url, json=payload, timeout=DOTNET_API_TIMEOUT)
        if response.status_code == 200:
            data = response.json()
            result = data.get('data', {})
            scan_result = result.get('result')
            if scan_result == 'Success':
                return {'valid': True, 'fraud_detected': False, 'message': 'Scan successful'}
            elif scan_result == 'Fraud':
                return {'valid': False, 'fraud_detected': True, 'message': 'Fraud detected'}
            else:
                return {'valid': False, 'fraud_detected': False, 'message': 'Invalid or expired QR code'}
        elif response.status_code == 403:
            return {'valid': False, 'fraud_detected': True, 'message': 'Fraud detected'}
        elif response.status_code == 400:
            return {'valid': False, 'fraud_detected': False, 'message': 'Invalid or expired QR code'}
        else:
            return {'valid': False, 'fraud_detected': False, 'message': 'API error'}
    except requests.RequestException as e:
        print(f"Error validating QR: {e}")
        return {'valid': False, 'fraud_detected': False, 'message': 'API error'}


def get_attendance_count(event_id):
    """
    Get attendance count from .NET API
    """
    url = f"{DOTNET_API_BASE}/api/scan/event/{event_id}/count"
    try:
        response = requests.get(url, timeout=DOTNET_API_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        return data.get('data', {}).get('attendanceCount', 0)
    except requests.RequestException as e:
        print(f"Error getting attendance count: {e}")
        return 0


def get_event_stats(event_id):
    """
    Get event stats from .NET API
    """
    url = f"{DOTNET_API_BASE}/api/scan/event/{event_id}/stats"
    try:
        response = requests.get(url, timeout=DOTNET_API_TIMEOUT)
        response.raise_for_status()
        data = response.json()
        return data.get('data')
    except requests.RequestException as e:
        print(f"Error getting event stats: {e}")
        return None
