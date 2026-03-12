# FOODAS Threat Model (Owner Evidence Only)

## Threat Actors

1. **Malicious Restaurant Owner**
   - Motivation: Inflate credibility score or hide safety issues.
   - Capabilities: Upload images/videos and text, attempt repeated uploads.

2. **Competitor / Saboteur**
   - Motivation: Damage a rival restaurant’s reputation.
   - Capabilities: Limited – can only see public information and attempt indirect attacks.

3. **Compromised Admin / Auditor**
   - Motivation: Accept bribes, manipulate scores or evidence decisions.
   - Capabilities: Approve/reject/flag evidence, submit scores.

4. **External Attacker**
   - Motivation: Breach data, disrupt service.
   - Capabilities: Network access to API endpoints, generic web attack tooling.

## Assets

- Evidence files (images/videos).
- Evidence crypto metadata: `hash_value`, `previous_hash`, `chain_index`, `nonce`, `file_content_hash`.
- Timestamp tokens and Merkle roots.
- Scores, credibility summaries, and review notes.
- User identities and roles.

## Key Attack Scenarios and Mitigations

| Threat | Attack | Mitigation | Code/Component |
|--------|--------|------------|----------------|
| Owner replaces file after approval | Swap physical file or DB URL | Hash chain + integrity checks detect mismatches | `hash_chain.verify_hash_chain`, `verify_file_integrity` |
| Owner backdates evidence | Change timestamp token or DB fields | HMAC-signed timestamp tokens; verification fails | `create_timestamp_token`, `verify_timestamp_token`, `detect_backdating_attempt` |
| Owner uploads stock/fake images | Non-genuine evidence | Initial forensics + metadata checks flag anomalies | `run_initial_forensics`, `detect_metadata_tampering` |
| Admin silently approves bad evidence | Human misconduct | Crypto checks still enforce integrity; logs can be extended for audits | `IntegratedAdminVerification`, `EvidenceApproveView` |
| External SQL injection | Tamper DB via crafted inputs | DRF serializers and ORM queries; no raw SQL | all DRF views/serializers |
| Privilege escalation | USER calls admin endpoints | `IsAdminOrAuditor` / `IsOwnerWithRestaurant` permissions | `permissions.py`, DRF views |

## Security Properties

- **Integrity**: Any file or metadata change is detectable through the hash chain and integrity checks.
- **Non-repudiation**: Timestamp tokens bind evidence to upload time and uploader.
- **Auditability**: Evidence status transitions and crypto verification can be logged and inspected.
- **Access Control**: RBAC ensures only appropriate roles can upload, review, or score evidence.
