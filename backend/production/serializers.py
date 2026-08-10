from decimal import Decimal, ROUND_HALF_UP

from rest_framework import serializers
from .models import (
    ProductionIssue, ProductionIssueItem, ProductionReturn, ProductionReturnItem,
    CuttingRecord,
)
from inventory.serializers import InventoryItemListSerializer
from orders.size_utils import normalize_size_breakdown_list
from .cutting import normalize_roll_entries, sum_roll_used_meters, sync_rolls_for_cutting


class ProductionIssueItemSerializer(serializers.ModelSerializer):
    item_details = InventoryItemListSerializer(source='item', read_only=True)
    quantity_consumed = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    
    class Meta:
        model = ProductionIssueItem
        fields = '__all__'
        read_only_fields = ('quantity_returned', 'created_at', 'updated_at')


class ProductionIssueSerializer(serializers.ModelSerializer):
    items = ProductionIssueItemSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    pi_details = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductionIssue
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')
    
    def get_pi_details(self, obj):
        return {
            'pi_number': obj.pi.pi_number,
            'client_name': obj.pi.client_name,
            'garment_type': obj.pi.garment_type,
            'quantity': obj.pi.quantity,
        }
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        issue = ProductionIssue.objects.create(**validated_data)
        
        for item_data in items_data:
            ProductionIssueItem.objects.create(issue=issue, **item_data)
        
        return issue
    
    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if items_data is not None:
            existing_items = {item.id: item for item in instance.items.all()}
            
            for item_data in items_data:
                item_id = item_data.get('id')
                if item_id and item_id in existing_items:
                    item = existing_items.pop(item_id)
                    for attr, value in item_data.items():
                        setattr(item, attr, value)
                    item.save()
                else:
                    ProductionIssueItem.objects.create(issue=instance, **item_data)
        
        return instance


class ProductionIssueListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    client_name = serializers.CharField(source='pi.client_name', read_only=True)
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductionIssue
        fields = ['id', 'issue_number', 'pi_number', 'client_name', 'issue_date',
                  'production_team', 'status', 'created_by_name', 'items_count', 'created_at']
    
    def get_items_count(self, obj):
        return obj.items.count()


class ProductionReturnItemSerializer(serializers.ModelSerializer):
    issue_item_details = serializers.SerializerMethodField()
    
    class Meta:
        model = ProductionReturnItem
        fields = '__all__'
        read_only_fields = ('created_at',)
    
    def get_issue_item_details(self, obj):
        return {
            'item_code': obj.issue_item.item.item_code,
            'item_name': obj.issue_item.item.name,
            'quantity_issued': obj.issue_item.quantity_issued,
            'quantity_consumed': obj.issue_item.quantity_consumed,
        }


class ProductionReturnSerializer(serializers.ModelSerializer):
    items = ProductionReturnItemSerializer(many=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    issue_number = serializers.CharField(source='issue.issue_number', read_only=True)
    
    class Meta:
        model = ProductionReturn
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        return_record = ProductionReturn.objects.create(**validated_data)
        
        for item_data in items_data:
            issue_item = item_data['issue_item']
            quantity = item_data['quantity_returned']
            
            ProductionReturnItem.objects.create(return_record=return_record, **item_data)
            
            issue_item.quantity_returned += quantity
            issue_item.save()
            
            from inventory.models import InventoryLog
            InventoryLog.objects.create(
                item=issue_item.item,
                transaction_type='RETURN',
                quantity=quantity,
                reference_type='PRODUCTION',
                reference_id=str(return_record.issue.id),
                reference_number=return_record.return_number,
                stock_before=issue_item.item.current_stock,
                stock_after=issue_item.item.current_stock + quantity,
                created_by=self.context['request'].user
            )
            
            issue_item.item.current_stock += quantity
            issue_item.item.save()
        
        return return_record


class CuttingRecordListSerializer(serializers.ModelSerializer):
    buyer_po_number = serializers.CharField(source='buyer_po.po_number', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = CuttingRecord
        fields = [
            'id', 'cutting_number', 'cutting_date', 'buyer_po', 'buyer_po_number',
            'pi', 'pi_number', 'item_code', 'item_name', 'fabric', 'color',
            'roll_width', 'roll_numbers', 'total_pcs', 'ideal_consumption', 'total_consumption',
            'consumption_unit', 'status', 'created_by_name', 'created_at',
        ]


class CuttingRecordSerializer(serializers.ModelSerializer):
    buyer_po_number = serializers.CharField(source='buyer_po.po_number', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = CuttingRecord
        fields = [
            'id', 'cutting_number', 'cutting_date',
            'buyer_po', 'buyer_po_number', 'pi', 'pi_number',
            'pi_line', 'buyer_po_line',
            'item_code', 'item_name', 'fabric', 'color', 'roll_width',
            'roll_numbers', 'size_breakdown',
            'consumption_per_pc', 'consumption_unit',
            'total_pcs', 'ideal_consumption', 'total_consumption',
            'status', 'notes',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = (
            'id', 'total_pcs', 'ideal_consumption', 'total_consumption',
            'created_by', 'created_at', 'updated_at',
        )

    def validate_roll_numbers(self, value):
        rolls = normalize_roll_entries(value)
        if not rolls:
            raise serializers.ValidationError('Add at least one roll with a roll number.')
        return rolls

    def validate(self, attrs):
        buyer_po = attrs.get('buyer_po') or getattr(self.instance, 'buyer_po', None)
        if buyer_po is None:
            raise serializers.ValidationError({'buyer_po': 'Buyer PO is required.'})

        pi = attrs.get('pi', serializers.empty)
        if pi is serializers.empty:
            pi = getattr(self.instance, 'pi', None) if self.instance else None
        if pi is None and buyer_po.pi_id:
            attrs['pi'] = buyer_po.pi

        sizes = attrs.get('size_breakdown')
        if sizes is None and self.instance:
            sizes = self.instance.size_breakdown
        sizes = normalize_size_breakdown_list(sizes or [])
        attrs['size_breakdown'] = sizes

        total_pcs = sum(int(row.get('qty') or 0) for row in sizes)
        attrs['total_pcs'] = total_pcs

        rate = attrs.get('consumption_per_pc')
        if rate is None and self.instance:
            rate = self.instance.consumption_per_pc
        rate = Decimal(str(rate or 0))
        attrs['consumption_per_pc'] = rate
        attrs['ideal_consumption'] = (rate * Decimal(total_pcs)).quantize(
            Decimal('0.0001'), rounding=ROUND_HALF_UP,
        )

        rolls = attrs.get('roll_numbers')
        if rolls is None and self.instance:
            rolls = self.instance.roll_numbers
        rolls = normalize_roll_entries(rolls or [])
        attrs['roll_numbers'] = rolls

        actual_used = sum_roll_used_meters(rolls)
        if actual_used <= 0:
            raise serializers.ValidationError({
                'roll_numbers': 'Enter meters used on at least one roll.',
            })
        attrs['total_consumption'] = actual_used

        if total_pcs <= 0:
            raise serializers.ValidationError({'size_breakdown': 'Enter cut quantity for at least one size.'})

        return attrs

    def validate_size_breakdown(self, value):
        return normalize_size_breakdown_list(value)

    def create(self, validated_data):
        cutting = super().create(validated_data)
        sync_rolls_for_cutting(cutting)
        return cutting

    def update(self, instance, validated_data):
        previous_roll_nos = {
            e['roll_no'] for e in normalize_roll_entries(instance.roll_numbers or [])
        }
        cutting = super().update(instance, validated_data)
        sync_rolls_for_cutting(cutting, previous_roll_nos=previous_roll_nos)
        return cutting

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['size_breakdown'] = normalize_size_breakdown_list(data.get('size_breakdown'))
        data['roll_numbers'] = normalize_roll_entries(data.get('roll_numbers'))
        return data
