from typing import Dict, Any, Tuple, List

from django.utils import timezone

from ..models import Evidence, EvidenceStatus
from ..crypto.hash_chain import verify_hash_chain
from ..crypto.timestamps import verify_timestamp_token, detect_backdating_attempt
from ..crypto.tamper import verify_file_integrity, detect_metadata_tampering


class IntegratedAdminVerification:
    """
    Combine human admin/auditor review with automated cryptographic checks
    for a single owner evidence item.
    """

    def run_crypto_checks(self, evidence: Evidence) -> Dict[str, Any]:
        """Run all Phase 2 crypto checks for an evidence row."""
        integrity = verify_file_integrity(evidence.id)
        chain = verify_hash_chain(evidence.restaurant_id)
        ts_result = verify_timestamp_token(evidence.id)
        backdate = detect_backdating_attempt(evidence.id)
        meta = detect_metadata_tampering(evidence.id)

        return {
            "hash_chain_valid": chain.get("is_valid", True),
            "integrity_intact": integrity.get("is_intact", True),
            "timestamp_valid": ts_result.get("signature_valid", True),
            "backdating_suspicious": backdate.get("suspicious", False),
            "metadata_suspicious": meta.get("suspicious", False),
            "raw": {
                "integrity": integrity,
                "chain": chain,
                "timestamp": ts_result,
                "backdating": backdate,
                "metadata": meta,
            },
        }

    def _evaluate_crypto_decision(self, crypto: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Decide if crypto layer is clean enough to allow approval."""
        issues: List[str] = []
        if not crypto["hash_chain_valid"]:
            issues.append("hash_chain_invalid")
        if not crypto["integrity_intact"]:
            issues.append("file_integrity_failed")
        if not crypto["timestamp_valid"]:
            issues.append("timestamp_invalid")
        if crypto["backdating_suspicious"]:
            issues.append("backdating_suspicious")
        if crypto["metadata_suspicious"]:
            issues.append("metadata_tampering")
        return (len(issues) == 0, issues)

    def decide(
        self,
        *,
        evidence: Evidence,
        reviewer,
        quality_score: int,
        category_match: bool,
        notes: str,
    ) -> Dict[str, Any]:
        """
        Build a combined human + crypto decision for an evidence item.

        Returns a structure suitable for audit logs, APIs, or UI:
            {
              "can_approve": bool,
              "human_review": {...},
              "crypto_verification": {...},
              "recommendation": str,
              "issues": [str, ...],
            }
        """
        human_review = {
            "reviewer_id": getattr(reviewer, "id", None),
            "quality_score": int(quality_score),
            "category_match": bool(category_match),
            "notes": notes or "",
            "reviewed_at": timezone.now(),
        }

        crypto = self.run_crypto_checks(evidence)
        crypto_ok, crypto_issues = self._evaluate_crypto_decision(crypto)

        can_approve = (
            human_review["quality_score"] >= 3
            and human_review["category_match"]
            and crypto_ok
        )

        issues: List[str] = []
        if human_review["quality_score"] < 3:
            issues.append("low_quality_score")
        if not human_review["category_match"]:
            issues.append("category_mismatch")
        issues.extend(crypto_issues)

        if can_approve:
            recommendation = "approve"
        elif "file_integrity_failed" in issues or "hash_chain_invalid" in issues:
            recommendation = "reject_or_investigate"
        else:
            recommendation = "flag_for_secondary_review"

        return {
            "can_approve": can_approve,
            "human_review": human_review,
            "crypto_verification": crypto,
            "recommendation": recommendation,
            "issues": issues,
        }

