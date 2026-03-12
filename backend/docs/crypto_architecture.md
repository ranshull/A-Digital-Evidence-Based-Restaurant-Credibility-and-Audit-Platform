# FOODAS Phase 2: Cryptographic Verification Architecture

## Overview

Phase 2 adds a 4-layer cryptographic evidence verification system for owner evidence:

1. **Owner evidence** — restaurant’s self-submitted evidence (one chain per restaurant).

Each owner trail has:

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

- **Upload**: `IntegratedEvidenceSystem` (in `core/services/evidence_pipeline.py`) orchestrates:
  - validation of files and metadata,
  - `add_evidence_to_chain`,
  - saving the `Evidence` row with chain fields,
  - `update_chain_after_append`,
  - creating `EvidenceTimestamp`,
  - `build_merkle_tree`,
  - `run_initial_forensics`.
  It is invoked by `EvidenceUploadView`.
- **Admin approve**: `_run_crypto_verification` in `evidence_views.py` now delegates to `IntegratedAdminVerification` (in `core/services/admin_verification.py`), which runs integrity, chain, timestamp, and tamper checks before allowing approval. If any fail, evidence is set to FLAGGED and marked `is_cryptographically_verified = False`.

---

## API Endpoints

### Owner evidence

- `POST /api/crypto/verify-chain/<restaurant_id>/` — verify restaurant hash chain
- `GET /api/crypto/integrity-check/<evidence_id>/` — file + metadata integrity
- `GET /api/crypto/merkle-proof/<evidence_id>/` — Merkle proof and root
- `POST /api/crypto/verify-timestamp/<evidence_id>/` — timestamp and backdating check

All require authenticated admin/auditor/superadmin.

## Configuration

- `CRYPTO_TIMESTAMP_SECRET`: used for HMAC of timestamp tokens for owner evidence (defaults to `SECRET_KEY` in dev).

## Operations

- **Owner tamper scan**: `python manage.py run_tamper_scan [--status APPROVED] [--limit N]` (for cron).
- **Rebuild owner Merkle tree**: `build_merkle_tree(restaurant_id)` or `rebuild_and_verify_tree(restaurant_id)`.
