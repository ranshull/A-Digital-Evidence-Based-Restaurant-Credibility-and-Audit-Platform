"""
Phase 2: Cryptographic hash chain — link evidence in an immutable chain.
"""
import hashlib
import json
import secrets
import time
from django.utils import timezone


def _sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def generate_evidence_hash(
    file_content: bytes,
    previous_hash: str,
    metadata: dict,
    nonce: str,
) -> str:
    """
    Creates SHA-256 hash of evidence with chain linking.

    Algorithm:
        1. Hash file content: file_hash = SHA-256(file_content)
        2. Hash metadata: meta_hash = SHA-256(json.dumps(metadata, sort_keys=True))
        3. Combine: combined = previous_hash + file_hash + meta_hash + nonce
        4. Final hash: SHA-256(combined)
    """
    file_hash = _sha256_hex(file_content)
    meta_str = json.dumps(metadata, sort_keys=True)
    meta_hash = _sha256_hex(meta_str.encode('utf-8'))
    combined = f"{previous_hash}{file_hash}{meta_hash}{nonce}".encode('utf-8')
    return _sha256_hex(combined)


def create_genesis_hash(restaurant_id: int) -> str:
    """
    Creates the first hash in chain for a restaurant.

    Genesis Hash = SHA-256(restaurant_id + creation_timestamp + random_salt)
    """
    from django.conf import settings
    now = timezone.now().isoformat()
    salt = secrets.token_hex(32)
    data = f"{restaurant_id}{now}{salt}".encode('utf-8')
    return _sha256_hex(data)


def add_evidence_to_chain(
    restaurant_id: int,
    file_content: bytes,
    metadata: dict,
) -> dict:
    """
    Computes chain fields for new evidence. Does NOT create or save Evidence;
    caller must persist Evidence and update HashChain.

    Returns:
        {
            'hash_value': str,
            'previous_hash': str,
            'chain_index': int,
            'nonce': str,
            'file_content_hash': str,
        }
    """
    from core.models import HashChain, Evidence

    chain = HashChain.objects.filter(restaurant_id=restaurant_id).first()
    if chain is None:
        genesis = create_genesis_hash(restaurant_id)
        chain = HashChain.objects.create(
            restaurant_id=restaurant_id,
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


def verify_hash_chain(restaurant_id: int) -> dict:
    """
    Verifies entire evidence chain for a restaurant.
    Updates HashChain.last_verified and is_valid.

    Returns:
        {
            'is_valid': bool,
            'chain_length': int,
            'broken_at_index': int | None,
            'invalid_evidence_ids': list[int],
            'verification_time_ms': float,
        }
    """
    from core.models import Evidence, HashChain

    start = time.perf_counter()
    evidence_list = (
        Evidence.objects.filter(restaurant_id=restaurant_id)
        .exclude(chain_index__isnull=True)
        .order_by('chain_index')
    )
    chain = HashChain.objects.filter(restaurant_id=restaurant_id).first()

    invalid_evidence_ids = []
    broken_at_index = None
    expected_previous = None

    if chain:
        expected_previous = chain.genesis_hash

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

        # Recompute hash for this evidence (we need file content — from URL we cannot;
        # so we only check linkage and stored hash consistency with previous)
        # For full verification we need file content; without it we only verify
        # previous_hash chain and chain_index order.
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


def update_chain_after_append(restaurant_id: int, new_hash: str) -> None:
    """Call after saving new Evidence; updates HashChain.current_hash and chain_length."""
    from core.models import HashChain

    chain = HashChain.objects.get(restaurant_id=restaurant_id)
    chain.current_hash = new_hash
    chain.chain_length += 1
    chain.save(update_fields=['current_hash', 'chain_length'])
