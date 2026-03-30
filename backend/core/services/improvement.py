"""
Generate improvement suggestions for restaurant owners based on scores and evidence.
"""
from ..models import Restaurant, Evidence, RubricCategory, EvidenceStatus


def get_improvement_suggestions(restaurant):
    """
    Return a list of suggestion strings for the owner dashboard.
    - Categories with no evidence: suggest uploading evidence.
    - Categories with low scores (<70): suggest improvement.
    - Pending review count reminder.
    """
    suggestions = []
    breakdown = restaurant.score_breakdown or []
    evidence_by_category = {}
    for e in Evidence.objects.filter(restaurant=restaurant).values('category_id', 'status'):
        cid = e['category_id']
        if cid not in evidence_by_category:
            evidence_by_category[cid] = {'pending': 0, 'approved': 0}
        if e['status'] == EvidenceStatus.PENDING:
            evidence_by_category[cid]['pending'] += 1
        elif e['status'] == EvidenceStatus.APPROVED:
            evidence_by_category[cid]['approved'] += 1

    categories = RubricCategory.objects.filter(is_active=True).exclude(
        name__iexact='Benchmark Category'
    )
    for cat in categories:
        cat_evidence = evidence_by_category.get(cat.id, {'pending': 0, 'approved': 0})
        cat_info = next((b for b in breakdown if b.get('name') == cat.name), None)
        score = cat_info.get('score') if cat_info else None
        is_applicable = cat_info.get('is_applicable', True) if cat_info else True

        if not is_applicable:
            continue
        if cat_evidence['approved'] == 0 and cat_evidence['pending'] == 0:
            suggestions.append(f'No evidence uploaded for: {cat.name}. Upload evidence to get scored.')
        elif cat_evidence['approved'] == 0 and cat_evidence['pending'] > 0:
            suggestions.append(f'Evidence for "{cat.name}" is pending admin review.')
        elif score is not None and score < 70:
            suggestions.append(f'Improve "{cat.name}" score (current: {score:.0f}/100). Consider uploading more or better evidence.')

    pending_total = Evidence.objects.filter(restaurant=restaurant, status=EvidenceStatus.PENDING).count()
    if pending_total > 0:
        suggestions.append(f'{pending_total} evidence item(s) pending admin review.')

    return suggestions