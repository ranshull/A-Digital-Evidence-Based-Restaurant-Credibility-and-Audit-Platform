"""Admin evidence review completion checks."""
from typing import Optional, Tuple

from ..models import (
    Evidence,
    EvidenceStatus,
    Restaurant,
    RubricCategory,
    Score,
)


def validate_restaurant_review_complete(restaurant: Restaurant) -> Tuple[bool, Optional[str]]:
    """
    Restaurant is ready to finalize when:
    - No PENDING evidence remains.
    - For each active RubricCategory, if there is at least one APPROVED evidence
      in that category, every subcategory must have a Score row.
    """
    if Evidence.objects.filter(restaurant=restaurant, status=EvidenceStatus.PENDING).exists():
        return False, 'Pending evidence remains. Approve, reject, or flag every item first.'

    active_cats = (
        RubricCategory.objects.filter(is_active=True)
        .exclude(name__iexact='Benchmark Category')
        .prefetch_related('subcategories')
    )
    for cat in active_cats:
        has_approved = Evidence.objects.filter(
            restaurant=restaurant,
            category=cat,
            status=EvidenceStatus.APPROVED,
        ).exists()
        if not has_approved:
            continue
        sub_ids = list(cat.subcategories.values_list('id', flat=True))
        if not sub_ids:
            continue
        scored = set(
            Score.objects.filter(
                restaurant=restaurant,
                subcategory_id__in=sub_ids,
            ).values_list('subcategory_id', flat=True)
        )
        if len(scored) < len(sub_ids):
            return False, (
                f'Category "{cat.name}" has approved evidence but scoring is incomplete '
                f'for all subcategories.'
            )
    return True, None


def evidence_counts_for_restaurant(restaurant: Restaurant) -> dict:
    qs = Evidence.objects.filter(restaurant=restaurant)
    return {
        'total': qs.count(),
        'pending': qs.filter(status=EvidenceStatus.PENDING).count(),
        'approved': qs.filter(status=EvidenceStatus.APPROVED).count(),
        'rejected': qs.filter(status=EvidenceStatus.REJECTED).count(),
        'flagged': qs.filter(status=EvidenceStatus.FLAGGED).count(),
    }
