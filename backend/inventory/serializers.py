from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from .models import InventoryItem, InventoryLog
from .utils import (
    aggregate_pi_and_suppliers,
    get_stock_sources_for_item,
    item_display_name,
    item_property_lines,
)


class InventoryLogSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.item_code', read_only=True)

    class Meta:
        model = InventoryLog
        fields = '__all__'
        read_only_fields = ('stock_before', 'stock_after', 'created_by', 'created_at')


class ReleaseStockSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class InventoryItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    needs_reorder = serializers.BooleanField(read_only=True)
    item_name = serializers.SerializerMethodField()
    property_lines = serializers.SerializerMethodField()
    trim_name = serializers.CharField(source='trim.name', read_only=True, default=None)
    pi_refs = serializers.SerializerMethodField()
    suppliers = serializers.SerializerMethodField()
    stock_sources = serializers.SerializerMethodField()
    recent_logs = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at', 'current_stock')

    def get_item_name(self, obj):
        return item_display_name(obj)

    def get_property_lines(self, obj):
        return item_property_lines(obj)

    def get_pi_refs(self, obj):
        pi_refs, _ = aggregate_pi_and_suppliers(obj)
        return pi_refs

    def get_suppliers(self, obj):
        _, suppliers = aggregate_pi_and_suppliers(obj)
        return suppliers

    def get_stock_sources(self, obj):
        return get_stock_sources_for_item(obj)

    def get_recent_logs(self, obj):
        logs = obj.logs.all()[:10]
        return InventoryLogSerializer(logs, many=True).data

    def update(self, instance, validated_data):
        validated_data.pop('current_stock', None)
        return super().update(instance, validated_data)


class InventoryItemListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    needs_reorder = serializers.BooleanField(read_only=True)
    item_name = serializers.SerializerMethodField()
    property_lines = serializers.SerializerMethodField()
    trim_name = serializers.CharField(source='trim.name', read_only=True, default=None)
    pi_refs = serializers.SerializerMethodField()
    suppliers = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            'id',
            'item_code',
            'name',
            'item_name',
            'property_lines',
            'trim_name',
            'category',
            'color',
            'size',
            'current_stock',
            'unit',
            'reorder_level',
            'needs_reorder',
            'is_active',
            'created_by_name',
            'pi_refs',
            'suppliers',
        ]

    def get_item_name(self, obj):
        return item_display_name(obj)

    def get_property_lines(self, obj):
        return item_property_lines(obj)

    def get_pi_refs(self, obj):
        sources = self.context.get('sources_cache', {}).get(obj.id)
        pi_refs, _ = aggregate_pi_and_suppliers(obj, sources)
        return pi_refs

    def get_suppliers(self, obj):
        sources = self.context.get('sources_cache', {}).get(obj.id)
        _, suppliers = aggregate_pi_and_suppliers(obj, sources)
        return suppliers


class InventorySummarySerializer(serializers.ModelSerializer):
    item_name = serializers.SerializerMethodField()
    property_lines = serializers.SerializerMethodField()
    pi_refs = serializers.SerializerMethodField()
    suppliers = serializers.SerializerMethodField()
    stock_sources = serializers.SerializerMethodField()
    total_ordered = serializers.SerializerMethodField()
    total_received = serializers.SerializerMethodField()
    total_released = serializers.SerializerMethodField()
    last_order_date = serializers.SerializerMethodField()
    last_receipt_date = serializers.SerializerMethodField()
    last_release_date = serializers.SerializerMethodField()
    all_logs = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            'id',
            'item_code',
            'name',
            'item_name',
            'property_lines',
            'category',
            'current_stock',
            'unit',
            'pi_refs',
            'suppliers',
            'stock_sources',
            'total_ordered',
            'total_received',
            'total_released',
            'last_order_date',
            'last_receipt_date',
            'last_release_date',
            'all_logs',
        ]

    def get_item_name(self, obj):
        return item_display_name(obj)

    def get_property_lines(self, obj):
        return item_property_lines(obj)

    def get_pi_refs(self, obj):
        pi_refs, _ = aggregate_pi_and_suppliers(obj)
        return pi_refs

    def get_suppliers(self, obj):
        _, suppliers = aggregate_pi_and_suppliers(obj)
        return suppliers

    def get_stock_sources(self, obj):
        return get_stock_sources_for_item(obj)

    def get_total_ordered(self, obj):
        total = obj.logs.filter(transaction_type='ORDER').aggregate(total=Sum('quantity'))['total']
        return total or 0

    def get_total_received(self, obj):
        total = obj.logs.filter(transaction_type='RECEIVE').aggregate(total=Sum('quantity'))['total']
        return total or 0

    def get_total_released(self, obj):
        total = obj.logs.filter(transaction_type='ISSUE').aggregate(total=Sum('quantity'))['total']
        return total or 0

    def get_last_order_date(self, obj):
        log = obj.logs.filter(transaction_type='ORDER').first()
        return log.created_at if log else None

    def get_last_receipt_date(self, obj):
        log = obj.logs.filter(transaction_type='RECEIVE').first()
        return log.created_at if log else None

    def get_last_release_date(self, obj):
        log = obj.logs.filter(transaction_type='ISSUE').first()
        return log.created_at if log else None

    def get_all_logs(self, obj):
        logs = obj.logs.all()
        return InventoryLogSerializer(logs, many=True).data
