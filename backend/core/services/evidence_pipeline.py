import os
import time
from typing import Iterable, Dict, Any

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from ..models import (
    Evidence,
    EvidenceFileType,
    EvidenceStatus,
    EvidenceTimestamp,
    RubricCategory,
    Restaurant,
)
from ..utils.storage import upload_to_supabase
from ..crypto.hash_chain import add_evidence_to_chain, update_chain_after_append
from ..crypto.timestamps import create_timestamp_token
from ..crypto.merkle import build_merkle_tree
from ..crypto.tamper import run_initial_forensics


class HashChainError(Exception):
    """Raised when hash chain computation fails for an upload batch."""


class StorageError(Exception):
    """Raised when uploading to external storage fails."""


class IntegratedEvidenceSystem:
    """
    Unified evidence upload pipeline for owner evidence.

    Orchestrates:
    - RBAC-aware metadata (owner, restaurant, category, description)
    - File validation (type, size, count)
    - Hash chain append
    - Timestamp token creation
    - Merkle tree maintenance
    - Initial tamper / forensics baseline
    - Storage via Supabase (or configured backend)
    """

    # Same constraints as in EvidenceUploadView, kept here for centralization.
    EVIDENCE_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "mp4"}
    EVIDENCE_MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    EVIDENCE_MAX_FILES = 5

    EXT_TO_FILE_TYPE = {
        "jpg": EvidenceFileType.IMAGE,
        "jpeg": EvidenceFileType.IMAGE,
        "png": EvidenceFileType.IMAGE,
        "mp4": EvidenceFileType.VIDEO,
    }

    def upload_evidence_batch(
        self,
        *,
        owner,
        restaurant: Restaurant,
        category: RubricCategory,
        description: str,
        files: Iterable,
    ) -> Dict[str, Any]:
        """
        Perform a complete upload pipeline for one or more files.

        Returns dict:
            {
                "evidence_list": [Evidence, ...],
                "crypto": [ per-file crypto dicts ... ],
                "upload_time_ms": float,
            }

        Raises:
            ValueError      -> input/file validation errors (mapped to HTTP 400 by view)
            HashChainError  -> hash chain computation failed (mapped to HTTP 500)
            StorageError    -> storage/upload failed (mapped to HTTP 502)
        """
        files = list(files or [])
        if not files:
            raise ValueError("At least one file is required.")
        if len(files) > self.EVIDENCE_MAX_FILES:
            raise ValueError(f"Maximum {self.EVIDENCE_MAX_FILES} files per upload.")

        prefix = f"evidence/{restaurant.id}"
        created: list[Evidence] = []
        crypto_results: list[Dict[str, Any]] = []

        start = time.time()

        for f in files:
            ext = os.path.splitext(f.name)[1].lstrip(".").lower()
            if ext not in self.EVIDENCE_ALLOWED_EXTENSIONS:
                raise ValueError(f"Allowed types: JPEG, PNG, MP4. Got: {ext}")
            if f.size > self.EVIDENCE_MAX_FILE_SIZE:
                raise ValueError("File exceeds 50MB limit.")

            content = f.read()
            metadata = {
                "timestamp": timezone.now().isoformat(),
                "owner_id": getattr(owner, "id", None),
                "category": category.name,
                "filename": os.path.basename(f.name),
                "size_bytes": len(content),
            }

            try:
                hash_data = add_evidence_to_chain(restaurant.id, content, metadata)
            except Exception as exc:  # noqa: BLE001
                raise HashChainError("Hash chain computation failed.") from exc

            file_like = SimpleUploadedFile(
                f.name,
                content,
                content_type=getattr(f, "content_type", None),
            )
            try:
                public_url, mime_type = upload_to_supabase(file_like, prefix)
            except ValueError:
                # propagate detailed validation errors from storage layer
                raise
            except RuntimeError as exc:
                # wrap generic runtime upload failures
                message = str(exc) or "Upload to storage failed."
                raise StorageError(message) from exc

            file_type = self.EXT_TO_FILE_TYPE.get(ext, EvidenceFileType.IMAGE)
            evidence = Evidence.objects.create(
                restaurant=restaurant,
                uploaded_by=owner,
                category=category,
                file_url=public_url,
                file_type=file_type,
                original_filename=os.path.basename(f.name),
                file_size_bytes=len(content),
                mime_type=mime_type,
                description=description,
                status=EvidenceStatus.PENDING,
                hash_value=hash_data["hash_value"],
                previous_hash=hash_data["previous_hash"],
                chain_index=hash_data["chain_index"],
                nonce=hash_data["nonce"],
                file_content_hash=hash_data["file_content_hash"],
                is_chain_valid=True,
            )

            update_chain_after_append(restaurant.id, hash_data["hash_value"])
            token = create_timestamp_token(evidence.id, hash_data["hash_value"])
            EvidenceTimestamp.objects.create(
                evidence=evidence,
                timestamp_token=token,
                server_time=timezone.now(),
                hash_at_timestamp=hash_data["hash_value"],
                is_verified=True,
            )

            # Best-effort Merkle tree and forensics; failures here shouldn't break uploads.
            try:
                build_merkle_tree(restaurant.id)
            except Exception:  # noqa: BLE001
                pass
            try:
                run_initial_forensics(evidence.id)
            except Exception:  # noqa: BLE001
                pass

            created.append(evidence)
            crypto_results.append(
                {
                    "evidence_id": evidence.id,
                    "hash_value": hash_data["hash_value"],
                    "chain_index": hash_data["chain_index"],
                    "previous_hash": hash_data["previous_hash"],
                }
            )

        upload_time_ms = (time.time() - start) * 1000.0

        return {
            "evidence_list": created,
            "crypto": crypto_results,
            "upload_time_ms": upload_time_ms,
        }

