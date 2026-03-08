"""
Tamper detection for audit evidence (separate chain).
Verifies file integrity and optional metadata for AuditEvidence.
"""
import hashlib
import requests

from core.models import AuditEvidence, AuditTamperDetection


def _fetch_file_content(url: str) -> bytes:
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_audit_file_integrity(audit_evidence_id: int) -> dict:
    """
    Checks if audit evidence file content matches stored file_content_hash.

    Returns:
        {
            'is_intact': bool,
            'stored_hash': str,
            'current_hash': str,
            'tampered': bool,
        }
    """
    evidence = AuditEvidence.objects.filter(pk=audit_evidence_id).first()
    if not evidence:
        return {
            'is_intact': False,
            'stored_hash': '',
            'current_hash': '',
            'tampered': True,
        }
    stored = evidence.file_content_hash or evidence.hash_value
    if not stored:
        return {
            'is_intact': False,
            'stored_hash': '',
            'current_hash': '',
            'tampered': True,
        }
    try:
        content = _fetch_file_content(evidence.file_url)
        current_hash = _sha256_hex(content)
        is_intact = current_hash == stored
        return {
            'is_intact': is_intact,
            'stored_hash': stored,
            'current_hash': current_hash,
            'tampered': not is_intact,
        }
    except Exception:
        return {
            'is_intact': False,
            'stored_hash': stored,
            'current_hash': '',
            'tampered': True,
        }


def run_initial_forensics_audit(audit_evidence_id: int) -> AuditTamperDetection | None:
    """
    Run integrity check for audit evidence and store one AuditTamperDetection record.
    Used right after auditor upload.
    """
    evidence = AuditEvidence.objects.filter(pk=audit_evidence_id).first()
    if not evidence:
        return None
    integrity = verify_audit_file_integrity(audit_evidence_id)
    is_tampered = integrity.get('tampered', True)
    return AuditTamperDetection.objects.create(
        audit_evidence_id=audit_evidence_id,
        is_tampered=is_tampered,
        detection_method='hash_check',
        confidence_score=0.9 if is_tampered else 0.0,
        findings={'integrity': integrity},
        flagged_by='system',
    )
