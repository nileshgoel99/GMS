from decimal import Decimal

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
    InventorySummarySerializer,
    ReleaseStockSerializer,
)
from .utils import get_stock_sources_for_item


class InventoryItemViewSet(viewsets.ModelViewSet):
    queryset = InventoryItem.objects.all().select_related('created_by', 'trim')
    serializer_class = InventoryItemSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active', 'color', 'size']
    search_fields = ['item_code', 'name', 'description', 'trim__name']
    ordering_fields = ['name', 'category', 'current_stock', 'created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return InventoryItemListSerializer
        if self.action == 'summary':
            return InventorySummarySerializer
        if self.action == 'release':
            return ReleaseStockSerializer
        return InventoryItemSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.action == 'list':
            queryset = self.filter_queryset(self.get_queryset())
            context['sources_cache'] = {
                item.id: get_stock_sources_for_item(item) for item in queryset
            }
        return context

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, current_stock=Decimal('0'))

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        items = self.queryset.filter(Q(current_stock__lte=F('reorder_level')) & Q(is_active=True))
        context = self.get_serializer_context()
        context['sources_cache'] = {item.id: get_stock_sources_for_item(item) for item in items}
        serializer = InventoryItemListSerializer(items, many=True, context=context)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        item = self.get_object()
        serializer = InventorySummarySerializer(item)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def release(self, request, pk=None):
        item = self.get_object()
        serializer = ReleaseStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        quantity = serializer.validated_data['quantity']
        remarks = serializer.validated_data.get('remarks', '')

        if quantity > (item.current_stock or Decimal('0')):
            return Response(
                {'quantity': f'Cannot release more than available stock ({item.current_stock} {item.unit}).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stock_before = item.current_stock or Decimal('0')
        stock_after = stock_before - quantity
        item.current_stock = stock_after
        item.save(update_fields=['current_stock', 'updated_at'])

        log = InventoryLog.objects.create(
            item=item,
            transaction_type='ISSUE',
            quantity=quantity,
            reference_type='RELEASE',
            reference_number='Production release',
            stock_before=stock_before,
            stock_after=stock_after,
            remarks=remarks,
            created_by=request.user,
        )

        return Response(InventoryLogSerializer(log).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        total_items = self.queryset.filter(is_active=True).count()
        low_stock_items = self.queryset.filter(
            Q(current_stock__lte=F('reorder_level')) & Q(is_active=True)
        ).count()

        by_category = {}
        for choice in InventoryItem.CATEGORY_CHOICES:
            by_category[choice[0]] = self.queryset.filter(category=choice[0], is_active=True).count()

        return Response(
            {
                'total_items': total_items,
                'low_stock_items': low_stock_items,
                'by_category': by_category,
            }
        )


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

        if transaction_type == 'ISSUE' and quantity > (item.current_stock or Decimal('0')):
            from rest_framework.exceptions import ValidationError

            raise ValidationError({'quantity': 'Exceeds available stock.'})

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
            stock_after=stock_after,
        )
