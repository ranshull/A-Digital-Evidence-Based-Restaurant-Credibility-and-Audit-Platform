"""Save staged scores for an on-site audit work item (not published until admin approves)."""
from django.db import transaction
from rest_framework import status
from rest_framework.response import Response

from ..models import AuditVisitScore, RubricCategory, RubricSubCategory


def save_audit_staging_category_scores(request, work, category_id, is_applicable, subcategories_data):
    """
    Validate and write AuditVisitScore rows for one category on a work item.
    Returns Response on error, or None on success.
    """
    category = RubricCategory.objects.filter(pk=category_id, is_active=True).first()
    if not category:
        return Response({'detail': 'Invalid or inactive category.'}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        if not is_applicable:
            AuditVisitScore.objects.filter(work_item=work, category=category).delete()
            na_list = list(work.category_marked_na or [])
            if category_id not in na_list:
                na_list.append(category_id)
            work.category_marked_na = na_list
            photos_saved = list(work.category_photos_saved or [])
            if category_id in photos_saved:
                photos_saved.remove(category_id)
            work.category_photos_saved = photos_saved
            work.save(update_fields=['category_marked_na', 'category_photos_saved'])
            return None

        na_list = list(work.category_marked_na or [])
        if category_id in na_list:
            na_list.remove(category_id)
        work.category_marked_na = na_list

        subcategory_ids = {s['subcategory_id'] for s in subcategories_data}
        subcats = {
            s.id: s
            for s in RubricSubCategory.objects.filter(category=category, id__in=subcategory_ids)
        }
        for item in subcategories_data:
            sid = item['subcategory_id']
            if sid not in subcats:
                return Response(
                    {'detail': f'Invalid subcategory_id: {sid}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            sub = subcats[sid]
            if not (0 <= item['score'] <= sub.max_score):
                return Response(
                    {'detail': f'Score for {sub.name} must be 0-{sub.max_score}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if item['score'] in (0, 1) and not (item.get('notes') or '').strip():
                return Response(
                    {'detail': f'Notes required when score is 0 or 1 for {sub.name}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        AuditVisitScore.objects.filter(work_item=work, category=category).delete()
        for item in subcategories_data:
            sub = subcats[item['subcategory_id']]
            AuditVisitScore.objects.create(
                work_item=work,
                category=category,
                subcategory=sub,
                score=item['score'],
                notes=(item.get('notes') or '').strip(),
                scored_by=request.user,
                is_category_applicable=True,
            )
        work.save(update_fields=['category_marked_na'])

    return None


def serialize_staging_scores(work):
    out = []
    for avs in AuditVisitScore.objects.filter(work_item=work).select_related(
        'category', 'subcategory', 'scored_by'
    ).order_by('category_id', 'subcategory_id'):
        out.append(
            {
                'category_id': avs.category_id,
                'category_name': avs.category.name,
                'subcategory_id': avs.subcategory_id,
                'subcategory_name': avs.subcategory.name,
                'score': avs.score,
                'notes': avs.notes,
                'is_category_applicable': avs.is_category_applicable,
                'scored_by_name': avs.scored_by.name,
                'scored_at': avs.scored_at,
            }
        )
    return out
