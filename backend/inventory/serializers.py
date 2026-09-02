from decimal import Decimal
from datetime import date

from django.db.models import Sum
from rest_framework import serializers

from .models import InventoryItem, InventoryItemAudit, InventoryLog
from .utils import (
    aggregate_pi_and_suppliers,
    get_stock_sources_for_item,
    item_display_name,
    item_property_lines,
)


class InventoryItemAuditSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.CharField(source='performed_by.username', read_only=True)

    class Meta:
        model = InventoryItemAudit
        fields = [
            'id', 'item', 'item_code', 'item_name', 'action',
            'changes', 'performed_by', 'performed_by_name', 'performed_at',
        ]
        read_only_fields = fields


class InventoryLogSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.item_code', read_only=True)
    # Prefer business date; fall back to created_at for older rows.
    effective_date = serializers.SerializerMethodField()

    class Meta:
        model = InventoryLog
        fields = '__all__'
        read_only_fields = ('stock_before', 'stock_after', 'created_by', 'created_at')

    def get_effective_date(self, obj):
        if obj.transaction_date:
            return obj.transaction_date.isoformat()
        if obj.created_at:
            return obj.created_at.date().isoformat()
        return None


class ReleaseStockSerializer(serializers.Serializer):
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    transaction_date = serializers.DateField(required=False, allow_null=True)


class OpeningStockSerializer(serializers.Serializer):
    """Add opening / initial stock to an inventory item."""
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    transaction_date = serializers.DateField(required=False, allow_null=True)

    def validate_transaction_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError('Opening stock date cannot be in the future.')
        return value


class CreateOpeningStockSerializer(serializers.Serializer):
    """
    Create a trim (optional), resolve/create inventory SKU, and post opening stock.

    Provide either:
    - trim_id: existing TrimMaster, or
    - trim: { name, category, default_unit, properties?, notes? } to create one.
    """
    trim_id = serializers.IntegerField(required=False, allow_null=True)
    trim = serializers.DictField(required=False, allow_null=True)
    property_values = serializers.DictField(required=False, allow_null=True)
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal('0.01'))
    remarks = serializers.CharField(required=False, allow_blank=True, default='')
    transaction_date = serializers.DateField(required=False, allow_null=True)

    def validate_transaction_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError('Opening stock date cannot be in the future.')
        return value

    def validate(self, attrs):
        trim_id = attrs.get('trim_id')
        trim_payload = attrs.get('trim')
        if not trim_id and not (isinstance(trim_payload, dict) and str(trim_payload.get('name') or '').strip()):
            raise serializers.ValidationError(
                {'trim': 'Select an existing trim or provide a new trim name.'}
            )
        return attrs


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
            'trim',
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
    audits = serializers.SerializerMethodField()

    class Meta:
        model = InventoryItem
        fields = [
            'id',
            'item_code',
            'name',
            'item_name',
            'property_lines',
            'category',
            'color',
            'size',
            'finish',
            'material',
            'unit_cost',
            'description',
            'reorder_level',
            'is_active',
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
            'audits',
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

    def get_audits(self, obj):
        return InventoryItemAuditSerializer(
            obj.audits.select_related('performed_by').all()[:50],
            many=True,
        ).data
