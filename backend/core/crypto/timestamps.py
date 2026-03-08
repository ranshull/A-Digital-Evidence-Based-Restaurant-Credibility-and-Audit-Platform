"""
Phase 2: Timestamp verification — signed tokens and backdating detection.
"""
import base64
import hmac
import hashlib
import json
from datetime import datetime

from django.conf import settings
from django.utils import timezone as django_tz

from core.models import Evidence, EvidenceTimestamp


def _get_secret() -> bytes:
    s = getattr(settings, 'CRYPTO_TIMESTAMP_SECRET', None) or settings.SECRET_KEY
    return s.encode('utf-8') if isinstance(s, str) else str(s).encode('utf-8')


def create_timestamp_token(evidence_id: int, file_hash: str) -> str:
    """
    Creates cryptographically signed timestamp token.

    Token payload: evidence_id, file_hash, timestamp (ISO-8601), server_nonce.
    Signature: HMAC-SHA256(payload_canonical, secret).
    Returns: Base64-encoded JSON string of {payload, signature}.
    """
    import secrets
    now = django_tz.now()
    server_nonce = secrets.token_hex(16)
    payload = {
        'evidence_id': evidence_id,
        'file_hash': file_hash,
        'timestamp': now.isoformat(),
        'server_nonce': server_nonce,
    }
    canonical = json.dumps(payload, sort_keys=True)
    signature = hmac.new(
        _get_secret(),
        canonical.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()
    token = {'payload': payload, 'signature': signature}
    return base64.b64encode(json.dumps(token).encode('utf-8')).decode('ascii')


def verify_timestamp_token(evidence_id: int) -> dict:
    """
    Verifies timestamp token for evidence.

    Returns:
        {
            'is_valid': bool,
            'timestamp': datetime | None,
            'age_days': int,
            'signature_valid': bool,
        }
    """
    try:
        ts = EvidenceTimestamp.objects.get(evidence_id=evidence_id)
    except EvidenceTimestamp.DoesNotExist:
        return {
            'is_valid': False,
            'timestamp': None,
            'age_days': 0,
            'signature_valid': False,
        }
    try:
        raw = base64.b64decode(ts.timestamp_token.encode('ascii')).decode('utf-8')
        token = json.loads(raw)
        payload = token.get('payload', {})
        signature = token.get('signature', '')
        canonical = json.dumps(payload, sort_keys=True)
        expected_sig = hmac.new(
            _get_secret(),
            canonical.encode('utf-8'),
            hashlib.sha256,
        ).hexdigest()
        signature_valid = hmac.compare_digest(signature, expected_sig)
        ts_str = payload.get('timestamp')
        timestamp = None
        if ts_str:
            try:
                timestamp = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                pass
        # Not in future
        now = django_tz.now()
        if timestamp and timestamp.tzinfo is None:
            timestamp = django_tz.make_aware(timestamp)
        not_future = timestamp is None or timestamp <= now
        is_valid = signature_valid and not_future
        age_days = 0
        if timestamp:
            delta = now - timestamp
            age_days = max(0, delta.days)
        return {
            'is_valid': is_valid,
            'timestamp': timestamp,
            'age_days': age_days,
            'signature_valid': signature_valid,
        }
    except Exception:
        return {
            'is_valid': False,
            'timestamp': None,
            'age_days': 0,
            'signature_valid': False,
        }


def detect_backdating_attempt(evidence_id: int) -> dict:
    """
    Detects if timestamp was manipulated (server vs client time, EXIF, chain order).

    Returns:
        {
            'suspicious': bool,
            'flags': list[str],
            'recommended_action': str,
        }
    """
    flags = []
    try:
        evidence = Evidence.objects.get(pk=evidence_id)
    except Evidence.DoesNotExist:
        return {
            'suspicious': True,
            'flags': ['evidence_not_found'],
            'recommended_action': 'reject',
        }
    try:
        ts = EvidenceTimestamp.objects.get(evidence_id=evidence_id)
    except EvidenceTimestamp.DoesNotExist:
        return {
            'suspicious': False,
            'flags': [],
            'recommended_action': 'none',
        }
    # Server vs client time difference > 5 minutes
    if ts.client_time and ts.server_time:
        delta = abs((ts.server_time - ts.client_time).total_seconds())
        if delta > 300:
            flags.append('server_client_time_mismatch')
    # Signature invalid
    result = verify_timestamp_token(evidence_id)
    if not result.get('signature_valid'):
        flags.append('timestamp_signature_invalid')
    # Future timestamp
    if result.get('timestamp') and result['timestamp'] > django_tz.now():
        flags.append('timestamp_in_future')
    if flags:
        recommended = 'flag' if len(flags) == 1 and 'server_client_time_mismatch' in flags else 'reject'
    else:
        recommended = 'none'
    return {
        'suspicious': len(flags) > 0,
        'flags': flags,
        'recommended_action': recommended,
    }


def request_external_timestamp(file_hash: str) -> str:
    """
    Stub for external time authority (OpenTimestamps / RFC 3161 TSA).
    TODO: Integrate with OpenTimestamps or an RFC 3161 TSA server.
    """
    # Placeholder: return empty string; caller can store as time_authority_signature when implemented
    return ''
