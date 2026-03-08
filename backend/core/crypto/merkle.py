"""
Phase 2: Merkle tree audit trail — efficient verification of evidence inclusion.
"""
import hashlib
from typing import Any

from django.db import transaction

from core.models import Evidence, MerkleTree, MerkleNode


def _sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()


def _hash_pair(left: str, right: str) -> str:
    return _sha256_hex(left + right)


def _compute_merkle_root_from_hashes(leaf_hashes: list[str]) -> str:
    """Compute Merkle root from list of leaf hashes (no DB)."""
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


def build_merkle_tree(restaurant_id: int) -> str:
    """
    Builds Merkle tree from all restaurant evidence (by chain_index order).
    Persists MerkleTree and MerkleNode rows. Returns root_hash.
    """
    evidence_list = (
        Evidence.objects.filter(restaurant_id=restaurant_id)
        .exclude(hash_value__isnull=True)
        .exclude(hash_value='')
        .order_by('chain_index')
    )
    leaves = list(evidence_list.values_list('id', 'hash_value'))
    if not leaves:
        return ''

    # Build in-memory levels: level[0] = leaves, level[-1] = root
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
            eid_right = level_evidence_ids[-1][i + 1] if i + 1 < len(level_evidence_ids[-1]) else None
            next_ids.append(eid_left)  # arbitrary for internal nodes
        level_hashes.append(next_level)
        level_evidence_ids.append(next_ids)

    root_hash = level_hashes[-1][0]
    tree_depth = len(level_hashes) - 1

    with transaction.atomic():
        tree = MerkleTree.objects.create(
            restaurant_id=restaurant_id,
            root_hash=root_hash,
            tree_depth=tree_depth,
            evidence_count=len(leaves),
            is_valid=True,
        )
        # Create nodes bottom-up: level 0 = leaves, then parents
        # Map (level, index) -> MerkleNode
        node_map = {}
        for lev_idx, hashes in enumerate(level_hashes):
            for pos, h in enumerate(hashes):
                evidence_id = None
                if lev_idx == 0 and pos < len(level_evidence_ids[0]):
                    evidence_id = level_evidence_ids[0][pos]
                node = MerkleNode.objects.create(
                    tree=tree,
                    node_hash=h,
                    level=lev_idx,
                    evidence_id=evidence_id,
                )
                node_map[(lev_idx, pos)] = node
        # Set left_child, right_child for internal nodes
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


def generate_merkle_proof(evidence_id: int) -> list[dict] | None:
    """
    Generates proof path for an evidence leaf.
    Returns list of {'hash': str, 'position': 'left'|'right'}, or None if not found.
    """
    try:
        evidence = Evidence.objects.get(pk=evidence_id)
    except Evidence.DoesNotExist:
        return None
    leaf = MerkleNode.objects.filter(tree__restaurant_id=evidence.restaurant_id, evidence_id=evidence_id).first()
    if not leaf:
        return None
    proof = []
    node = leaf
    while node:
        parent_left = MerkleNode.objects.filter(tree=node.tree, left_child=node).first()
        parent_right = MerkleNode.objects.filter(tree=node.tree, right_child=node).first()
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


def verify_merkle_proof(evidence_hash: str, proof_path: list[dict], root_hash: str) -> bool:
    """
    Verifies evidence is in tree: recompute root from leaf + proof; compare to root_hash.
    """
    current = evidence_hash
    for step in proof_path:
        h = step.get('hash', '')
        pos = step.get('position', 'left')
        if pos == 'left':
            current = _hash_pair(h, current)
        else:
            current = _hash_pair(current, h)
    return current == root_hash


def rebuild_and_verify_tree(restaurant_id: int) -> dict:
    """
    Rebuilds Merkle root from current evidence and checks if it matches latest stored tree.
    Updates latest tree's is_valid. Returns summary dict.
    """
    evidence_list = (
        Evidence.objects.filter(restaurant_id=restaurant_id)
        .exclude(hash_value__isnull=True)
        .exclude(hash_value='')
        .order_by('chain_index')
    )
    leaf_hashes = list(evidence_list.values_list('hash_value', flat=True))
    calculated_root = _compute_merkle_root_from_hashes(leaf_hashes)
    latest = MerkleTree.objects.filter(restaurant_id=restaurant_id).order_by('-created_at').first()
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
