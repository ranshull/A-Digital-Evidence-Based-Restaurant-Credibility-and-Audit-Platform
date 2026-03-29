"""Phase 2: Crypto verification API endpoints (owner evidence only)."""
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Evidence, Restaurant
from ..permissions import IsAdminOrSuperAdmin
from ..crypto.hash_chain import verify_hash_chain
from ..crypto.tamper import verify_file_integrity, detect_metadata_tampering
from ..crypto.timestamps import verify_timestamp_token, detect_backdating_attempt
from ..crypto.merkle import generate_merkle_proof, verify_merkle_proof


class VerifyChainView(APIView):
    """POST /api/crypto/verify-chain/<restaurant_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, restaurant_id):
        get_object_or_404(Restaurant, pk=restaurant_id)
        result = verify_hash_chain(restaurant_id)
        return Response(result, status=status.HTTP_200_OK)


class IntegrityCheckView(APIView):
    """GET /api/crypto/integrity-check/<evidence_id>/"""
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

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
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

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
    permission_classes = [IsAuthenticated, IsAdminOrSuperAdmin]

    def post(self, request, evidence_id):
        get_object_or_404(Evidence, pk=evidence_id)
        result = verify_timestamp_token(evidence_id)
        backdate = detect_backdating_attempt(evidence_id)
        return Response({
            **result,
            'backdating': backdate,
        }, status=status.HTTP_200_OK)
