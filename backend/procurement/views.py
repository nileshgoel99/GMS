from decimal import Decimal

from django.db.models import Count, Sum
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import PurchaseOrder, PurchaseOrderItem, POReceipt
from .po_numbering import next_supplier_po_number
from .payment_due import build_payments_due_to_pay_payload, month_bounds
from .serializers import (
    PurchaseOrderSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderItemSerializer,
    POReceiptSerializer
)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().select_related('pi', 'created_by').prefetch_related('items')
    serializer_class = PurchaseOrderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor_name', 'order_date', 'pi']
    search_fields = ['po_number', 'vendor_name', 'vendor_email', 'reference_number', 'attention']
    ordering_fields = ['order_date', 'created_at', 'po_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseOrderListSerializer
        return PurchaseOrderSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='next-po-number')
    def next_po_number(self, request):
        """Return next supplier PO number: JBI/PO/YY-YY/<seq>."""
        return Response(next_supplier_po_number())
    
    @action(detail=True, methods=['post'])
    def add_item(self, request, pk=None):
        po = self.get_object()
        serializer = PurchaseOrderItemSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save(po=po)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def pending(self, request):
        pos = self.queryset.filter(status__in=['ORDERED', 'PARTIAL'])
        serializer = PurchaseOrderListSerializer(pos, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='payment-due-summary')
    def payment_due_summary(self, request):
        """Supplier PO payables due this month (from payment terms)."""
        payload = build_payments_due_to_pay_payload(PurchaseOrder.objects.all())
        items = PurchaseOrderListSerializer(payload['payments_due_to_pay']['items'], many=True).data
        return Response({
            'current_month': payload['current_month'],
            'payments_due_to_pay': {
                **{k: v for k, v in payload['payments_due_to_pay'].items() if k != 'items'},
                'items': items,
            },
        })

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total = self.queryset.count()
        by_status = {}
        for choice in PurchaseOrder.STATUS_CHOICES:
            by_status[choice[0]] = self.queryset.filter(status=choice[0]).count()

        today, month_start, month_end = month_bounds()
        payables = build_payments_due_to_pay_payload(PurchaseOrder.objects.all())
        due_pay_items = PurchaseOrderListSerializer(
            payables['payments_due_to_pay']['items'], many=True,
        ).data

        receive_qs = PurchaseOrder.objects.filter(
            expected_delivery_date__gte=month_start,
            expected_delivery_date__lt=month_end,
            status__in=['ORDERED', 'PARTIAL'],
        ).select_related('buyer_po', 'supplier', 'pi').order_by('expected_delivery_date', 'po_number')
        receive_agg = receive_qs.aggregate(count=Count('id'), total=Sum('total_amount'))
        receive_total = receive_agg['total'] or Decimal('0')
        receive_items = PurchaseOrderListSerializer(receive_qs, many=True).data

        return Response({
            'total_pos': total,
            'by_status': by_status,
            'current_month': payables['current_month'],
            'payments_due_to_pay': {
                'count': payables['payments_due_to_pay']['count'],
                'total_amount': payables['payments_due_to_pay']['total_amount'],
                'items': due_pay_items,
            },
            'pos_due_to_receive': {
                'count': receive_agg['count'] or 0,
                'total_amount': str(receive_total),
                'items': receive_items,
            },
        })


class POReceiptViewSet(viewsets.ModelViewSet):
    queryset = POReceipt.objects.all().select_related('po', 'created_by').prefetch_related('items')
    serializer_class = POReceiptSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['po', 'receipt_date']
    search_fields = ['receipt_number', 'po__po_number']
    ordering_fields = ['receipt_date', 'created_at']
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
