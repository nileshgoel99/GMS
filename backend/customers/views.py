from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Customer
from .serializers import CustomerSerializer, CustomerListSerializer


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().select_related('created_by').prefetch_related('contacts')
    serializer_class = CustomerSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['country', 'is_active', 'default_currency', 'customer_code']
    search_fields = [
        'customer_code',
        'company_legal_name',
        'primary_email',
        'tax_id_vat',
        'city',
        'contacts__name',
        'contacts__email',
    ]
    ordering_fields = ['company_legal_name', 'country', 'created_at', 'customer_code']

    def get_serializer_class(self):
        if self.action == 'list':
            return CustomerListSerializer
        return CustomerSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='lookup-code')
    def lookup_code(self, request):
        """Return subsidiaries / entities already using this customer code."""
        code = (request.query_params.get('code') or '').strip()
        exclude_id = request.query_params.get('exclude_id')
        if not code:
            return Response({'exists': False, 'customers': []})
        qs = Customer.objects.filter(customer_code__iexact=code)
        if exclude_id:
            qs = qs.exclude(pk=exclude_id)
        customers = list(
            qs.values('id', 'company_legal_name', 'city', 'country', 'is_active').order_by('company_legal_name')
        )
        return Response({'exists': bool(customers), 'customers': customers})
