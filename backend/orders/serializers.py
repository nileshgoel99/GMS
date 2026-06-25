from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from customers.models import Customer
from customers.serializers import CustomerListSerializer

from .models import (
    ProformaInvoice,
    ProformaInvoiceLine,
    TrimMaster,
    Indent,
    IndentFabricLine,
    IndentTrimLine,
    ItemIndentTemplate,
    BuyerPO,
    BuyerPOLine,
    SalesEntry,
    SalesEntryLine,
)


# ---------------------------------------------------------------------------
# ProformaInvoice serializers
# ---------------------------------------------------------------------------

class ProformaInvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProformaInvoiceLine
        fields = [
            'id', 'line_number', 'item_code', 'item_name', 'description',
            'material', 'color', 'size_breakdown', 'quantity_pcs',
            'unit_price_usd', 'line_value_usd', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')


def _sync_client_fields_from_customer(customer):
    if customer is None:
        return {}
    return {
        'client_name':    customer.company_legal_name or '',
        'client_email':   customer.primary_email or '',
        'client_phone':   customer.phone or '',
        'client_address': '\n'.join(filter(None, [
            customer.address_line1,
            customer.address_line2,
            customer.city,
            customer.region_state,
            customer.country,
        ])),
    }


def _normalize_lines_payload(lines_data):
    out = []
    for i, row in enumerate(lines_data, start=1):
        row = {**row}
        row['line_number'] = i
        row.setdefault('item_code', '')
        row.setdefault('item_name', '')
        row.setdefault('description', '')
        row.setdefault('material', '')
        row.setdefault('color', '')
        row.setdefault('size_breakdown', [])
        row.setdefault('quantity_pcs', 0)
        row.setdefault('unit_price_usd', None)
        row.setdefault('line_value_usd', None)
        if row['line_value_usd'] is None and row['unit_price_usd'] is not None:
            qty = int(row.get('quantity_pcs', 0) or 0)
            if qty:
                row['line_value_usd'] = (
                    Decimal(str(row['unit_price_usd'])) * qty
                ).quantize(Decimal('0.01'))
        out.append(row)
    return out


def _rollup_header_from_lines(lines):
    total_qty = sum(int(r.get('quantity_pcs', 0) or 0) for r in lines)
    total_amount = Decimal('0')
    for row in lines:
        lv = row.get('line_value_usd')
        if lv is not None:
            total_amount += Decimal(str(lv))
        elif row.get('unit_price_usd') is not None:
            qty = int(row.get('quantity_pcs', 0) or 0)
            if qty:
                total_amount += Decimal(str(row['unit_price_usd'])) * qty
    names = [r['item_name'] for r in lines if r.get('item_name')]
    unique_names = list(dict.fromkeys(names))
    garment_type = ', '.join(unique_names[:3])
    if len(unique_names) > 3:
        garment_type += f' +{len(unique_names) - 3} more'
    return {
        'quantity': total_qty,
        'garment_type': garment_type,
        'total_amount': total_amount.quantize(Decimal('0.01')) if total_amount else None,
    }


def _sync_pi_totals(pi):
    """Recompute line values and header total/qty from PI lines."""
    total_amount = Decimal('0')
    total_qty = 0
    for line in pi.lines.all().order_by('line_number'):
        if line.line_value_usd is None and line.unit_price_usd is not None and line.quantity_pcs:
            line.line_value_usd = (
                Decimal(line.unit_price_usd) * line.quantity_pcs
            ).quantize(Decimal('0.01'))
            line.save(update_fields=['line_value_usd'])
        total_qty += line.quantity_pcs or 0
        if line.line_value_usd is not None:
            total_amount += Decimal(line.line_value_usd)
    pi.quantity = total_qty
    pi.total_amount = total_amount.quantize(Decimal('0.01')) if total_amount else None
    pi.save(update_fields=['quantity', 'total_amount'])
    return pi


class BuyerPOSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = BuyerPO
        fields = [
            'id', 'po_number', 'currency', 'payment_terms', 'delivery_terms',
            'inco_terms', 'port_of_loading', 'port_of_discharge', 'ex_factory_date',
        ]


class ProformaInvoiceSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    customer_display = CustomerListSerializer(source='customer', read_only=True)
    lines = ProformaInvoiceLineSerializer(many=True, required=False)
    buyer_pos = BuyerPOSummarySerializer(many=True, read_only=True)

    class Meta:
        model = ProformaInvoice
        fields = '__all__'
        read_only_fields = (
            'created_by',
            'created_at',
            'updated_at',
            'client_name',
            'client_email',
            'client_phone',
            'client_address',
            'quantity',
            'garment_type',
            'unit_price',
            'total_amount',
        )

    def validate(self, attrs):
        request_lines = attrs.get('lines', serializers.empty)
        if self.instance is None:
            if request_lines is serializers.empty or not request_lines:
                raise serializers.ValidationError({'lines': 'At least one line item is required.'})
            if not attrs.get('customer'):
                raise serializers.ValidationError({'customer': 'Select a customer.'})
        elif request_lines is not serializers.empty and not request_lines:
            raise serializers.ValidationError({'lines': 'Add at least one line item.'})
        return attrs

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        cust = validated_data.get('customer')
        validated_data.update(_sync_client_fields_from_customer(cust))
        normalized = _normalize_lines_payload(lines_data)
        validated_data.update(_rollup_header_from_lines(normalized))
        pi = ProformaInvoice.objects.create(**validated_data)
        for row in normalized:
            ProformaInvoiceLine.objects.create(
                pi=pi,
                line_number=row['line_number'],
                item_code=row['item_code'],
                item_name=row['item_name'],
                description=row['description'],
                material=row['material'],
                color=row['color'],
                size_breakdown=row['size_breakdown'],
                quantity_pcs=row['quantity_pcs'],
                unit_price_usd=row['unit_price_usd'],
                line_value_usd=row['line_value_usd'],
            )
        _sync_pi_totals(pi)
        return pi

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)

        cust = validated_data.get('customer', instance.customer)
        if cust is not None:
            validated_data.update(_sync_client_fields_from_customer(cust))

        if lines_data is not None:
            normalized = _normalize_lines_payload(lines_data)
            validated_data.update(_rollup_header_from_lines(normalized))
            instance.lines.all().delete()
            for row in normalized:
                ProformaInvoiceLine.objects.create(
                    pi=instance,
                    line_number=row['line_number'],
                    item_code=row['item_code'],
                    item_name=row['item_name'],
                    description=row['description'],
                    material=row['material'],
                    color=row['color'],
                    size_breakdown=row['size_breakdown'],
                    quantity_pcs=row['quantity_pcs'],
                    unit_price_usd=row['unit_price_usd'],
                    line_value_usd=row['line_value_usd'],
                )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            _sync_pi_totals(instance)
        return instance


class ProformaInvoiceListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    indents_count = serializers.SerializerMethodField()
    lines_count = serializers.SerializerMethodField()
    customer_id = serializers.IntegerField(read_only=True, allow_null=True)
    customer_code = serializers.CharField(source='customer.customer_code', read_only=True, allow_null=True)
    linked_po_id = serializers.SerializerMethodField()

    class Meta:
        model = ProformaInvoice
        fields = [
            'id', 'pi_number', 'buyer_po_number', 'customer_id', 'customer_code', 'client_name', 'order_date',
            'delivery_date', 'garment_type', 'quantity', 'total_amount', 'status', 'created_by_name',
            'indents_count', 'lines_count', 'linked_po_id', 'created_at',
        ]

    def get_indents_count(self, obj):
        return obj.indents.count()

    def get_lines_count(self, obj):
        return obj.lines.count()

    def get_linked_po_id(self, obj):
        po = obj.buyer_pos.order_by('id').first()
        return po.id if po else None


# ---------------------------------------------------------------------------
# Indent / TrimMaster serializers
# ---------------------------------------------------------------------------

class TrimMasterSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default='')
    supplier_country = serializers.CharField(source='supplier.country', read_only=True, default='')

    class Meta:
        model = TrimMaster
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')


class IndentFabricLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndentFabricLine
        fields = [
            'id', 'material', 'color', 'gsm', 'roll_width', 'consumption_per_pc', 'unit',
            'total_consumption', 'remarks', 'sort_order',
        ]
        read_only_fields = ('id',)


class IndentTrimLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndentTrimLine
        fields = [
            'id', 'trim', 'trim_name', 'category', 'color_variant', 'size_variant',
            'property_values',
            'consumption_per_pc', 'unit', 'total_consumption', 'total_unit', 'remarks', 'sort_order',
        ]
        read_only_fields = ('id',)


class IndentSerializer(serializers.ModelSerializer):
    fabric_lines = IndentFabricLineSerializer(many=True, required=False)
    trim_lines = IndentTrimLineSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    pi_lines = serializers.SerializerMethodField()

    class Meta:
        model = Indent
        fields = [
            'id', 'pi', 'pi_number', 'pi_lines', 'selected_pi_line_ids',
            'indent_number', 'indent_date', 'status',
            'pcs_per_carton', 'carton_ply', 'carton_dimensions',
            'prepared_by', 'received_by', 'approved_by', 'notes',
            'fabric_lines', 'trim_lines',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def get_pi_lines(self, obj):
        return ProformaInvoiceLineSerializer(obj.pi.lines.all(), many=True).data

    def _save_lines(self, indent, fabric_data, trim_data):
        indent.fabric_lines.all().delete()
        for i, row in enumerate(fabric_data or []):
            row.pop('id', None)
            IndentFabricLine.objects.create(indent=indent, sort_order=i, **row)

        indent.trim_lines.all().delete()
        for i, row in enumerate(trim_data or []):
            row.pop('id', None)
            trim_fk = row.pop('trim', None)
            if trim_fk and hasattr(trim_fk, 'pk'):
                trim_fk = trim_fk.pk
            IndentTrimLine.objects.create(indent=indent, trim_id=trim_fk, sort_order=i, **row)

    def _upsert_templates(self, indent):
        """Store fabric+trim defaults keyed by item_name for future auto-fill."""
        line_ids = indent.selected_pi_line_ids or []
        selected_lines = indent.pi.lines.filter(id__in=line_ids) if line_ids else indent.pi.lines.all()
        item_names = list(selected_lines.values_list('item_name', flat=True).distinct())
        fabric_snapshot = [
            {k: str(v) if hasattr(v, 'as_tuple') else v
             for k, v in {
                'material': fl.material, 'color': fl.color, 'roll_width': fl.roll_width,
                'consumption_per_pc': fl.consumption_per_pc,
                'unit': fl.unit, 'remarks': fl.remarks,
             }.items()}
            for fl in indent.fabric_lines.all()
        ]
        trim_snapshot = [
            {
                'trim': tl.trim_id,
                'trim_name': tl.trim_name, 'category': tl.category,
                'color_variant': tl.color_variant, 'size_variant': tl.size_variant,
                'property_values': tl.property_values or {},
                'consumption_per_pc': str(tl.consumption_per_pc),
                'unit': tl.unit, 'total_unit': tl.total_unit, 'remarks': tl.remarks,
            }
            for tl in indent.trim_lines.all()
        ]
        for name in item_names:
            ItemIndentTemplate.objects.update_or_create(
                item_name=name,
                defaults={'fabric_lines': fabric_snapshot, 'trim_lines': trim_snapshot},
            )

    def create(self, validated_data):
        fabric_data = validated_data.pop('fabric_lines', [])
        trim_data = validated_data.pop('trim_lines', [])
        indent = Indent.objects.create(**validated_data)
        self._save_lines(indent, fabric_data, trim_data)
        self._upsert_templates(indent)
        return indent

    def update(self, instance, validated_data):
        fabric_data = validated_data.pop('fabric_lines', None)
        trim_data = validated_data.pop('trim_lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if fabric_data is not None or trim_data is not None:
            self._save_lines(
                instance,
                fabric_data if fabric_data is not None else list(instance.fabric_lines.values()),
                trim_data if trim_data is not None else list(instance.trim_lines.values()),
            )
            self._upsert_templates(instance)
        return instance


class IndentListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    pi_ref = serializers.SerializerMethodField()
    item_name = serializers.SerializerMethodField()
    total_qty = serializers.SerializerMethodField()
    fabric_count = serializers.SerializerMethodField()
    trim_count = serializers.SerializerMethodField()

    class Meta:
        model = Indent
        fields = [
            'id', 'indent_number', 'pi', 'pi_number', 'pi_ref',
            'item_name', 'total_qty', 'status', 'indent_date',
            'fabric_count', 'trim_count', 'created_by_name', 'created_at',
        ]

    def get_pi_ref(self, obj):
        po = obj.pi.buyer_pos.order_by('id').first()
        return po.po_number if po else None

    def get_item_name(self, obj):
        names = list(obj.pi.lines.values_list('item_name', flat=True).distinct())
        return ', '.join(names[:2]) + (f' +{len(names)-2} more' if len(names) > 2 else '')

    def get_total_qty(self, obj):
        return obj.pi.lines.aggregate(s=Sum('quantity_pcs'))['s'] or 0

    def get_fabric_count(self, obj):
        return obj.fabric_lines.count()

    def get_trim_count(self, obj):
        return obj.trim_lines.count()


class ItemIndentTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemIndentTemplate
        fields = '__all__'
        read_only_fields = ('id', 'updated_at')


# ---------------------------------------------------------------------------
# Buyer PO serializers
# ---------------------------------------------------------------------------

class BuyerPOLineSerializer(serializers.ModelSerializer):
    line_amount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False, allow_null=True)

    class Meta:
        model = BuyerPOLine
        fields = [
            'id', 'line_number', 'item_code', 'item_name', 'fabric', 'color',
            'customer_ref', 'agreement_no', 'size_breakdown', 'quantity',
            'uom', 'unit_price', 'discount', 'delivery_date', 'line_amount', 'notes',
        ]
        read_only_fields = ('id',)


class BuyerPOListSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    lines_count = serializers.SerializerMethodField()
    pi_id = serializers.IntegerField(source='pi.id', read_only=True, allow_null=True)

    class Meta:
        model = BuyerPO
        fields = [
            'id', 'po_number', 'po_date', 'buyer_name', 'buyer_contact',
            'customer', 'customer_name', 'currency', 'status',
            'ex_factory_date', 'total_qty', 'total_value', 'lines_count',
            'po_document', 'pi_ref', 'pi_id', 'created_at',
        ]

    def get_customer_name(self, obj):
        return obj.customer.company_legal_name if obj.customer else None

    def get_lines_count(self, obj):
        return obj.lines.count()


class BuyerPOSerializer(serializers.ModelSerializer):
    lines = BuyerPOLineSerializer(many=True)
    customer_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    indent_count = serializers.SerializerMethodField()

    class Meta:
        model = BuyerPO
        fields = [
            'id', 'po_number', 'po_date',
            'customer', 'customer_name', 'buyer_name', 'buyer_address',
            'buyer_contact', 'supplier_code', 'currency',
            'delivery_terms', 'payment_terms', 'delivery_method',
            'freight_terms', 'packaging_terms', 'ex_factory_date',
            'total_qty', 'total_value', 'status', 'notes', 'pi',
            'po_document', 'pi_ref', 'indent_count',
            'inco_terms', 'port_of_loading', 'port_of_discharge',
            'lines', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def get_customer_name(self, obj):
        return obj.customer.company_legal_name if obj.customer else None

    def get_indent_count(self, obj):
        if not obj.pi_id:
            return 0
        return obj.pi.indents.count()

    def _save_lines(self, po, lines_data):
        po.lines.all().delete()
        for i, line_data in enumerate(lines_data, start=1):
            line_data.pop('id', None)
            sizes = line_data.get('size_breakdown') or []
            if sizes:
                line_data['quantity'] = sum(s.get('qty', 0) for s in sizes)
            qty = line_data.get('quantity', 0)
            price = line_data.get('unit_price')
            disc = line_data.get('discount')
            if price is not None and qty:
                gross = Decimal(str(price)) * qty
                if disc is not None:
                    gross = gross * (1 - Decimal(str(disc)) / 100)
                line_data['line_amount'] = gross.quantize(Decimal('0.01'))
            BuyerPOLine.objects.create(po=po, line_number=i, **line_data)

    def _update_totals(self, po):
        agg = po.lines.aggregate(total_qty=Sum('quantity'), total_value=Sum('line_amount'))
        po.total_qty = agg['total_qty'] or 0
        po.total_value = agg['total_value']
        po.save(update_fields=['total_qty', 'total_value'])

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        po = BuyerPO.objects.create(**validated_data)
        self._save_lines(po, lines_data)
        self._update_totals(po)
        return po

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            self._save_lines(instance, lines_data)
            self._update_totals(instance)
        return instance


from .sales_numbering import next_sales_entry_ref
from .sales_receivable import compute_sales_due_date


class SalesEntryLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = SalesEntryLine
        fields = '__all__'
        read_only_fields = ('sales_entry', 'total_price')

    def validate(self, attrs):
        if not (attrs.get('item_name') or '').strip() and not (attrs.get('item_code') or '').strip():
            raise serializers.ValidationError('Each line needs an item name or code.')
        return attrs


def _default_sales_due_date(validated_data):
    if validated_data.get('due_date'):
        return validated_data['due_date']
    sale_date = validated_data.get('sale_date')
    terms = validated_data.get('payment_terms') or ''
    if sale_date and terms:
        from datetime import timedelta
        from procurement.payment_due import parse_payment_days
        days = parse_payment_days(terms)
        if days is not None:
            return sale_date + timedelta(days=days)
    buyer_po = validated_data.get('buyer_po')
    if buyer_po and hasattr(buyer_po, 'ex_factory_date') and buyer_po.ex_factory_date:
        return buyer_po.ex_factory_date
    return sale_date


class SalesEntrySerializer(serializers.ModelSerializer):
    items = SalesEntryLineSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    buyer_po_number = serializers.CharField(source='buyer_po.po_number', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    balance_due = serializers.SerializerMethodField()
    collection_due_date = serializers.SerializerMethodField()

    class Meta:
        model = SalesEntry
        fields = '__all__'
        read_only_fields = (
            'created_by', 'created_at', 'updated_at', 'subtotal', 'total_amount',
        )

    def get_balance_due(self, obj):
        return str(obj.balance_due)

    def get_collection_due_date(self, obj):
        due = compute_sales_due_date(obj)
        return due.isoformat() if due else None

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        customer = validated_data.get('customer')
        if customer and not validated_data.get('customer_name'):
            validated_data['customer_name'] = getattr(customer, 'company_legal_name', str(customer))
        if not (validated_data.get('internal_ref') or '').strip():
            validated_data['internal_ref'] = next_sales_entry_ref()['internal_ref']
        validated_data['due_date'] = _default_sales_due_date(validated_data)
        if validated_data.get('status') not in ('DRAFT', 'CANCELLED'):
            validated_data['status'] = 'OPEN'
        entry = SalesEntry.objects.create(**validated_data)
        for idx, item_data in enumerate(items_data, start=1):
            item_data.pop('id', None)
            item_data.pop('sales_entry', None)
            if not item_data.get('serial_no'):
                item_data['serial_no'] = idx
            SalesEntryLine.objects.create(sales_entry=entry, **item_data)
        entry.recalculate_totals()
        if entry.status != 'DRAFT':
            entry.sync_collection_status()
        return entry

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        customer = validated_data.get('customer', instance.customer)
        if customer and not validated_data.get('customer_name'):
            validated_data['customer_name'] = getattr(customer, 'company_legal_name', instance.customer_name)
        if 'due_date' not in validated_data or not validated_data.get('due_date'):
            merged = {**{f.name: getattr(instance, f.name) for f in instance._meta.fields}, **validated_data}
            validated_data['due_date'] = _default_sales_due_date(merged)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data, start=1):
                item_data.pop('id', None)
                item_data.pop('sales_entry', None)
                if not item_data.get('serial_no'):
                    item_data['serial_no'] = idx
                SalesEntryLine.objects.create(sales_entry=instance, **item_data)
        instance.recalculate_totals()
        if instance.status not in ('DRAFT', 'CANCELLED'):
            instance.sync_collection_status()
        return instance


class SalesEntryListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    buyer_po_number = serializers.CharField(source='buyer_po.po_number', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    balance_due = serializers.SerializerMethodField()
    collection_due_date = serializers.SerializerMethodField()
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = SalesEntry
        fields = [
            'id', 'internal_ref', 'invoice_number', 'customer', 'customer_name',
            'buyer_po', 'buyer_po_number', 'pi', 'pi_number', 'currency',
            'sale_date', 'due_date', 'collection_due_date', 'payment_terms', 'status',
            'subtotal', 'total_amount', 'amount_received', 'balance_due',
            'created_by_name', 'items_count', 'created_at',
        ]

    def get_balance_due(self, obj):
        return str(obj.balance_due)

    def get_collection_due_date(self, obj):
        due = compute_sales_due_date(obj)
        return due.isoformat() if due else None

    def get_items_count(self, obj):
        return obj.items.count()

