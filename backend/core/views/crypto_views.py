"""Phase 2: Crypto verification API endpoints (owner evidence + audit evidence)."""
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Audit, AuditEvidence, Evidence, Restaurant
from ..permissions import IsAdminOrAuditor
from ..crypto.hash_chain import verify_hash_chain
from ..crypto.tamper import verify_file_integrity, detect_metadata_tampering
from ..crypto.timestamps import verify_timestamp_token, detect_backdating_attempt
from ..crypto.merkle import generate_merkle_proof, verify_merkle_proof
from ..crypto.audit_chain import verify_audit_hash_chain
from ..crypto.audit_tamper import verify_audit_file_integrity
from ..crypto.audit_timestamps import (
    verify_audit_timestamp_token,
    detect_audit_backdating_attempt,
)
from ..crypto.audit_merkle import generate_audit_merkle_proof


class VerifyChainView(APIView):
    """POST /api/crypto/verify-chain/<restaurant_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, restaurant_id):
        get_object_or_404(Restaurant, pk=restaurant_id)
        result = verify_hash_chain(restaurant_id)
        return Response(result, status=status.HTTP_200_OK)


class IntegrityCheckView(APIView):
    """GET /api/crypto/integrity-check/<evidence_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get(self, request, evidence_id):
        evidence = get_object_or_404(Evidence, pk=evidence_id)
        integrity = verify_file_integrity(evidence_id)
        metadata = detect_metadata_tampering(evidence_id)
        return Response({
            **integrity,
            'metadata_check': metadata,
        }, status=status.HTTP_200_OK)


class MerkleProofView(APIView):
    """GET /api/crypto/merkle-proof/<evidence_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get(self, request, evidence_id):
        evidence = get_object_or_404(Evidence, pk=evidence_id)
        proof = generate_merkle_proof(evidence_id)
        if proof is None:
            return Response(
                {'detail': 'No Merkle proof available for this evidence.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        from ..models import MerkleTree
        tree = MerkleTree.objects.filter(restaurant_id=evidence.restaurant_id).order_by('-created_at').first()
        root_hash = tree.root_hash if tree else None
        return Response({
            'evidence_id': evidence_id,
            'proof': proof,
            'root_hash': root_hash,
            'evidence_hash': evidence.hash_value,
        }, status=status.HTTP_200_OK)


class VerifyTimestampView(APIView):
    """POST /api/crypto/verify-timestamp/<evidence_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, evidence_id):
        get_object_or_404(Evidence, pk=evidence_id)
        result = verify_timestamp_token(evidence_id)
        backdate = detect_backdating_attempt(evidence_id)
        return Response({
            **result,
            'backdating': backdate,
        }, status=status.HTTP_200_OK)


def _can_access_audit(request, audit_id: int) -> bool:
    """Allow if audit is assigned to request.user or request.user is Super Admin."""
    if request.user.role == 'SUPER_ADMIN':
        return True
    audit = Audit.objects.filter(pk=audit_id).first()
    return audit is not None and audit.assigned_to_id == request.user.id


class VerifyAuditChainView(APIView):
    """POST /api/crypto/verify-audit-chain/<audit_id>/ — verify audit evidence hash chain."""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, audit_id):
        audit = get_object_or_404(Audit, pk=audit_id)
        if not _can_access_audit(request, audit_id):
            return Response({'detail': 'Not allowed to access this audit.'}, status=status.HTTP_403_FORBIDDEN)
        result = verify_audit_hash_chain(audit_id)
        return Response(result, status=status.HTTP_200_OK)


class AuditIntegrityCheckView(APIView):
    """GET /api/crypto/audit-integrity-check/<audit_evidence_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get(self, request, audit_evidence_id):
        evidence = get_object_or_404(AuditEvidence.objects.select_related('audit'), pk=audit_evidence_id)
        if not _can_access_audit(request, evidence.audit_id):
            return Response({'detail': 'Not allowed to access this audit.'}, status=status.HTTP_403_FORBIDDEN)
        integrity = verify_audit_file_integrity(audit_evidence_id)
        return Response(integrity, status=status.HTTP_200_OK)


class AuditMerkleProofView(APIView):
    """GET /api/crypto/audit-merkle-proof/<audit_evidence_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def get(self, request, audit_evidence_id):
        evidence = get_object_or_404(AuditEvidence.objects.select_related('audit'), pk=audit_evidence_id)
        if not _can_access_audit(request, evidence.audit_id):
            return Response({'detail': 'Not allowed to access this audit.'}, status=status.HTTP_403_FORBIDDEN)
        proof = generate_audit_merkle_proof(audit_evidence_id)
        if proof is None:
            return Response(
                {'detail': 'No Merkle proof available for this audit evidence.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        from ..models import AuditMerkleTree
        tree = AuditMerkleTree.objects.filter(audit_id=evidence.audit_id).order_by('-created_at').first()
        root_hash = tree.root_hash if tree else None
        return Response({
            'audit_evidence_id': audit_evidence_id,
            'proof': proof,
            'root_hash': root_hash,
            'evidence_hash': evidence.hash_value,
        }, status=status.HTTP_200_OK)


class VerifyAuditTimestampView(APIView):
    """POST /api/crypto/verify-audit-timestamp/<audit_evidence_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrAuditor]

    def post(self, request, audit_evidence_id):
        evidence = get_object_or_404(AuditEvidence.objects.select_related('audit'), pk=audit_evidence_id)
        if not _can_access_audit(request, evidence.audit_id):
            return Response({'detail': 'Not allowed to access this audit.'}, status=status.HTTP_403_FORBIDDEN)
        result = verify_audit_timestamp_token(audit_evidence_id)
        backdate = detect_audit_backdating_attempt(audit_evidence_id)
        return Response({
            **result,
            'backdating': backdate,
        }, status=status.HTTP_200_OK)
