"""Publish staged audit visit scores into Score and recompute restaurant credibility."""
from django.db import transaction
from django.utils import timezone

from ..models import (
    AuditSubmissionStatus,
    AuditVisitScore,
    AuditWorkStatus,
    AuditorWorkItem,
    RubricCategory,
    Score,
)
from .scoring import recompute_restaurant_scores


def publish_audit_visit_to_restaurant_scores(work_item: AuditorWorkItem, published_by=None) -> None:
    """
    Copy AuditVisitScore rows into Score, apply N/A category deletions, recompute.
    Expects work_item.submission_status == SUBMITTED_TO_ADMIN and validation already passed.
    published_by: admin user who approved (stored for super admin logs / audit).
    """
    restaurant = work_item.restaurant
    with transaction.atomic():
        for cat_id in work_item.category_marked_na or []:
            Score.objects.filter(restaurant=restaurant, category_id=cat_id).delete()

        for avs in AuditVisitScore.objects.filter(work_item=work_item).select_related(
            'subcategory', 'category', 'scored_by'
        ):
            Score.objects.update_or_create(
                restaurant=restaurant,
                subcategory=avs.subcategory,
                defaults={
                    'category': avs.category,
                    'score': avs.score,
                    'notes': avs.notes,
                    'scored_by': avs.scored_by,
                    'is_category_applicable': avs.is_category_applicable,
                },
            )

        recompute_restaurant_scores(restaurant.id)

        now = timezone.now()
        work_item.submission_status = AuditSubmissionStatus.PUBLISHED
        work_item.published_at = now
        work_item.published_by_id = published_by.id if published_by is not None else None
        work_item.status = AuditWorkStatus.DONE
        work_item.completed_at = now
        work_item.save(
            update_fields=[
                'submission_status',
                'published_at',
                'published_by_id',
                'status',
                'completed_at',
            ]
        )


def audit_visit_ready_for_submit(work_item: AuditorWorkItem):
    """Return (True, '') if all active categories are covered (photos+scores or N/A)."""
    from ..models import AuditWorkCategoryPhoto

    active = RubricCategory.objects.filter(is_active=True).order_by('display_order', 'id')
    for cat in active:
        cid = cat.id
        if cid in (work_item.category_marked_na or []):
            continue
        saved = work_item.category_photos_saved or []
        if cid not in saved:
            return False, f'Category "{cat.name}" has not had evidence saved yet.'
        if not AuditWorkCategoryPhoto.objects.filter(work_item=work_item, category_id=cid).exists():
            return False, f'Add at least one photo for "{cat.name}" before submitting.'
        subs = cat.subcategories.all()
        for sub in subs:
            if not AuditVisitScore.objects.filter(work_item=work_item, subcategory=sub).exists():
                return False, f'Complete scoring for "{cat.name}" (missing subcategory).'
    return True, ''


def rollback_audit_publish(work_item: AuditorWorkItem) -> None:
    """
    Super admin: undo a published on-site audit. Removes Score rows for subcategories
    present in this visit's staging scores, recomputes credibility, and sets the work
    item back to SUBMITTED_TO_ADMIN so an admin can re-review. Does not restore scores
    that were deleted for N/A categories at publish time (those must be re-entered if needed).
    """
    restaurant = work_item.restaurant
    if work_item.submission_status != AuditSubmissionStatus.PUBLISHED:
        raise ValueError('This visit is not published.')

    staging_sub_ids = list(
        AuditVisitScore.objects.filter(work_item=work_item).values_list('subcategory_id', flat=True)
    )

    with transaction.atomic():
        if staging_sub_ids:
            Score.objects.filter(
                restaurant=restaurant,
                subcategory_id__in=staging_sub_ids,
            ).delete()
        work_item.submission_status = AuditSubmissionStatus.SUBMITTED_TO_ADMIN
        work_item.published_at = None
        work_item.published_by = None
        work_item.status = AuditWorkStatus.IN_PROGRESS
        work_item.completed_at = None
        work_item.save(
            update_fields=[
                'submission_status',
                'published_at',
                'published_by',
                'status',
                'completed_at',
            ]
        )

    recompute_restaurant_scores(restaurant.id)
