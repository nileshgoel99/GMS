from decimal import Decimal
from datetime import date

from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.db.models import F, Q

from orders.models import TrimMaster
from orders.serializers import TrimMasterSerializer
from procurement.stock_receive import (
    _category_for_trim,
    _inventory_unit,
    _unique_item_code,
)

from .models import InventoryItem, InventoryLog
from .serializers import (
    InventoryItemSerializer,
    InventoryItemListSerializer,
    InventoryLogSerializer,
    InventorySummarySerializer,
    ReleaseStockSerializer,
    OpeningStockSerializer,
    CreateOpeningStockSerializer,
)
from .utils import get_stock_sources_for_item


def _spec_lines_from_property_values(property_values):
    lines = []
    if not isinstance(property_values, dict):
        return lines
    for key, value in property_values.items():
        label = str(key or '').strip()
        val = str(value or '').strip()
        if label and val:
            lines.append(f'{label}: {val}')
    return lines


def _post_opening_stock(*, item, quantity, remarks, transaction_date, user):
    stock_before = item.current_stock or Decimal('0')
    stock_after = stock_before + quantity
    item.current_stock = stock_after
    item.save(update_fields=['current_stock', 'updated_at'])

    txn_date = transaction_date or date.today()
    return InventoryLog.objects.create(
        item=item,
        transaction_type='ADJUST',
        quantity=quantity,
        reference_type='OPENING',
        reference_number='Opening stock',
        stock_before=stock_before,
        stock_after=stock_after,
        transaction_date=txn_date,
        remarks=remarks or 'Opening stock',
        created_by=user,
    )


def _resolve_or_create_item_for_trim(*, trim, property_values=None, user=None):
    spec_lines = _spec_lines_from_property_values(property_values)
    stored_name = (trim.name or 'Trim')[:200]

    lookup = {'is_active': True, 'trim': trim}
    if spec_lines:
        lookup['spec_lines'] = spec_lines
    else:
        lookup['name'] = stored_name

    existing = InventoryItem.objects.filter(**lookup).order_by('id').first()
    if existing:
        return existing, False

    item = InventoryItem.objects.create(
        item_code=_unique_item_code(f'TRM-{trim.id}'),
        name=stored_name,
        trim=trim,
        spec_lines=spec_lines,
        category=_category_for_trim(trim),
        unit=_inventory_unit(getattr(trim, 'default_unit', None) or 'PCS'),
        created_by=user,
    )
    return item, True


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
        if self.action in ('opening_stock', 'create_with_opening_stock'):
            if self.action == 'create_with_opening_stock':
                return CreateOpeningStockSerializer
            return OpeningStockSerializer
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
        transaction_date = serializer.validated_data.get('transaction_date') or date.today()

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
            transaction_date=transaction_date,
            remarks=remarks,
            created_by=request.user,
        )

        return Response(InventoryLogSerializer(log).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='opening-stock')
    def opening_stock(self, request, pk=None):
        """Add opening stock (initial on-hand balance) for an inventory item."""
        item = self.get_object()
        serializer = OpeningStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        log = _post_opening_stock(
            item=item,
            quantity=serializer.validated_data['quantity'],
            remarks=serializer.validated_data.get('remarks', '') or 'Opening stock',
            transaction_date=serializer.validated_data.get('transaction_date'),
            user=request.user,
        )
        return Response(InventoryLogSerializer(log).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='create-with-opening-stock')
    def create_with_opening_stock(self, request):
        """
        Create a new trim (optional), create/resolve inventory SKU, and post opening stock.
        Used when opening stock is for a trim not yet in inventory / library.
        """
        serializer = CreateOpeningStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            trim = None
            trim_created = False
            if data.get('trim_id'):
                try:
                    trim = TrimMaster.objects.get(pk=data['trim_id'])
                except TrimMaster.DoesNotExist:
                    return Response({'trim_id': 'Trim not found.'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                trim_payload = dict(data.get('trim') or {})
                trim_ser = TrimMasterSerializer(data={
                    'name': str(trim_payload.get('name') or '').strip().upper(),
                    'category': str(trim_payload.get('category') or '').strip(),
                    'default_unit': str(trim_payload.get('default_unit') or 'PCS').strip() or 'PCS',
                    'notes': str(trim_payload.get('notes') or '').strip(),
                    'properties': trim_payload.get('properties') or [],
                    'default_property_values': trim_payload.get('default_property_values') or {},
                })
                trim_ser.is_valid(raise_exception=True)
                trim = trim_ser.save()
                trim_created = True

            item, item_created = _resolve_or_create_item_for_trim(
                trim=trim,
                property_values=data.get('property_values') or {},
                user=request.user,
            )

            log = _post_opening_stock(
                item=item,
                quantity=data['quantity'],
                remarks=data.get('remarks', '') or 'Opening stock',
                transaction_date=data.get('transaction_date'),
                user=request.user,
            )

        return Response(
            {
                'trim': TrimMasterSerializer(trim).data,
                'trim_created': trim_created,
                'item': InventoryItemSerializer(item, context=self.get_serializer_context()).data,
                'item_created': item_created,
                'log': InventoryLogSerializer(log).data,
            },
            status=status.HTTP_201_CREATED,
        )

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
