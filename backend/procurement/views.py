from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import PurchaseOrder, PurchaseOrderItem, POReceipt
from .serializers import (
    PurchaseOrderSerializer,
    PurchaseOrderListSerializer,
    PurchaseOrderItemSerializer,
    POReceiptSerializer
)


class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all().select_related('pi', 'intent', 'created_by').prefetch_related('items')
    serializer_class = PurchaseOrderSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'vendor_name', 'order_date', 'pi', 'intent']
    search_fields = ['po_number', 'vendor_name', 'vendor_email']
    ordering_fields = ['order_date', 'created_at', 'po_number']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return PurchaseOrderListSerializer
        return PurchaseOrderSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
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
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total = self.queryset.count()
        by_status = {}
        for choice in PurchaseOrder.STATUS_CHOICES:
            by_status[choice[0]] = self.queryset.filter(status=choice[0]).count()
        
        return Response({
            'total_pos': total,
            'by_status': by_status
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
