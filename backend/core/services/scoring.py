"""
Compute per-category and overall credibility scores with N/A weight redistribution.
Updates Restaurant.credibility_score, last_audit_at, score_breakdown.
"""
from decimal import Decimal
from django.utils import timezone

from ..models import Restaurant, Score, RubricCategory, RubricSubCategory


def recompute_restaurant_scores(restaurant_id):
    """
    Recompute category and overall scores for a restaurant from Score rows.
    Redistributes weights when a category is marked N/A.
    Updates Restaurant.credibility_score, last_audit_at, score_breakdown.
    Returns dict with overall_score, badge, last_audit_at, categories (breakdown).
    """
    restaurant = Restaurant.objects.get(pk=restaurant_id)
    scores = Score.objects.filter(restaurant=restaurant).select_related(
        'category', 'subcategory'
    )

    # Group by category; determine applicability from any score in that category
    category_data = {}  # category_id -> {scores: [(sub, score, max)], applicable: bool}
    for s in scores:
        cid = s.category_id
        if cid not in category_data:
            category_data[cid] = {'scores': [], 'applicable': s.is_category_applicable}
        category_data[cid]['applicable'] = category_data[cid]['applicable'] and s.is_category_applicable
        category_data[cid]['scores'].append((s.subcategory, s.score, s.subcategory.max_score))

    # Get all active categories with weights
    categories = (
        RubricCategory.objects.filter(is_active=True)
        .exclude(name__iexact='Benchmark Category')
        .order_by('display_order', 'id')
    )
    total_weight_applicable = Decimal('0')
    category_scores = []  # (category, score_0_100, weight, normalized_weight, is_applicable)

    for cat in categories:
        data = category_data.get(cat.id)
        if not data:
            # No scores for this category (e.g. marked N/A or not yet scored)
            category_scores.append({
                'category': cat,
                'score': None,
                'weight': float(cat.weight),
                'normalized_weight': None,
                'is_applicable': False,
            })
            continue
        applicable = data['applicable']
        if not applicable:
            category_scores.append({
                'category': cat,
                'score': None,
                'weight': float(cat.weight),
                'normalized_weight': None,
                'is_applicable': False,
            })
            continue

        total_possible = sum(m for _, _, m in data['scores'])
        total_got = sum(score for _, score, _ in data['scores'])
        if total_possible and total_possible > 0:
            cat_score = (Decimal(total_got) / Decimal(total_possible)) * 100
        else:
            cat_score = None
        total_weight_applicable += cat.weight
        category_scores.append({
            'category': cat,
            'score': float(cat_score) if cat_score is not None else None,
            'weight': float(cat.weight),
            'normalized_weight': None,  # set below
            'is_applicable': True,
        })

    # Normalize weights among applicable categories
    if total_weight_applicable > 0:
        for item in category_scores:
            if item['is_applicable'] and item['score'] is not None:
                item['normalized_weight'] = float(Decimal(str(item['weight'])) / total_weight_applicable)

    # Overall score: sum(category_score * normalized_weight)
    overall = Decimal('0')
    for item in category_scores:
        if item['is_applicable'] and item['score'] is not None and item['normalized_weight'] is not None:
            overall += Decimal(str(item['score'])) * Decimal(str(item['normalized_weight']))

    overall_float = float(overall.quantize(Decimal('0.01')))

    # Build breakdown for cache
    breakdown = []
    for item in category_scores:
        breakdown.append({
            'name': item['category'].name,
            'score': item['score'],
            'weight': item['weight'],
            'normalized_weight': item['normalized_weight'],
            'is_applicable': item['is_applicable'],
        })

    # Update restaurant cache
    restaurant.credibility_score = Decimal(str(overall_float))
    restaurant.last_audit_at = timezone.now()
    restaurant.score_breakdown = breakdown
    restaurant.save(update_fields=['credibility_score', 'last_audit_at', 'score_breakdown'])

    # Badge: ADMIN_VERIFIED if at least one category scored, else PROVISIONAL
    has_any_score = any(
        item['is_applicable'] and item['score'] is not None
        for item in category_scores
    )
    badge = 'ADMIN_VERIFIED' if has_any_score else 'PROVISIONAL'

    return {
        'overall_score': overall_float,
        'badge': badge,
        'last_audit_at': restaurant.last_audit_at,
        'categories': [
            {
                'name': item['category'].name,
                'score': item['score'],
                'weight': item['weight'],
                'normalized_weight': item['normalized_weight'],
                'is_applicable': item['is_applicable'],
            }
            for item in category_scores
        ],
    }


def compute_overall_from_audit_visit_work_item(work_item):
    """
    Same weighting as restaurant credibility, using AuditVisitScore rows and
    category_marked_na on the work item. Used for owner audit history (per-visit score).
    Returns a float 0–100, or None if no applicable scored categories.
    """
    from ..models import AuditVisitScore

    na = set(work_item.category_marked_na or [])
    qs = AuditVisitScore.objects.filter(work_item=work_item).select_related('subcategory', 'category')
    category_data = {}
    for avs in qs:
        cid = avs.category_id
        if cid not in category_data:
            category_data[cid] = {'scores': [], 'applicable': avs.is_category_applicable}
        category_data[cid]['applicable'] = category_data[cid]['applicable'] and avs.is_category_applicable
        category_data[cid]['scores'].append((avs.subcategory, avs.score, avs.subcategory.max_score))

    categories = (
        RubricCategory.objects.filter(is_active=True)
        .exclude(name__iexact='Benchmark Category')
        .order_by('display_order', 'id')
    )
    total_weight_applicable = Decimal('0')
    category_scores = []

    for cat in categories:
        if cat.id in na:
            category_scores.append({
                'category': cat,
                'score': None,
                'weight': float(cat.weight),
                'normalized_weight': None,
                'is_applicable': False,
            })
            continue
        data = category_data.get(cat.id)
        if not data:
            category_scores.append({
                'category': cat,
                'score': None,
                'weight': float(cat.weight),
                'normalized_weight': None,
                'is_applicable': False,
            })
            continue
        applicable = data['applicable']
        if not applicable:
            category_scores.append({
                'category': cat,
                'score': None,
                'weight': float(cat.weight),
                'normalized_weight': None,
                'is_applicable': False,
            })
            continue

        total_possible = sum(m for _, _, m in data['scores'])
        total_got = sum(score for _, score, _ in data['scores'])
        if total_possible and total_possible > 0:
            cat_score = (Decimal(total_got) / Decimal(total_possible)) * 100
        else:
            cat_score = None
        total_weight_applicable += cat.weight
        category_scores.append({
            'category': cat,
            'score': float(cat_score) if cat_score is not None else None,
            'weight': float(cat.weight),
            'normalized_weight': None,
            'is_applicable': True,
        })

    if total_weight_applicable > 0:
        for item in category_scores:
            if item['is_applicable'] and item['score'] is not None:
                item['normalized_weight'] = float(Decimal(str(item['weight'])) / total_weight_applicable)

    overall = Decimal('0')
    for item in category_scores:
        if item['is_applicable'] and item['score'] is not None and item['normalized_weight'] is not None:
            overall += Decimal(str(item['score'])) * Decimal(str(item['normalized_weight']))

    has_any = any(
        item['is_applicable'] and item['score'] is not None
        for item in category_scores
    )
    if not has_any:
        return None
    return float(overall.quantize(Decimal('0.01')))
