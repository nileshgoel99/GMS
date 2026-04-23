from django.db.models import Sum
from rest_framework import serializers
from .models import InventoryItem, InventoryLog


class InventoryLogSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.item_code', read_only=True)
    
    class Meta:
        model = InventoryLog
        fields = '__all__'
        read_only_fields = ('stock_before', 'stock_after', 'created_by', 'created_at')


class InventoryItemSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    needs_reorder = serializers.BooleanField(read_only=True)
    recent_logs = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')
    
    def get_recent_logs(self, obj):
        logs = obj.logs.all()[:5]
        return InventoryLogSerializer(logs, many=True).data


class InventoryItemListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    needs_reorder = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = InventoryItem
        fields = ['id', 'item_code', 'name', 'category', 'color', 'size', 
                  'current_stock', 'unit', 'reorder_level', 'needs_reorder', 
                  'is_active', 'created_by_name']


class InventorySummarySerializer(serializers.ModelSerializer):
    total_ordered = serializers.SerializerMethodField()
    total_received = serializers.SerializerMethodField()
    total_released = serializers.SerializerMethodField()
    last_order_date = serializers.SerializerMethodField()
    last_receipt_date = serializers.SerializerMethodField()
    last_release_date = serializers.SerializerMethodField()
    all_logs = serializers.SerializerMethodField()
    
    class Meta:
        model = InventoryItem
        fields = ['id', 'item_code', 'name', 'category', 'current_stock', 'unit',
                  'total_ordered', 'total_received', 'total_released',
                  'last_order_date', 'last_receipt_date', 'last_release_date',
                  'all_logs']
    
    def get_total_ordered(self, obj):
        total = obj.logs.filter(transaction_type='ORDER').aggregate(
            total=Sum('quantity'))['total']
        return total or 0
    
    def get_total_received(self, obj):
        total = obj.logs.filter(transaction_type='RECEIVE').aggregate(
            total=Sum('quantity'))['total']
        return total or 0
    
    def get_total_released(self, obj):
        total = obj.logs.filter(transaction_type='ISSUE').aggregate(
            total=Sum('quantity'))['total']
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
