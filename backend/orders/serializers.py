from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from customers.models import Customer
from customers.serializers import CustomerListSerializer

from .models import (
    ProformaInvoice,
    ProformaInvoiceLine,
    PlanningSheet,
    Intent,
    IntentSheet,
    IntentLine,
    IntentAttachment,
)


class PlanningSheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanningSheet
        fields = '__all__'
        read_only_fields = ('id', 'pi', 'created_at', 'updated_at')


class ProformaInvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProformaInvoiceLine
        fields = [
            'id',
            'line_number',
            'item_name',
            'description',
            'material',
            'color',
            'size_breakdown',
            'quantity_pcs',
            'unit_price_usd',
            'line_value_usd',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ('id', 'line_number', 'created_at', 'updated_at')


def _rollup_header_from_lines(lines_normalized):
    total_qty = sum(int(l['quantity_pcs'] or 0) for l in lines_normalized)
    total_val = Decimal('0')
    for l in lines_normalized:
        v = l.get('line_value_usd')
        if v is not None:
            total_val += Decimal(str(v))
    names = [l['item_name'] for l in lines_normalized if l.get('item_name')]
    summary = ', '.join(names[:4])
    if len(names) > 4:
        summary += '…'
    unit_avg = None
    if total_qty and total_val > 0:
        unit_avg = (total_val / Decimal(total_qty)).quantize(Decimal('0.01'))
    return {
        'quantity': total_qty,
        'total_amount': total_val if total_val > 0 else None,
        'garment_type': (summary or '')[:500],
        'unit_price': unit_avg,
    }


def _normalize_lines_payload(lines_data):
    out = []
    for i, raw in enumerate(lines_data, start=1):
        row = {**raw}
        row.pop('id', None)
        row.pop('pi', None)
        row.pop('created_at', None)
        row.pop('updated_at', None)
        item_name = (row.get('item_name') or '').strip()
        if not item_name:
            raise serializers.ValidationError({'lines': f'Line {i}: item name is required.'})
        qty = int(row.get('quantity_pcs') or 0)
        price_raw = row.get('unit_price_usd')
        price = None
        if price_raw is not None and str(price_raw).strip() != '':
            price = Decimal(str(price_raw)).quantize(Decimal('0.01'))
        line_val = row.get('line_value_usd')
        if line_val is not None and str(line_val).strip() != '':
            line_val = Decimal(str(line_val)).quantize(Decimal('0.01'))
        elif price is not None:
            line_val = (Decimal(qty) * price).quantize(Decimal('0.01'))
        else:
            line_val = None
        sb = row.get('size_breakdown') or []
        if not isinstance(sb, list):
            sb = []
        mat = row.get('material') or ''
        if not isinstance(mat, str):
            mat = str(mat)
        desc = row.get('description') or ''
        if not isinstance(desc, str):
            desc = str(desc)
        out.append({
            'line_number': i,
            'item_name': item_name[:300],
            'description': desc[:8000],
            'material': mat[:5000],
            'color': (row.get('color') or '')[:120],
            'size_breakdown': sb,
            'quantity_pcs': qty,
            'unit_price_usd': price,
            'line_value_usd': line_val,
        })
    return out


def _sync_client_fields_from_customer(customer):
    """Populate PI client_* snapshot from Customer."""
    if customer is None:
        return {}
    if isinstance(customer, int):
        customer = Customer.objects.get(pk=customer)
    address_parts = [
        customer.address_line1,
        customer.address_line2,
        ' '.join(filter(None, [customer.postal_code or '', customer.city or ''])).strip(),
        customer.region_state,
        customer.country,
    ]
    address = '\n'.join(p for p in address_parts if p)
    display = customer.display_name or customer.company_legal_name
    return {
        'client_name': (customer.company_legal_name or display or '')[:200],
        'client_email': customer.primary_email or '',
        'client_phone': (customer.phone or customer.mobile or '')[:20],
        'client_address': address or '',
    }


class ProformaInvoiceSerializer(serializers.ModelSerializer):
    planning_sheet = PlanningSheetSerializer(required=False, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    customer_display = CustomerListSerializer(source='customer', read_only=True)
    lines = ProformaInvoiceLineSerializer(many=True, required=False)

    class Meta:
        model = ProformaInvoice
        fields = '__all__'
        read_only_fields = (
            'created_by',
            'created_at',
            'updated_at',
            # Bill-to snapshot — always derived from Customer in create()/update()
            'client_name',
            'client_email',
            'client_phone',
            'client_address',
            # Header rollups from PI lines
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
        planning_sheet_data = validated_data.pop('planning_sheet', None)
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
                item_name=row['item_name'],
                description=row['description'],
                material=row['material'],
                color=row['color'],
                size_breakdown=row['size_breakdown'],
                quantity_pcs=row['quantity_pcs'],
                unit_price_usd=row['unit_price_usd'],
                line_value_usd=row['line_value_usd'],
            )
        if planning_sheet_data:
            PlanningSheet.objects.create(pi=pi, **planning_sheet_data)
        return pi

    def update(self, instance, validated_data):
        planning_sheet_data = validated_data.pop('planning_sheet', None)
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

        if planning_sheet_data:
            if hasattr(instance, 'planning_sheet'):
                for attr, value in planning_sheet_data.items():
                    setattr(instance.planning_sheet, attr, value)
                instance.planning_sheet.save()
            else:
                PlanningSheet.objects.create(pi=instance, **planning_sheet_data)

        return instance


class ProformaInvoiceListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    has_planning_sheet = serializers.SerializerMethodField()
    intents_count = serializers.SerializerMethodField()
    lines_count = serializers.SerializerMethodField()
    customer_id = serializers.IntegerField(read_only=True, allow_null=True)
    customer_code = serializers.CharField(source='customer.customer_code', read_only=True, allow_null=True)

    class Meta:
        model = ProformaInvoice
        fields = [
            'id', 'pi_number', 'buyer_po_number', 'customer_id', 'customer_code', 'client_name', 'order_date',
            'delivery_date', 'garment_type', 'quantity', 'total_amount', 'status', 'created_by_name',
            'has_planning_sheet', 'intents_count', 'lines_count', 'created_at',
        ]

    def get_has_planning_sheet(self, obj):
        return hasattr(obj, 'planning_sheet')

    def get_intents_count(self, obj):
        return obj.intents.count()

    def get_lines_count(self, obj):
        return obj.lines.count()


class IntentAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.username', read_only=True)

    class Meta:
        model = IntentAttachment
        fields = '__all__'
        read_only_fields = ('uploaded_by', 'uploaded_at')


class IntentLineSerializer(serializers.ModelSerializer):
    qty_ordered_on_pos = serializers.SerializerMethodField()
    qty_remaining_to_order = serializers.SerializerMethodField()

    class Meta:
        model = IntentLine
        fields = '__all__'
        read_only_fields = ('created_at', 'updated_at', 'intent', 'sheet')

    def get_qty_ordered_on_pos(self, obj):
        from procurement.models import PurchaseOrderItem

        total = PurchaseOrderItem.objects.filter(intent_line=obj).aggregate(
            s=Sum('quantity_ordered')
        )['s']
        return total or Decimal('0')

    def get_qty_remaining_to_order(self, obj):
        ordered = self.get_qty_ordered_on_pos(obj)
        return max(Decimal('0'), obj.total_required - ordered)


def _rollup_intent_header_from_sheets(intent):
    """Copy sheet labels / totals to legacy header fields (lists, reporting)."""
    if not intent.pk:
        return
    sheets = list(intent.sheets.all().order_by('sort_order', 'id'))
    if not sheets:
        intent.garment_sheet_name = ''
        intent.total_garment_qty = 0
        intent.size_breakdown = []
    else:
        labels = [s.label for s in sheets if (s.label or '').strip()]
        text = ' · '.join(labels) if labels else ''
        intent.garment_sheet_name = (text)[:200]
        intent.total_garment_qty = sum((s.total_garment_qty or 0) for s in sheets)
        intent.size_breakdown = []
        if not (intent.item_description or '').strip() and (sheets[0].item_description or '').strip():
            intent.item_description = sheets[0].item_description
    intent.save(
        update_fields=['garment_sheet_name', 'total_garment_qty', 'item_description', 'size_breakdown', 'updated_at']
    )


def _create_intent_line_from_dict(sheet, intent, line_data, default_num):
    line_data = {**line_data}
    line_data.pop('id', None)
    line_data.pop('intent', None)
    line_data.pop('sheet', None)
    line_number = int(line_data.pop('line_number', default_num) or default_num)
    inv = line_data.pop('inventory_item', None)
    if inv is not None and not isinstance(inv, int):
        try:
            inv = int(inv) if inv != '' else None
        except (TypeError, ValueError):
            inv = None
    return IntentLine.objects.create(
        sheet=sheet,
        intent=intent,
        line_number=line_number,
        material_description=line_data.get('material_description', '') or '',
        variant=line_data.get('variant') or None,
        consumption_per_unit=line_data.get('consumption_per_unit', 0) or 0,
        unit=line_data.get('unit', 'PCS') or 'PCS',
        total_required=line_data.get('total_required', 0) or 0,
        inventory_item_id=inv,
        remarks=line_data.get('remarks') or None,
        extra=line_data.get('extra') if isinstance(line_data.get('extra'), dict) else {},
    )


class IntentSheetListSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntentSheet
        fields = ['id', 'label', 'sort_order', 'total_garment_qty']


class IntentSheetSerializer(serializers.ModelSerializer):
    lines = IntentLineSerializer(many=True, required=False)

    class Meta:
        model = IntentSheet
        fields = [
            'id', 'label', 'sort_order', 'item_description', 'size_breakdown',
            'total_garment_qty', 'lines', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_at', 'updated_at')


class IntentListSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    lines_count = serializers.SerializerMethodField()
    sheets = IntentSheetListSerializer(many=True, read_only=True)

    class Meta:
        model = Intent
        fields = [
            'id', 'indent_number', 'pi', 'pi_number', 'buyer_po_reference', 'intent_date',
            'garment_sheet_name', 'status', 'total_garment_qty', 'sheets', 'lines_count',
            'created_by_name', 'created_at',
        ]

    def get_lines_count(self, obj):
        return obj.lines.count()


class IntentSerializer(serializers.ModelSerializer):
    sheets = IntentSheetSerializer(many=True)
    attachments = IntentAttachmentSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)

    class Meta:
        model = Intent
        fields = [
            'id', 'pi', 'indent_number', 'buyer_po_reference', 'intent_date',
            'garment_sheet_name', 'item_description', 'total_garment_qty', 'size_breakdown', 'packing_notes',
            'status', 'prepared_by', 'received_by', 'approved_by', 'notes',
            'sheets', 'attachments', 'created_by', 'created_by_name', 'pi_number', 'created_at', 'updated_at',
        ]
        read_only_fields = (
            'created_by', 'created_at', 'updated_at', 'garment_sheet_name', 'total_garment_qty', 'size_breakdown', 'item_description',
        )

    def create(self, validated_data):
        sheets_data = validated_data.pop('sheets', None)
        if not sheets_data:
            raise serializers.ValidationError({'sheets': 'At least one sheet (Excel tab) is required.'})
        intent = Intent.objects.create(**validated_data)
        for order, sheet_data in enumerate(sheets_data):
            lines = sheet_data.pop('lines', None) or []
            sheet_data.pop('id', None)
            if 'label' in sheet_data and (sheet_data.get('label') or '') == '':
                raise serializers.ValidationError({'sheets': f'Sheet {order + 1}: label is required.'})
            sh = IntentSheet.objects.create(
                intent=intent,
                sort_order=order,
                label=sheet_data.get('label', f'Sheet {order + 1}') or f'Sheet {order + 1}',
                item_description=sheet_data.get('item_description', '') or '',
                size_breakdown=sheet_data.get('size_breakdown') or [],
                total_garment_qty=sheet_data.get('total_garment_qty', 0) or 0,
            )
            for j, line_data in enumerate(lines, start=1):
                _create_intent_line_from_dict(sh, intent, line_data, j)
        _rollup_intent_header_from_sheets(intent)
        return intent

    def update(self, instance, validated_data):
        from procurement.models import PurchaseOrderItem

        sheets_data = validated_data.pop('sheets', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if sheets_data is not None:
            if PurchaseOrderItem.objects.filter(intent_line__intent=instance).exists():
                raise serializers.ValidationError({
                    'sheets': 'Cannot replace sheets or lines while purchase orders reference this intent.',
                })
            instance.sheets.all().delete()
            for order, sheet_data in enumerate(sheets_data):
                lines = sheet_data.pop('lines', None) or []
                sheet_data.pop('id', None)
                sh = IntentSheet.objects.create(
                    intent=instance,
                    sort_order=order,
                    label=sheet_data.get('label', f'Sheet {order + 1}') or f'Sheet {order + 1}',
                    item_description=sheet_data.get('item_description', '') or '',
                    size_breakdown=sheet_data.get('size_breakdown') or [],
                    total_garment_qty=sheet_data.get('total_garment_qty', 0) or 0,
                )
                for j, line_data in enumerate(lines, start=1):
                    _create_intent_line_from_dict(sh, instance, line_data, j)
            _rollup_intent_header_from_sheets(instance)
        return instance
