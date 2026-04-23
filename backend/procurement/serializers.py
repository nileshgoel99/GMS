from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers
from rest_framework.exceptions import ValidationError

from orders.models import IntentLine

from .models import PurchaseOrder, PurchaseOrderItem, POReceipt, POReceiptItem
from inventory.serializers import InventoryItemListSerializer


def _aggregate_intent_line_quantities(items_data):
    totals = {}
    for row in items_data:
        il = row.get('intent_line')
        if il is None or il == '':
            continue
        il_id = il if not hasattr(il, 'pk') else il.pk
        q = row.get('quantity_ordered')
        if q is None:
            continue
        totals[il_id] = totals.get(il_id, Decimal('0')) + Decimal(str(q))
    return totals


def validate_intent_line_allocations(items_data, exclude_po=None):
    """Ensure sum(PO qty per intent line, all suppliers) does not exceed indent requirement."""
    line_qty = _aggregate_intent_line_quantities(items_data)
    if not line_qty:
        return

    qs = PurchaseOrderItem.objects.filter(intent_line_id__in=list(line_qty.keys()))
    if exclude_po is not None:
        qs = qs.exclude(po=exclude_po)

    existing = {
        row['intent_line_id']: row['s'] or Decimal('0')
        for row in qs.values('intent_line_id').annotate(s=Sum('quantity_ordered'))
    }

    for il_id, add_qty in line_qty.items():
        try:
            line = IntentLine.objects.get(pk=il_id)
        except IntentLine.DoesNotExist as exc:
            raise ValidationError({'items': f'Invalid intent line id: {il_id}'}) from exc

        prev = existing.get(il_id, Decimal('0'))
        if prev + add_qty > line.total_required:
            raise ValidationError({
                'items': (
                    f'Quantity for intent line "{line.material_description}" would be '
                    f'{prev + add_qty} but only {line.total_required} is required on the indent.'
                ),
            })


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    item_details = InventoryItemListSerializer(source='item', read_only=True)
    quantity_pending = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'
        read_only_fields = ('quantity_received', 'created_at', 'updated_at')


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    indent_number = serializers.CharField(source='intent.indent_number', read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'updated_at')

    def validate(self, attrs):
        if hasattr(self, 'initial_data'):
            items = self.initial_data.get('items')
            if isinstance(items, list) and len(items) > 0:
                validate_intent_line_allocations(items, exclude_po=self.instance)
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        po = PurchaseOrder.objects.create(**validated_data)

        for item_data in items_data:
            PurchaseOrderItem.objects.create(po=po, **item_data)

        return po

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
                    PurchaseOrderItem.objects.create(po=instance, **item_data)

        return instance


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    indent_number = serializers.CharField(source='intent.indent_number', read_only=True)
    intent_id = serializers.IntegerField(read_only=True, allow_null=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'vendor_name', 'order_date', 'expected_delivery_date',
            'status', 'total_amount', 'pi_number', 'intent_id', 'indent_number',
            'created_by_name', 'items_count', 'created_at',
        ]

    def get_items_count(self, obj):
        return obj.items.count()


class POReceiptItemSerializer(serializers.ModelSerializer):
    po_item_details = serializers.SerializerMethodField()

    class Meta:
        model = POReceiptItem
        fields = '__all__'
        read_only_fields = ('created_at',)

    def get_po_item_details(self, obj):
        return {
            'item_code': obj.po_item.item.item_code,
            'item_name': obj.po_item.item.name,
            'quantity_ordered': obj.po_item.quantity_ordered,
            'quantity_pending': obj.po_item.quantity_pending,
        }


class POReceiptSerializer(serializers.ModelSerializer):
    items = POReceiptItemSerializer(many=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    po_number = serializers.CharField(source='po.po_number', read_only=True)

    class Meta:
        model = POReceipt
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at')

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        receipt = POReceipt.objects.create(**validated_data)

        for item_data in items_data:
            po_item = item_data['po_item']
            quantity = item_data['quantity_received']

            POReceiptItem.objects.create(receipt=receipt, **item_data)

            po_item.quantity_received += quantity
            po_item.save()

            from inventory.models import InventoryLog

            InventoryLog.objects.create(
                item=po_item.item,
                transaction_type='RECEIVE',
                quantity=quantity,
                reference_type='PO',
                reference_id=str(receipt.po.id),
                reference_number=receipt.receipt_number,
                vendor_supplier=receipt.po.vendor_name,
                unit_cost=po_item.unit_price,
                stock_before=po_item.item.current_stock,
                stock_after=po_item.item.current_stock + quantity,
                created_by=self.context['request'].user,
            )

            po_item.item.current_stock += quantity
            po_item.item.save()

        receipt.po.update_status()

        return receipt
