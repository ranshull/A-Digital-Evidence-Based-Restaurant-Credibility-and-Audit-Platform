from rest_framework import generics, status
from rest_framework.response import Response
from ..models import OwnerApplication
from ..serializers import OwnerApplicationSerializer
from ..permissions import IsAdmin


class OwnerApplyView(generics.CreateAPIView):
    queryset = OwnerApplication.objects.all()
    serializer_class = OwnerApplicationSerializer

    def create(self, request, *args, **kwargs):
        # If user has a pending application, update it with new data instead of creating another
        pending = OwnerApplication.objects.filter(user=request.user, status='PENDING').first()
        if pending:
            serializer = self.get_serializer(pending, data=request.data, partial=False)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)


class OwnerApplicationStatusView(generics.ListAPIView):
    serializer_class = OwnerApplicationSerializer

    def get_queryset(self):
        return OwnerApplication.objects.filter(user=self.request.user).order_by('-submitted_at')

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if not qs.exists():
            return Response({'applications': [], 'latest': None})
        latest = qs.first()
        return Response({
            'applications': OwnerApplicationSerializer(qs, many=True).data,
            'latest': OwnerApplicationSerializer(latest).data,
        })
