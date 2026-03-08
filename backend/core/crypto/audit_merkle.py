"""
Merkle tree for audit evidence (separate chain, one tree per audit).
"""
import hashlib
from django.db import transaction

from core.models import AuditEvidence, AuditMerkleTree, AuditMerkleNode


def _sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()


def _hash_pair(left: str, right: str) -> str:
    return _sha256_hex(left + right)


def _compute_merkle_root_from_hashes(leaf_hashes: list[str]) -> str:
    if not leaf_hashes:
        return ''
    current = list(leaf_hashes)
    while len(current) > 1:
        next_level = []
        for i in range(0, len(current), 2):
            left = current[i]
            right = current[i + 1] if i + 1 < len(current) else current[i]
            next_level.append(_hash_pair(left, right))
        current = next_level
    return current[0]


def build_audit_merkle_tree(audit_id: int) -> str:
    """
    Builds Merkle tree from all audit evidence (by chain_index order).
    Persists AuditMerkleTree and AuditMerkleNode. Returns root_hash.
    """
    evidence_list = (
        AuditEvidence.objects.filter(audit_id=audit_id)
        .exclude(hash_value__isnull=True)
        .exclude(hash_value='')
        .order_by('chain_index')
    )
    leaves = list(evidence_list.values_list('id', 'hash_value'))
    if not leaves:
        return ''

    level_hashes = [[h for _, h in leaves]]
    level_evidence_ids = [[eid for eid, _ in leaves]]

    while len(level_hashes[-1]) > 1:
        current = level_hashes[-1]
        next_level = []
        next_ids = []
        for i in range(0, len(current), 2):
            left = current[i]
            right = current[i + 1] if i + 1 < len(current) else current[i]
            next_level.append(_hash_pair(left, right))
            eid_left = level_evidence_ids[-1][i] if i < len(level_evidence_ids[-1]) else None
            next_ids.append(eid_left)
        level_hashes.append(next_level)
        level_evidence_ids.append(next_ids)

    root_hash = level_hashes[-1][0]
    tree_depth = len(level_hashes) - 1

    with transaction.atomic():
        tree = AuditMerkleTree.objects.create(
            audit_id=audit_id,
            root_hash=root_hash,
            tree_depth=tree_depth,
            evidence_count=len(leaves),
            is_valid=True,
        )
        node_map = {}
        for lev_idx, hashes in enumerate(level_hashes):
            for pos, h in enumerate(hashes):
                audit_evidence_id = None
                if lev_idx == 0 and pos < len(level_evidence_ids[0]):
                    audit_evidence_id = level_evidence_ids[0][pos]
                node = AuditMerkleNode.objects.create(
                    tree=tree,
                    node_hash=h,
                    level=lev_idx,
                    audit_evidence_id=audit_evidence_id,
                )
                node_map[(lev_idx, pos)] = node
        for lev in range(1, len(level_hashes)):
            for pos in range(len(level_hashes[lev])):
                parent = node_map[(lev, pos)]
                left_pos = 2 * pos
                right_pos = 2 * pos + 1
                if left_pos < len(level_hashes[lev - 1]):
                    parent.left_child = node_map[(lev - 1, left_pos)]
                if right_pos < len(level_hashes[lev - 1]):
                    parent.right_child = node_map[(lev - 1, right_pos)]
                parent.save()

    return root_hash


def generate_audit_merkle_proof(audit_evidence_id: int) -> list[dict] | None:
    """
    Generates proof path for an audit evidence leaf.
    Returns list of {'hash': str, 'position': 'left'|'right'}, or None.
    """
    try:
        evidence = AuditEvidence.objects.get(pk=audit_evidence_id)
    except AuditEvidence.DoesNotExist:
        return None
    leaf = AuditMerkleNode.objects.filter(
        tree__audit_id=evidence.audit_id,
        audit_evidence_id=audit_evidence_id,
    ).first()
    if not leaf:
        return None
    proof = []
    node = leaf
    while node:
        parent_left = AuditMerkleNode.objects.filter(tree=node.tree, left_child=node).first()
        parent_right = AuditMerkleNode.objects.filter(tree=node.tree, right_child=node).first()
        parent = parent_left or parent_right
        if not parent:
            break
        sibling = parent.right_child if parent.left_child_id == node.id else parent.left_child
        if sibling:
            proof.append({
                'hash': sibling.node_hash,
                'position': 'right' if parent.left_child_id == node.id else 'left',
            })
        node = parent
    return proof


def verify_audit_merkle_proof(evidence_hash: str, proof_path: list[dict], root_hash: str) -> bool:
    """Verifies audit evidence is in tree."""
    current = evidence_hash
    for step in proof_path:
        h = step.get('hash', '')
        pos = step.get('position', 'left')
        if pos == 'left':
            current = _hash_pair(h, current)
        else:
            current = _hash_pair(current, h)
    return current == root_hash


def rebuild_and_verify_audit_tree(audit_id: int) -> dict:
    """Rebuilds audit Merkle root and checks against latest stored tree."""
    evidence_list = (
        AuditEvidence.objects.filter(audit_id=audit_id)
        .exclude(hash_value__isnull=True)
        .exclude(hash_value='')
        .order_by('chain_index')
    )
    leaf_hashes = list(evidence_list.values_list('hash_value', flat=True))
    calculated_root = _compute_merkle_root_from_hashes(leaf_hashes)
    latest = AuditMerkleTree.objects.filter(audit_id=audit_id).order_by('-created_at').first()
    stored_root = latest.root_hash if latest else ''
    is_valid = (calculated_root == stored_root) if stored_root else True
    evidence_count = len(leaf_hashes)
    if latest:
        latest.is_valid = is_valid
        latest.save(update_fields=['is_valid'])
    return {
        'is_valid': is_valid,
        'stored_root': stored_root,
        'calculated_root': calculated_root,
        'evidence_verified': evidence_count if is_valid else 0,
        'evidence_invalid': 0 if is_valid else evidence_count,
    }
