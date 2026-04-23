from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import F, Q
from .models import InventoryItem, InventoryLog
from .serializers import (
    InventoryItemSerializer,
    InventoryItemListSerializer,
    InventoryLogSerializer,
    InventorySummarySerializer
)


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().select_related('created_by')
    serializer_class = InventoryItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active', 'color', 'size']
    search_fields = ['item_code', 'name', 'description']
    ordering_fields = ['name', 'category', 'current_stock', 'created_at']
    
    def get_serializer_class(self):
        if self.action == 'list':
            return InventoryItemListSerializer
        elif self.action == 'summary':
            return InventorySummarySerializer
        return InventoryItemSerializer
    
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        items = self.queryset.filter(
            Q(current_stock__lte=F('reorder_level')) & Q(is_active=True)
        )
        serializer = InventoryItemListSerializer(items, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        item = self.get_object()
        serializer = InventorySummarySerializer(item)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total_items = self.queryset.filter(is_active=True).count()
        low_stock_items = self.queryset.filter(
            Q(current_stock__lte=F('reorder_level')) & Q(is_active=True)
        ).count()
        
        by_category = {}
        for choice in InventoryItem.CATEGORY_CHOICES:
            by_category[choice[0]] = self.queryset.filter(
                category=choice[0], is_active=True
            ).count()
        
        return Response({
            'total_items': total_items,
            'low_stock_items': low_stock_items,
            'by_category': by_category
        })


class InventoryLogViewSet(viewsets.ModelViewSet):
    queryset = InventoryLog.objects.all().select_related('item', 'created_by')
    serializer_class = InventoryLogSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['transaction_type', 'item', 'reference_type', 'reference_number']
    search_fields = ['item__item_code', 'item__name', 'reference_number', 'vendor_supplier']
    ordering_fields = ['created_at']
    
    def perform_create(self, serializer):
        item = serializer.validated_data['item']
        quantity = serializer.validated_data['quantity']
        transaction_type = serializer.validated_data['transaction_type']
        
        stock_before = item.current_stock
        
        if transaction_type in ['RECEIVE', 'RETURN']:
            stock_after = stock_before + quantity
        elif transaction_type in ['ISSUE', 'ORDER']:
            stock_after = stock_before - quantity if transaction_type == 'ISSUE' else stock_before
        else:
            stock_after = stock_before + quantity
        
        item.current_stock = stock_after
        item.save()
        
        serializer.save(
            created_by=self.request.user,
            stock_before=stock_before,
            stock_after=stock_after
        )
