# FOODAS Defense Slide Outline (Draft)

1. **Title**
   - Project name, your name, institution, date.

2. **Problem & Motivation**
   - Issues with current restaurant review systems.
   - Why evidence-based, cryptographically verified credibility matters.

3. **System Overview**
   - Diagram: frontend, backend (DRF), Supabase, crypto layer.
   - Data flow: owner upload → crypto pipeline → admin review.

4. **Cryptographic Design**
   - Hash chain for owner evidence.
   - Merkle tree for efficient verification.
   - Timestamp tokens and tamper detection.

5. **Implementation**
   - Key components (views, services, crypto modules).
   - Brief look at `IntegratedEvidenceSystem` and `IntegratedAdminVerification`.

6. **Correctness & Security**
   - Summary of unit/property tests for crypto.
   - How admin approval uses crypto verification.
   - Threat model highlights.

7. **Performance**
   - Benchmark snapshots (upload pipeline metrics from `benchmark_evidence_pipeline`).
   - Discussion of scalability expectations.

8. **Limitations & Future Work**
   - Human factors, collusion, richer forensics, scaling storage.

9. **Conclusion**
   - Key takeaways and potential impact.

10. **Q&A**
   - Invite questions from the committee.

