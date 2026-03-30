from rest_framework import generics, permissions
from ..models import RubricCategory
from ..serializers import RubricCategorySerializer


class RubricCategoryListView(generics.ListAPIView):
    """Public or authenticated: list active rubric categories with subcategories."""
    serializer_class = RubricCategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = (
        RubricCategory.objects.filter(is_active=True)
        .exclude(name__iexact='Benchmark Category')
        .prefetch_related('subcategories')
    )