from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from suppliers.models import Supplier
from .models import (
    PurchaseOrder, PurchaseOrderItem, POReceipt, POReceiptItem,
    PurchaseBill, PurchaseBillLine, PurchaseBillDocument,
)
from .po_numbering import next_supplier_po_number
from .bill_numbering import next_purchase_bill_ref
from .payment_due import compute_payment_due_date, compute_bill_due_date, parse_payment_days
from .stock_receive import post_purchase_bill_to_stock, reverse_purchase_bill_stock
from inventory.models import InventoryLog
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


def _sync_reference_strings(validated_data, instance=None):
    """
    Store PI / Buyer PO as free-text numbers.
    Optional FKs may be set when the user picks an existing record; they are never
    required, and typed values are never used to create new PI / Buyer PO rows.
    """
    pi = validated_data['pi'] if 'pi' in validated_data else (instance.pi if instance else None)
    buyer_po = validated_data['buyer_po'] if 'buyer_po' in validated_data else (
        instance.buyer_po if instance else None
    )

    if 'pi_number' in validated_data:
        pi_number = (validated_data.get('pi_number') or '').strip()
    elif instance is not None:
        pi_number = (instance.pi_number or '').strip()
    else:
        pi_number = ''
    if not pi_number and pi is not None:
        pi_number = getattr(pi, 'pi_number', '') or ''
    validated_data['pi_number'] = pi_number

    if 'reference_number' in validated_data:
        reference_number = (validated_data.get('reference_number') or '').strip()
    elif instance is not None:
        reference_number = (instance.reference_number or '').strip()
    else:
        reference_number = ''
    if not reference_number and buyer_po is not None:
        reference_number = getattr(buyer_po, 'po_number', '') or ''
    validated_data['reference_number'] = reference_number
    return validated_data


def _display_pi_number(obj):
    return (obj.pi_number or '').strip() or (obj.pi.pi_number if obj.pi_id else '')


def _display_buyer_po_number(obj):
    return (obj.reference_number or '').strip() or (obj.buyer_po.po_number if obj.buyer_po_id else '')


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
    buyer_po_number = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    payment_due_date = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = (
            'created_by', 'created_at', 'updated_at',
            'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'total_amount',
        )

    def get_buyer_po_number(self, obj):
        return _display_buyer_po_number(obj)

    def get_payment_due_date(self, obj):
        due = compute_payment_due_date(obj)
        return due.isoformat() if due else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['pi_number'] = _display_pi_number(instance)
        data['buyer_po_number'] = _display_buyer_po_number(instance)
        return data

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        validated_data = _sync_supplier_fields(validated_data)
        validated_data = _sync_reference_strings(validated_data)
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
        validated_data = _sync_reference_strings(validated_data, instance)

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
    buyer_po_number = serializers.SerializerMethodField()
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    items_count = serializers.SerializerMethodField()
    payment_due_date = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'vendor_name', 'supplier', 'supplier_name',
            'order_date', 'expected_delivery_date', 'payment_due_date', 'payment_terms',
            'transport_paid_by', 'status', 'subtotal', 'total_amount', 'reference_number',
            'pi', 'pi_number', 'buyer_po', 'buyer_po_number',
            'created_by_name', 'items_count', 'created_at',
        ]

    def get_buyer_po_number(self, obj):
        return _display_buyer_po_number(obj)

    def get_items_count(self, obj):
        return obj.items.count()

    def get_payment_due_date(self, obj):
        due = compute_payment_due_date(obj)
        return due.isoformat() if due else None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['pi_number'] = _display_pi_number(instance)
        data['buyer_po_number'] = _display_buyer_po_number(instance)
        return data

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


class PurchaseBillLineSerializer(serializers.ModelSerializer):
    trim_name = serializers.CharField(source='trim.name', read_only=True)
    quantity_ordered = serializers.SerializerMethodField()
    quantity_received_previous = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseBillLine
        fields = [
            'id', 'bill', 'po_item', 'serial_no', 'trim', 'trim_name', 'particulars', 'hsn_code',
            'quantity_billed', 'quantity_ordered', 'quantity_received_previous',
            'unit', 'unit_price', 'total_price',
        ]
        read_only_fields = ('bill', 'total_price', 'quantity_ordered', 'quantity_received_previous', 'trim_name')

    def get_quantity_ordered(self, obj):
        if obj.po_item_id:
            return obj.po_item.quantity_ordered
        return None

    def get_quantity_received_previous(self, obj):
        if not obj.po_item_id:
            return None
        prev = (obj.po_item.quantity_received or Decimal('0')) - (obj.quantity_billed or Decimal('0'))
        return max(Decimal('0'), prev)

    def validate(self, attrs):
        if not attrs.get('trim') and not (attrs.get('particulars') or '').strip():
            raise serializers.ValidationError('Each line needs a trim or particulars description.')
        return attrs


def _clean_bill_line_data(item_data):
    item_data = {**item_data}
    for key in ('quantity_ordered', 'quantity_received_previous', 'trim_name', 'total_price', 'id', 'bill'):
        item_data.pop(key, None)
    return item_data


def _should_post_bill_stock(bill):
    return bill.status not in ('DRAFT', 'CANCELLED')


def _default_bill_due_date(validated_data):
    """Compute purchase-bill due date from payment terms + bill/received date."""
    if validated_data.get('due_date'):
        return validated_data['due_date']

    po = validated_data.get('purchase_order')
    if po and not hasattr(po, 'payment_terms'):
        from .models import PurchaseOrder
        try:
            po = PurchaseOrder.objects.get(pk=po)
        except PurchaseOrder.DoesNotExist:
            po = None

    terms = (validated_data.get('payment_terms') or '').strip()
    if not terms and po is not None:
        terms = (po.payment_terms or '').strip()

    bill_date = validated_data.get('bill_date')
    received = validated_data.get('received_date') or bill_date
    days = parse_payment_days(terms)
    if days is not None:
        terms_u = terms.upper()
        # Receipt/delivery-linked terms use goods date; otherwise invoice/bill date.
        if any(k in terms_u for k in ('DELIVERY', 'RECEIPT', 'GRN', 'DISPATCH', 'SUPPLY')):
            base = received or bill_date
        else:
            base = bill_date or received
        if base:
            from datetime import timedelta
            return base + timedelta(days=days)

    # Fallback: keep previous PO-anchor behaviour when terms are free text without days
    if po and received:
        class _Anchor:
            payment_terms = terms
            order_date = bill_date or po.order_date
            expected_delivery_date = received
            actual_delivery_date = received
        due = compute_payment_due_date(_Anchor())
        if due:
            return due
    return bill_date


class PurchaseBillDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)
    display_label = serializers.CharField(read_only=True)

    class Meta:
        model = PurchaseBillDocument
        fields = [
            'id', 'document_type', 'label', 'display_label',
            'file', 'file_url', 'file_name', 'uploaded_at', 'uploaded_by_name',
        ]
        read_only_fields = fields

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get('request')
        if request:
            return request.build_absolute_uri(obj.file.url)
        return obj.file.url

    def get_file_name(self, obj):
        if not obj.file:
            return ''
        return obj.file.name.rsplit('/', 1)[-1]


class PurchaseBillSerializer(serializers.ModelSerializer):
    items = PurchaseBillLineSerializer(many=True, required=False)
    documents = PurchaseBillDocumentSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    supplier_name_display = serializers.CharField(source='supplier.name', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    balance_due = serializers.SerializerMethodField()
    payment_due_date = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseBill
        fields = '__all__'
        read_only_fields = (
            'created_by', 'created_at', 'updated_at',
            'subtotal', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'total_amount',
        )

    def get_balance_due(self, obj):
        return str(obj.balance_due)

    def get_payment_due_date(self, obj):
        due = compute_bill_due_date(obj)
        return due.isoformat() if due else None

    def validate(self, attrs):
        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        supplier = validated_data.get('supplier')
        if supplier and not validated_data.get('supplier_name'):
            validated_data['supplier_name'] = supplier.name if hasattr(supplier, 'name') else str(supplier)
        if not (validated_data.get('internal_ref') or '').strip():
            validated_data['internal_ref'] = next_purchase_bill_ref()['internal_ref']
        validated_data['due_date'] = _default_bill_due_date(validated_data)
        if validated_data.get('status') not in ('DRAFT', 'CANCELLED'):
            validated_data['status'] = 'OPEN'
        bill = PurchaseBill.objects.create(**validated_data)
        for idx, item_data in enumerate(items_data, start=1):
            item_data = _clean_bill_line_data(item_data)
            if not item_data.get('serial_no'):
                item_data['serial_no'] = idx
            PurchaseBillLine.objects.create(bill=bill, **item_data)
        bill.recalculate_totals()
        if bill.status != 'DRAFT':
            bill.sync_payment_status()
        if _should_post_bill_stock(bill):
            post_purchase_bill_to_stock(bill, self.context['request'].user)
        return bill

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        supplier = validated_data.get('supplier', instance.supplier)
        if supplier and not validated_data.get('supplier_name'):
            validated_data['supplier_name'] = supplier.name if hasattr(supplier, 'name') else instance.supplier_name
        if 'due_date' not in validated_data or not validated_data.get('due_date'):
            merged = {**{f.name: getattr(instance, f.name) for f in instance._meta.fields}, **validated_data}
            validated_data['due_date'] = _default_bill_due_date(merged)

        if InventoryLog.objects.filter(reference_type='BILL', reference_id=str(instance.id)).exists():
            reverse_purchase_bill_stock(instance)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data, start=1):
                item_data = _clean_bill_line_data(item_data)
                if not item_data.get('serial_no'):
                    item_data['serial_no'] = idx
                PurchaseBillLine.objects.create(bill=instance, **item_data)

        instance.recalculate_totals()
        if instance.status != 'DRAFT' and instance.status != 'CANCELLED':
            instance.sync_payment_status()
        if _should_post_bill_stock(instance):
            post_purchase_bill_to_stock(instance, self.context['request'].user)
        return instance


class PurchaseBillListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    po_number = serializers.CharField(source='purchase_order.po_number', read_only=True)
    balance_due = serializers.SerializerMethodField()
    payment_due_date = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseBill
        fields = [
            'id', 'internal_ref', 'bill_number', 'supplier', 'supplier_name',
            'purchase_order', 'po_number', 'bill_date', 'received_date',
            'due_date', 'payment_due_date', 'payment_terms', 'status',
            'subtotal', 'total_amount', 'amount_paid', 'balance_due',
            'created_by_name', 'items_count', 'created_at',
        ]

    def get_balance_due(self, obj):
        return str(obj.balance_due)

    def get_payment_due_date(self, obj):
        due = compute_bill_due_date(obj)
        return due.isoformat() if due else None

    def get_items_count(self, obj):
        return obj.items.count()

