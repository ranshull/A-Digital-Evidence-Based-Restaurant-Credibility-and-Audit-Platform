# FOODAS Phase 2: Cryptographic Verification Architecture

## Overview

Phase 2 adds a 4-layer cryptographic evidence verification system for **two separate trails**:

1. **Owner evidence** — restaurant’s self-submitted evidence (one chain per restaurant).
2. **Audit evidence** — evidence uploaded by auditors during an on-site audit (one chain per audit).

Each trail has:

1. **Hash chain** — evidence linked in order; any change breaks the chain
2. **Tamper detection** — file integrity (and, for owner evidence, metadata and image forensics)
3. **Timestamp verification** — signed tokens to prevent backdating
4. **Merkle tree** — O(log n) proof that evidence is in the trail

## Owner Evidence (restaurant chain)

### Layer 1: Hash Chain

- Model: `Evidence`; chain state: `HashChain` (one per restaurant).
- Each record has: `hash_value`, `previous_hash`, `chain_index`, `nonce`, `file_content_hash`.
- **Genesis**: SHA-256(restaurant_id + timestamp + salt).
- **Evidence hash**: SHA-256(previous_hash + file_content_hash + metadata_hash + nonce).
- **Verification**: `verify_hash_chain(restaurant_id)`.

### Layer 2–4 (owner)

- **Tamper**: `TamperDetection` (evidence_id); `verify_file_integrity`, `detect_metadata_tampering`, image forensics.
- **Timestamp**: `EvidenceTimestamp`; `create_timestamp_token`, `verify_timestamp_token`, `detect_backdating_attempt`.
- **Merkle**: one `MerkleTree` per restaurant; `MerkleNode` with `evidence_id`; `build_merkle_tree(restaurant_id)`, `generate_merkle_proof(evidence_id)`.

### Integration (owner)

- **Upload**: `EvidenceUploadView` — multipart → `add_evidence_to_chain` → save Evidence → `update_chain_after_append` → `EvidenceTimestamp` → `build_merkle_tree` → `run_initial_forensics`.
- **Admin approve**: run integrity, chain, timestamp, tamper checks; if any fail, set FLAGGED.

---

## Audit Evidence (separate audit chain)

### Layer 1: Audit Hash Chain

- Model: `AuditEvidence`; chain state: `AuditHashChain` (one per audit).
- Same hash formula; genesis = SHA-256(audit_id + timestamp + salt).
- **Verification**: `verify_audit_hash_chain(audit_id)`.

### Layer 2–4 (audit)

- **Tamper**: `AuditTamperDetection` (audit_evidence_id); `verify_audit_file_integrity`, `run_initial_forensics_audit`.
- **Timestamp**: `AuditEvidenceTimestamp`; `create_audit_timestamp_token`, `verify_audit_timestamp_token`, `detect_audit_backdating_attempt`.
- **Merkle**: one `AuditMerkleTree` per audit; `AuditMerkleNode` with `audit_evidence_id`; `build_audit_merkle_tree(audit_id)`, `generate_audit_merkle_proof(audit_evidence_id)`.

### Integration (audit)

- **Upload**: `AuditorEvidenceUploadView` — multipart (category_id, description, files) → upload to storage → `add_audit_evidence_to_chain` → save AuditEvidence with chain fields → `update_audit_chain_after_append` → `AuditEvidenceTimestamp` → `build_audit_merkle_tree` → `run_initial_forensics_audit`.
- Audit chain is independent of the restaurant (owner) chain.

---

## API Endpoints

### Owner evidence

- `POST /api/crypto/verify-chain/<restaurant_id>/` — verify restaurant hash chain
- `GET /api/crypto/integrity-check/<evidence_id>/` — file + metadata integrity
- `GET /api/crypto/merkle-proof/<evidence_id>/` — Merkle proof and root
- `POST /api/crypto/verify-timestamp/<evidence_id>/` — timestamp and backdating check

### Audit evidence

- `POST /api/crypto/verify-audit-chain/<audit_id>/` — verify audit hash chain
- `GET /api/crypto/audit-integrity-check/<audit_evidence_id>/` — file integrity
- `GET /api/crypto/audit-merkle-proof/<audit_evidence_id>/` — Merkle proof and root
- `POST /api/crypto/verify-audit-timestamp/<audit_evidence_id>/` — timestamp and backdating check

All require authenticated admin/auditor/superadmin. Audit endpoints enforce that the audit is assigned to the current user (or user is Super Admin).

## Configuration

- `CRYPTO_TIMESTAMP_SECRET`: used for HMAC of timestamp tokens for both owner and audit evidence (defaults to `SECRET_KEY` in dev).

## Operations

- **Owner tamper scan**: `python manage.py run_tamper_scan [--status APPROVED] [--limit N]` (for cron).
- **Rebuild owner Merkle tree**: `build_merkle_tree(restaurant_id)` or `rebuild_and_verify_tree(restaurant_id)`.
- **Rebuild audit Merkle tree**: `build_audit_merkle_tree(audit_id)` or `rebuild_and_verify_audit_tree(audit_id)`.
