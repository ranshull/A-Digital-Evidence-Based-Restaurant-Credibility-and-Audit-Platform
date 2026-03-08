from django.urls import path
from ..views.crypto_views import (
    VerifyChainView,
    IntegrityCheckView,
    MerkleProofView,
    VerifyTimestampView,
    VerifyAuditChainView,
    AuditIntegrityCheckView,
    AuditMerkleProofView,
    VerifyAuditTimestampView,
)

urlpatterns = [
    path('verify-chain/<int:restaurant_id>/', VerifyChainView.as_view(), name='crypto_verify_chain'),
    path('integrity-check/<int:evidence_id>/', IntegrityCheckView.as_view(), name='crypto_integrity_check'),
    path('merkle-proof/<int:evidence_id>/', MerkleProofView.as_view(), name='crypto_merkle_proof'),
    path('verify-timestamp/<int:evidence_id>/', VerifyTimestampView.as_view(), name='crypto_verify_timestamp'),
    # Separate audit chain
    path('verify-audit-chain/<int:audit_id>/', VerifyAuditChainView.as_view(), name='crypto_verify_audit_chain'),
    path('audit-integrity-check/<int:audit_evidence_id>/', AuditIntegrityCheckView.as_view(), name='crypto_audit_integrity_check'),
    path('audit-merkle-proof/<int:audit_evidence_id>/', AuditMerkleProofView.as_view(), name='crypto_audit_merkle_proof'),
    path('verify-audit-timestamp/<int:audit_evidence_id>/', VerifyAuditTimestampView.as_view(), name='crypto_verify_audit_timestamp'),
]
