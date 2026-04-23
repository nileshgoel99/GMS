from rest_framework import serializers
from .models import ProductionIssue, ProductionIssueItem, ProductionReturn, ProductionReturnItem
from inventory.serializers import InventoryItemListSerializer


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
