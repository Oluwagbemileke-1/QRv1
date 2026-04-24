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


def _extract_scan_message(data, default_message):
    if not isinstance(data, dict):
        return default_message

    result = data.get('data', {})
    if not isinstance(result, dict):
        result = {}

    return result.get('message') or data.get('message') or data.get('error') or default_message


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


def validate_qr_code(
    qr_data,
    username,
    event_code,
    ip_address=None,
    location=None,
    latitude=None,
    longitude=None,
):
    """
    Call .NET API to validate QR code and check for fraud
    """
    url = f"{DOTNET_API_BASE}/api/scan"
    payload = {
        'payload': qr_data,
        'username': username,
        'eventCode': event_code,
        'location': location,
        'latitude': latitude,
        'longitude': longitude,
    }
    headers = {}
    if ip_address:
        headers['X-Forwarded-For'] = ip_address
    try:
        response = requests.post(
            url,
            json=payload,
            headers=headers,
            timeout=DOTNET_API_TIMEOUT,
        )
        try:
            data = response.json()
        except ValueError:
            data = {}

        result = data.get('data', {}) if isinstance(data, dict) else {}
        if not isinstance(result, dict):
            result = {}
        scan_result = result.get('result')
        if scan_result is None and isinstance(data, dict):
            scan_result = data.get('result')
        message = _extract_scan_message(data, 'QR scan service returned an unexpected response')
        if response.status_code == 200:
            if scan_result == 'Success':
                return {'valid': True, 'fraud_detected': False, 'message': message or 'Scan successful'}
            if scan_result == 'Fraud':
                return {'valid': False, 'fraud_detected': True, 'message': message or 'Fraud detected'}
            return {'valid': False, 'fraud_detected': False, 'message': message or 'Invalid or expired QR code'}

        if response.status_code == 403:
            return {
                'valid': False,
                'fraud_detected': scan_result == 'Fraud',
                'message': message or ('Fraud detected' if scan_result == 'Fraud' else 'Scan not allowed'),
            }

        if response.status_code == 400:
            return {'valid': False, 'fraud_detected': False, 'message': message or 'Invalid or expired QR code'}

        print(f"QR scan service error: status={response.status_code} body={data}")
        return {
            'valid': False,
            'fraud_detected': False,
            'message': message or f'QR scan service error ({response.status_code})',
        }
    except requests.Timeout as e:
        print(f"QR scan timeout: {e}")
        return {
            'valid': False,
            'fraud_detected': False,
            'message': 'QR scan service timed out. Please try again.',
        }
    except requests.RequestException as e:
        print(f"Error validating QR: {e}")
        return {
            'valid': False,
            'fraud_detected': False,
            'message': 'QR scan service is unavailable. Please try again.',
        }


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
