"""
Idempotent seed for Phase 1.2 rubric categories and subcategories.
Run: python manage.py seed_rubric
"""
from decimal import Decimal

from django.core.management.base import BaseCommand

from core.models import RubricCategory, RubricSubCategory


RUBRIC_DATA = [
    {
        'name': 'Kitchen Hygiene',
        'weight': Decimal('0.30'),
        'description': 'Cleanliness, organization, pest control',
        'display_order': 1,
        'subcategories': [
            ('Cooking Area Cleanliness', 5, 'Spotless=5, generally clean=3-4, visible dirt=1-2, severe issues=0'),
            ('Food Storage', 5, 'Proper temperature, labeling, organization'),
            ('Waste Management', 5, 'Bins, separation, disposal practices'),
            ('Pest Control', 5, 'Signs of pests, prevention measures'),
        ],
    },
    {
        'name': 'Food Handling & Safety',
        'weight': Decimal('0.25'),
        'description': 'Gloves, temperature control, storage',
        'display_order': 2,
        'subcategories': [
            ('Personal Hygiene & Gloves', 5, 'Hand washing, glove use'),
            ('Temperature Control', 5, 'Hot/cold holding, thermometers'),
            ('Cross-contamination Prevention', 5, 'Separation of raw/cooked, cleaning'),
        ],
    },
    {
        'name': 'Operational Compliance',
        'weight': Decimal('0.20'),
        'description': 'Licenses, certifications, staff training',
        'display_order': 3,
        'subcategories': [
            ('Licenses & Certifications', 5, 'Valid FSSAI, health permits'),
            ('Staff Training', 5, 'Food safety training records'),
            ('Documentation', 5, 'Logs, records, compliance docs'),
        ],
    },
    {
        'name': 'Customer Safety & Comfort',
        'weight': Decimal('0.15'),
        'description': 'Seating, washrooms, fire safety',
        'display_order': 4,
        'subcategories': [
            ('Seating & Layout', 5, 'Clean, safe, accessible'),
            ('Washrooms', 5, 'Cleanliness, soap, hand drying'),
            ('Fire Safety', 5, 'Exits, extinguishers, signage'),
        ],
    },
    {
        'name': 'Sustainability',
        'weight': Decimal('0.10'),
        'description': 'Waste management, eco-friendly practices (Optional)',
        'display_order': 5,
        'subcategories': [
            ('Waste Reduction', 5, 'Recycling, composting, packaging'),
            ('Eco-friendly Practices', 5, 'Energy, water, sourcing'),
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed rubric categories and subcategories (idempotent).'

    def handle(self, *args, **options):
        for cat_data in RUBRIC_DATA:
            subcats = cat_data.pop('subcategories')
            cat, created = RubricCategory.objects.get_or_create(
                name=cat_data['name'],
                defaults={
                    'weight': cat_data['weight'],
                    'description': cat_data.get('description', ''),
                    'display_order': cat_data['display_order'],
                    'is_active': True,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created category: {cat.name}'))
            for order, (name, max_score, desc) in enumerate(subcats, start=1):
                _, sub_created = RubricSubCategory.objects.get_or_create(
                    category=cat,
                    name=name,
                    defaults={
                        'max_score': max_score,
                        'description': desc,
                        'display_order': order,
                    },
                )
                if sub_created:
                    self.stdout.write(f'  Created subcategory: {name}')
        self.stdout.write(self.style.SUCCESS('Rubric seed complete.'))
