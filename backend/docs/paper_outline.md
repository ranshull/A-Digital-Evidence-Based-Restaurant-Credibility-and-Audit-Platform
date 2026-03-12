# FOODAS Research Paper Outline (Draft)

## 1. Introduction
- Motivation: unreliable online restaurant reviews; lack of verifiable evidence.
- Problem statement and research questions.
- Contributions of FOODAS (owner evidence chain, crypto verification, integration with admin workflow).

## 2. Background and Related Work
- Existing review platforms (Yelp, Google, etc.).
- Food safety/audit standards (FSSAI, HACCP, ISO 22000).
- Cryptographic primitives: hash chains, Merkle trees, HMAC-based timestamps.

## 3. System Design
- High-level architecture (frontend, DRF backend, Supabase storage, crypto layer).
- Owner evidence workflow: upload → crypto pipeline → admin review.
- Role-based access control model.

## 4. Cryptographic Layer
- Hash chain design for owner evidence.
- Tamper detection, timestamps, and Merkle tree design.
- Integration via `IntegratedEvidenceSystem` and `IntegratedAdminVerification`.

## 5. Implementation
- Tech stack (Django, React, Supabase).
- Core modules: `core/crypto/*`, `core/services/evidence_pipeline.py`, `core/services/admin_verification.py`.
- Notes on performance optimizations and error handling (Supabase upload, filename sanitization).

## 6. Evaluation
- Correctness tests (hash chain immutability, Merkle proof correctness, timestamp verification).
- Performance benchmarks (upload latency, hash-chain verification, basic pipeline benchmark command).
- Security evaluation (threat model, crypto checks during approval).

## 7. Discussion
- Interpretation of results and limitations (e.g., human factors, collusion, storage growth).
- Design trade-offs (security vs performance, automation vs human review).

## 8. Conclusion and Future Work
- Summary of contributions.
- Potential extensions (IoT integration, blockchain anchoring, more advanced image forensics).

