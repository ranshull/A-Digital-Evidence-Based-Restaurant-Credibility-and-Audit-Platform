"""
Separate cryptographic hash chain for audit evidence (one chain per audit).
Mirrors hash_chain.py for Evidence but uses Audit and AuditEvidence.
"""
import hashlib
import json
import secrets
import time
from django.utils import timezone

from core.crypto.hash_chain import generate_evidence_hash


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def create_genesis_hash_audit(audit_id: int) -> str:
    """
    First hash in chain for an audit.
    Genesis = SHA-256(audit_id + creation_timestamp + random_salt).
    """
    now = timezone.now().isoformat()
    salt = secrets.token_hex(32)
    data = f"{audit_id}{now}{salt}".encode('utf-8')
    return _sha256_hex(data)


def add_audit_evidence_to_chain(
    audit_id: int,
    file_content: bytes,
    metadata: dict,
) -> dict:
    """
    Computes chain fields for new audit evidence. Caller persists AuditEvidence
    and calls update_audit_chain_after_append.

    Returns:
        {
            'hash_value': str,
            'previous_hash': str,
            'chain_index': int,
            'nonce': str,
            'file_content_hash': str,
        }
    """
    from core.models import AuditHashChain, AuditEvidence

    chain = AuditHashChain.objects.filter(audit_id=audit_id).first()
    if chain is None:
        genesis = create_genesis_hash_audit(audit_id)
        chain = AuditHashChain.objects.create(
            audit_id=audit_id,
            genesis_hash=genesis,
            current_hash=genesis,
            chain_length=0,
        )

    previous_hash = chain.current_hash
    chain_index = chain.chain_length
    nonce = secrets.token_hex(32)
    file_content_hash = _sha256_hex(file_content)
    hash_value = generate_evidence_hash(
        file_content=file_content,
        previous_hash=previous_hash,
        metadata=metadata,
        nonce=nonce,
    )

    return {
        'hash_value': hash_value,
        'previous_hash': previous_hash,
        'chain_index': chain_index,
        'nonce': nonce,
        'file_content_hash': file_content_hash,
    }


def verify_audit_hash_chain(audit_id: int) -> dict:
    """
    Verifies entire audit evidence chain. Updates AuditHashChain last_verified and is_valid.

    Returns:
        {
            'is_valid': bool,
            'chain_length': int,
            'broken_at_index': int | None,
            'invalid_evidence_ids': list[int],
            'verification_time_ms': float,
        }
    """
    from core.models import AuditEvidence, AuditHashChain

    start = time.perf_counter()
    evidence_list = (
        AuditEvidence.objects.filter(audit_id=audit_id)
        .exclude(chain_index__isnull=True)
        .order_by('chain_index')
    )
    chain = AuditHashChain.objects.filter(audit_id=audit_id).first()

    invalid_evidence_ids = []
    broken_at_index = None
    expected_previous = chain.genesis_hash if chain else None

    for idx, ev in enumerate(evidence_list):
        if ev.chain_index != idx:
            invalid_evidence_ids.append(ev.id)
            if broken_at_index is None:
                broken_at_index = idx
            break
        if expected_previous is not None and ev.previous_hash != expected_previous:
            invalid_evidence_ids.append(ev.id)
            if broken_at_index is None:
                broken_at_index = idx
            break
        expected_previous = ev.hash_value

    verification_time_ms = (time.perf_counter() - start) * 1000
    count = evidence_list.count()
    is_valid = (
        len(invalid_evidence_ids) == 0
        and (chain is not None and chain.chain_length == count)
    )

    if chain:
        chain.last_verified = timezone.now()
        chain.is_valid = is_valid
        chain.save(update_fields=['last_verified', 'is_valid'])

    return {
        'is_valid': is_valid,
        'chain_length': count,
        'broken_at_index': broken_at_index,
        'invalid_evidence_ids': invalid_evidence_ids,
        'verification_time_ms': round(verification_time_ms, 2),
    }


def update_audit_chain_after_append(audit_id: int, new_hash: str) -> None:
    """Call after saving new AuditEvidence; updates AuditHashChain."""
    from core.models import AuditHashChain

    chain = AuditHashChain.objects.get(audit_id=audit_id)
    chain.current_hash = new_hash
    chain.chain_length += 1
    chain.save(update_fields=['current_hash', 'chain_length'])
