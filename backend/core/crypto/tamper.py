"""
Phase 2: Tamper detection — verify file integrity and detect manipulation.
"""
import hashlib
import io
import requests
from django.utils import timezone

from core.models import Evidence, TamperDetection, EvidenceStatus


def _fetch_file_content(url: str) -> bytes:
    """Fetch file from URL; raises on failure."""
    resp = requests.get(url, timeout=30)
    resp.raise_for_status()
    return resp.content


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def verify_file_integrity(evidence_id: int) -> dict:
    """
    Checks if file content matches stored hash (file_content_hash or hash_value).

    Returns:
        {
            'is_intact': bool,
            'stored_hash': str,
            'current_hash': str,
            'tampered': bool,
        }
    """
    evidence = Evidence.objects.filter(pk=evidence_id).first()
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


def detect_metadata_tampering(evidence_id: int) -> dict:
    """
    Checks for suspicious metadata changes (size, type, EXIF vs upload time, etc.).

    Returns:
        {
            'suspicious': bool,
            'flags': list[str],
            'confidence': float (0-1),
        }
    """
    evidence = Evidence.objects.filter(pk=evidence_id).first()
    if not evidence:
        return {'suspicious': True, 'flags': ['evidence_not_found'], 'confidence': 1.0}

    flags = []
    try:
        content = _fetch_file_content(evidence.file_url)
    except Exception:
        return {'suspicious': True, 'flags': ['fetch_failed'], 'confidence': 1.0}

    # File size changed
    if len(content) != evidence.file_size_bytes:
        flags.append('file_size_changed')

    # Basic type check
    if evidence.file_type == 'IMAGE' and not content[:12].startswith(b'\xff\xd8') and not content[:8].startswith(b'\x89PNG'):
        if 'image' in (evidence.mime_type or '').lower():
            flags.append('content_type_mismatch')

    # EXIF / creation time vs upload_timestamp (if Pillow available)
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(content))
        exif = getattr(img, 'getexif', lambda: None)() or (getattr(img, '_getexif', lambda: None)() if hasattr(img, '_getexif') else None)
        if exif:
            # 36867 = DateTimeOriginal
            date_orig = exif.get(36867) if hasattr(exif, 'get') else None
            if date_orig:
                from datetime import datetime
                try:
                    dt = datetime.strptime(str(date_orig), '%Y:%m:%d %H:%M:%S')
                    if evidence.upload_timestamp and dt.replace(tzinfo=evidence.upload_timestamp.tzinfo) > evidence.upload_timestamp:
                        flags.append('exif_date_after_upload')
                except (ValueError, TypeError):
                    pass
    except Exception:
        pass

    confidence = min(1.0, 0.3 + 0.4 * len(flags)) if flags else 0.0
    return {
        'suspicious': len(flags) > 0,
        'flags': flags,
        'confidence': round(confidence, 2),
    }


def analyze_image_authenticity(file_path_or_content: str | bytes) -> dict:
    """
    Basic image forensics (ELA-style and noise). Accepts path or bytes.

    Returns:
        {
            'likely_edited': bool,
            'edited_regions': list,
            'confidence': float,
            'techniques_used': list[str],
        }
    """
    techniques_used = []
    edited_regions = []
    confidence = 0.0

    try:
        from PIL import Image
        import numpy as np
    except ImportError:
        return {
            'likely_edited': False,
            'edited_regions': [],
            'confidence': 0.0,
            'techniques_used': [],
        }

    try:
        if isinstance(file_path_or_content, bytes):
            img = Image.open(io.BytesIO(file_path_or_content))
        else:
            img = Image.open(file_path_or_content)
        img = img.convert('RGB')
        arr = np.array(img)
    except Exception:
        return {
            'likely_edited': False,
            'edited_regions': [],
            'confidence': 0.0,
            'techniques_used': [],
        }

    # Simple re-compression ELA: save at quality 95 and diff; high variance can indicate editing
    try:
        buf = io.BytesIO()
        img.save(buf, 'JPEG', quality=95)
        buf.seek(0)
        recomp = np.array(Image.open(buf).convert('RGB'))
        diff = np.abs(arr.astype(float) - recomp.astype(float))
        mean_diff = float(np.mean(diff))
        techniques_used.append('recompression_ela')
        if mean_diff > 15.0:
            confidence = min(1.0, confidence + 0.4)
        if mean_diff > 25.0:
            confidence = min(1.0, confidence + 0.3)
    except Exception:
        pass

    # Variance of luminance (uniform regions can indicate cloning)
    try:
        gray = np.dot(arr[..., :3], [0.299, 0.587, 0.114])
        block_var = np.var(gray)
        techniques_used.append('variance_analysis')
        if block_var < 1.0 and arr.size > 10000:
            confidence = min(1.0, confidence + 0.2)
    except Exception:
        pass

    return {
        'likely_edited': confidence >= 0.5,
        'edited_regions': edited_regions,
        'confidence': round(min(1.0, confidence), 2),
        'techniques_used': techniques_used,
    }


def run_initial_forensics(evidence_id: int) -> TamperDetection | None:
    """
    Run a quick integrity + metadata check and store one TamperDetection record.
    Used right after upload.
    """
    evidence = Evidence.objects.filter(pk=evidence_id).first()
    if not evidence:
        return None
    integrity = verify_file_integrity(evidence_id)
    metadata = detect_metadata_tampering(evidence_id)
    is_tampered = integrity.get('tampered', True) or metadata.get('suspicious', False)
    findings = {
        'integrity': integrity,
        'metadata': metadata,
    }
    confidence = 0.9 if is_tampered else 0.0
    if metadata.get('suspicious'):
        confidence = max(confidence, metadata.get('confidence', 0))
    return TamperDetection.objects.create(
        evidence_id=evidence_id,
        is_tampered=is_tampered,
        detection_method='hash_check,metadata',
        confidence_score=confidence,
        findings=findings,
        flagged_by='system',
    )


def run_tamper_detection_scan(
    status_filter: str | None = EvidenceStatus.APPROVED,
    limit: int | None = None,
) -> dict:
    """
    Scans evidence (default: approved) for tampering; creates TamperDetection rows.
    Returns summary: scanned, tampered_count, errors.
    """
    qs = Evidence.objects.exclude(file_content_hash__isnull=True).exclude(file_content_hash='')
    if status_filter:
        qs = qs.filter(status=status_filter)
    qs = qs.order_by('-upload_timestamp')
    if limit:
        qs = qs[:limit]
    ids = list(qs.values_list('id', flat=True))
    scanned = 0
    tampered_count = 0
    errors = 0
    for eid in ids:
        try:
            integrity = verify_file_integrity(eid)
            metadata = detect_metadata_tampering(eid)
            is_tampered = integrity.get('tampered', False) or metadata.get('suspicious', False)
            TamperDetection.objects.create(
                evidence_id=eid,
                is_tampered=is_tampered,
                detection_method='hash_check,metadata',
                confidence_score=0.9 if is_tampered else 0.0,
                findings={'integrity': integrity, 'metadata': metadata},
                flagged_by='system',
            )
            scanned += 1
            if is_tampered:
                tampered_count += 1
        except Exception:
            errors += 1
    return {
        'scanned': scanned,
        'tampered_count': tampered_count,
        'errors': errors,
    }
