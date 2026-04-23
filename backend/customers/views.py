from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend

from .models import Customer
from .serializers import CustomerSerializer, CustomerListSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().select_related('created_by')
    serializer_class = CustomerSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'is_active', 'default_currency']
    search_fields = [
        'customer_code',
        'company_legal_name',
        'trading_name',
        'primary_email',
        'tax_id_vat',
        'city',
    ]
    ordering_fields = ['company_legal_name', 'country', 'created_at', 'customer_code']

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        return CustomerSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
