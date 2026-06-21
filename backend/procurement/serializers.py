from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from suppliers.models import Supplier
from .models import PurchaseOrder, PurchaseOrderItem, POReceipt, POReceiptItem
from .po_numbering import next_supplier_po_number
from .payment_due import compute_payment_due_date
from inventory.serializers import InventoryItemListSerializer


def _sync_supplier_fields(validated_data):
    supplier = validated_data.get('supplier')
    if not supplier:
        return validated_data
    if not isinstance(supplier, Supplier):
        supplier = Supplier.objects.get(pk=supplier)
    validated_data['supplier'] = supplier
    validated_data['vendor_name'] = supplier.name
    validated_data['vendor_address'] = '\n'.join(filter(None, [
        supplier.address,
        supplier.city,
        supplier.state_province,
        supplier.postal_code,
        supplier.country,
    ]))
    if supplier.email:
        validated_data['vendor_email'] = supplier.email
    if supplier.phone:
        validated_data['vendor_phone'] = supplier.phone
    if supplier.contact_person and not validated_data.get('attention'):
        validated_data['attention'] = supplier.contact_person
    return validated_data


def _build_reference_number(pi, buyer_po, explicit=''):
    if explicit:
        return explicit
    if buyer_po:
        return buyer_po.po_number
    return ''


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    item_details = InventoryItemListSerializer(source='item', read_only=True)
    trim_name = serializers.CharField(source='trim.name', read_only=True)
    quantity_pending = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = PurchaseOrderItem
        fields = '__all__'
        read_only_fields = ('po', 'quantity_received', 'total_price', 'created_at', 'updated_at')

    def validate(self, attrs):
        if not attrs.get('item') and not attrs.get('trim') and not (attrs.get('particulars') or '').strip():
            raise serializers.ValidationError('Each line needs a trim, inventory item, or particulars description.')
        return attrs


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    buyer_po_number = serializers.CharField(source='buyer_po.po_number', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    payment_due_date = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = (
            'created_by', 'created_at', 'updated_at',
            'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount',
        )

    def get_payment_due_date(self, obj):
        due = compute_payment_due_date(obj)
        return due.isoformat() if due else None

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        validated_data = _sync_supplier_fields(validated_data)
        pi = validated_data.get('pi')
        buyer_po = validated_data.get('buyer_po')
        validated_data['reference_number'] = _build_reference_number(
            pi, buyer_po, validated_data.get('reference_number', ''),
        )
        if not (validated_data.get('po_number') or '').strip():
            validated_data['po_number'] = next_supplier_po_number()['po_number']
        validated_data['status'] = 'ORDERED'
        po = PurchaseOrder.objects.create(**validated_data)
        for idx, item_data in enumerate(items_data, start=1):
            item_data.pop('id', None)
            item_data.pop('po', None)
            if not item_data.get('serial_no'):
                item_data['serial_no'] = idx
            PurchaseOrderItem.objects.create(po=po, **item_data)
        po.recalculate_totals()
        return po

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        validated_data = _sync_supplier_fields(validated_data)
        pi = validated_data.get('pi', instance.pi)
        buyer_po = validated_data.get('buyer_po', instance.buyer_po)
        if 'reference_number' not in validated_data or not validated_data.get('reference_number'):
            validated_data['reference_number'] = _build_reference_number(pi, buyer_po, instance.reference_number)

        validated_data['status'] = 'ORDERED'

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data, start=1):
                item_data.pop('id', None)
                item_data.pop('po', None)
                if not item_data.get('serial_no'):
                    item_data['serial_no'] = idx
                PurchaseOrderItem.objects.create(po=instance, **item_data)

        instance.recalculate_totals()
        return instance


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    buyer_po_number = serializers.CharField(source='buyer_po.po_number', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    items_count = serializers.SerializerMethodField()
    payment_due_date = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'vendor_name', 'supplier', 'supplier_name',
            'order_date', 'expected_delivery_date', 'payment_due_date', 'payment_terms',
            'status', 'subtotal', 'total_amount', 'reference_number',
            'pi', 'pi_number', 'buyer_po', 'buyer_po_number',
            'created_by_name', 'items_count', 'created_at',
        ]

    def get_items_count(self, obj):
        return obj.items.count()

    def get_payment_due_date(self, obj):
        due = compute_payment_due_date(obj)
        return due.isoformat() if due else None


class POReceiptItemSerializer(serializers.ModelSerializer):
    po_item_details = serializers.SerializerMethodField()

    class Meta:
        model = POReceiptItem
        fields = '__all__'
        read_only_fields = ('created_at',)

    def get_po_item_details(self, obj):
        po_item = obj.po_item
        if po_item.item_id:
            return {
                'item_code': po_item.item.item_code,
                'item_name': po_item.item.name,
                'quantity_ordered': po_item.quantity_ordered,
                'quantity_pending': po_item.quantity_pending,
            }
        return {
            'item_code': '',
            'item_name': po_item.particulars or (po_item.trim.name if po_item.trim_id else ''),
            'quantity_ordered': po_item.quantity_ordered,
            'quantity_pending': po_item.quantity_pending,
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

            if po_item.item_id:
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
