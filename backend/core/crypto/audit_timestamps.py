"""
Timestamp verification for audit evidence (separate chain).
Uses same HMAC secret as owner evidence timestamps.
"""
import base64
import hmac
import hashlib
import json
from datetime import datetime

from django.conf import settings
from django.utils import timezone as django_tz

from core.models import AuditEvidence, AuditEvidenceTimestamp


def _get_secret() -> bytes:
    s = getattr(settings, 'CRYPTO_TIMESTAMP_SECRET', None) or settings.SECRET_KEY
    return s.encode('utf-8') if isinstance(s, str) else str(s).encode('utf-8')


def create_audit_timestamp_token(audit_evidence_id: int, file_hash: str) -> str:
    """
    Creates signed timestamp token for audit evidence.
    Payload: audit_evidence_id, file_hash, timestamp, server_nonce.
    """
    import secrets
    now = django_tz.now()
    server_nonce = secrets.token_hex(16)
    payload = {
        'audit_evidence_id': audit_evidence_id,
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


def verify_audit_timestamp_token(audit_evidence_id: int) -> dict:
    """
    Verifies timestamp token for audit evidence.

    Returns:
        {
            'is_valid': bool,
            'timestamp': datetime | None,
            'age_days': int,
            'signature_valid': bool,
        }
    """
    try:
        ts = AuditEvidenceTimestamp.objects.get(audit_evidence_id=audit_evidence_id)
    except AuditEvidenceTimestamp.DoesNotExist:
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
        if timestamp and timestamp.tzinfo is None:
            timestamp = django_tz.make_aware(timestamp)
        now = django_tz.now()
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


def detect_audit_backdating_attempt(audit_evidence_id: int) -> dict:
    """
    Detects if audit evidence timestamp was manipulated.

    Returns:
        {
            'suspicious': bool,
            'flags': list[str],
            'recommended_action': str,
        }
    """
    flags = []
    try:
        AuditEvidence.objects.get(pk=audit_evidence_id)
    except AuditEvidence.DoesNotExist:
        return {
            'suspicious': True,
            'flags': ['audit_evidence_not_found'],
            'recommended_action': 'reject',
        }
    try:
        ts = AuditEvidenceTimestamp.objects.get(audit_evidence_id=audit_evidence_id)
    except AuditEvidenceTimestamp.DoesNotExist:
        return {
            'suspicious': False,
            'flags': [],
            'recommended_action': 'none',
        }
    if ts.client_time and ts.server_time:
        delta = abs((ts.server_time - ts.client_time).total_seconds())
        if delta > 300:
            flags.append('server_client_time_mismatch')
    result = verify_audit_timestamp_token(audit_evidence_id)
    if not result.get('signature_valid'):
        flags.append('timestamp_signature_invalid')
    if result.get('timestamp') and result['timestamp'] > django_tz.now():
        flags.append('timestamp_in_future')
    recommended = 'flag' if len(flags) == 1 and 'server_client_time_mismatch' in flags else 'reject' if flags else 'none'
    return {
        'suspicious': len(flags) > 0,
        'flags': flags,
        'recommended_action': recommended,
    }
