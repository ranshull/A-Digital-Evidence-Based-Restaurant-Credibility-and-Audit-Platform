from django.urls import path
from ..views.crypto_views import (
    VerifyChainView,
    IntegrityCheckView,
    MerkleProofView,
    VerifyTimestampView,
)

urlpatterns = [
    path('verify-chain/<int:restaurant_id>/', VerifyChainView.as_view(), name='crypto_verify_chain'),
    path('integrity-check/<int:evidence_id>/', IntegrityCheckView.as_view(), name='crypto_integrity_check'),
    path('merkle-proof/<int:evidence_id>/', MerkleProofView.as_view(), name='crypto_merkle_proof'),
    path('verify-timestamp/<int:evidence_id>/', VerifyTimestampView.as_view(), name='crypto_verify_timestamp'),
]
