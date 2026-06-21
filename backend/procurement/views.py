from decimal import Decimal

from django.db.models import Count, Sum
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import PurchaseOrder, PurchaseOrderItem, POReceipt, PurchaseBill
from .po_numbering import next_supplier_po_number
from .bill_numbering import next_purchase_bill_ref
from .payment_due import build_bills_payables_payload, month_bounds
from .serializers import (
    PurchaseOrderSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderItemSerializer,
    POReceiptSerializer,
    PurchaseBillSerializer,
    PurchaseBillListSerializer,
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
        """Purchase bills payable this month (material received from suppliers)."""
        payload = build_bills_payables_payload(PurchaseBill.objects.all())
        items = PurchaseBillListSerializer(payload['payments_due_to_pay']['items'], many=True).data
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
        payables = build_bills_payables_payload(PurchaseBill.objects.all())
        due_pay_items = PurchaseBillListSerializer(
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


class PurchaseBillViewSet(viewsets.ModelViewSet):
    queryset = PurchaseBill.objects.all().select_related(
        'supplier', 'purchase_order', 'created_by',
    ).prefetch_related('items')
    serializer_class = PurchaseBillSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'supplier', 'purchase_order', 'bill_date']
    search_fields = ['internal_ref', 'bill_number', 'supplier_name', 'purchase_order__po_number']
    ordering_fields = ['bill_date', 'due_date', 'created_at', 'internal_ref']

    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseBillListSerializer
        return PurchaseBillSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'], url_path='next-ref')
    def next_ref(self, request):
        return Response(next_purchase_bill_ref())

    @action(detail=False, methods=['get'], url_path='payment-due-summary')
    def payment_due_summary(self, request):
        payload = build_bills_payables_payload(PurchaseBill.objects.all())
        items = PurchaseBillListSerializer(payload['payments_due_to_pay']['items'], many=True).data
        return Response({
            'current_month': payload['current_month'],
            'payments_due_to_pay': {
                **{k: v for k, v in payload['payments_due_to_pay'].items() if k != 'items'},
                'items': items,
            },
        })

    @action(detail=False, methods=['get'], url_path='prefill-from-po')
    def prefill_from_po(self, request):
        """Build purchase bill draft from a supplier PO (received material)."""
        po_id = request.query_params.get('po_id')
        if not po_id:
            return Response({'detail': 'po_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            po = PurchaseOrder.objects.prefetch_related('items__trim').get(pk=po_id)
        except PurchaseOrder.DoesNotExist:
            return Response({'detail': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)

        items = []
        for idx, line in enumerate(po.items.all(), start=1):
            qty = line.quantity_received if line.quantity_received and line.quantity_received > 0 else line.quantity_ordered
            items.append({
                'serial_no': idx,
                'po_item': line.id,
                'trim': line.trim_id,
                'trim_name': line.trim.name if line.trim_id else '',
                'particulars': line.particulars or (line.trim.name if line.trim_id else ''),
                'hsn_code': line.hsn_code or '',
                'quantity_billed': str(qty),
                'unit': line.unit or 'PCS',
                'unit_price': str(line.unit_price or 0),
            })

        return Response({
            'purchase_order': po.id,
            'po_number': po.po_number,
            'supplier': po.supplier_id,
            'supplier_name': po.vendor_name,
            'payment_terms': po.payment_terms or '',
            'tax_mode': po.tax_mode,
            'cgst_percent': str(po.cgst_percent or 0),
            'sgst_percent': str(po.sgst_percent or 0),
            'igst_percent': str(po.igst_percent or 0),
            'received_date': po.actual_delivery_date.isoformat() if po.actual_delivery_date else (
                po.expected_delivery_date.isoformat() if po.expected_delivery_date else None
            ),
            'items': items,
        })
