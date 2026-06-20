from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend

from .models import Supplier
from .serializers import SupplierSerializer, SupplierListSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().select_related('created_by')
    serializer_class = SupplierSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'is_active']
    search_fields = ['name', 'address', 'gst', 'country', 'contact_person', 'email', 'phone', 'city']
    ordering_fields = ['name', 'country', 'created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return SupplierListSerializer
        return SupplierSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
