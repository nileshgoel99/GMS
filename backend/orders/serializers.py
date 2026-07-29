from decimal import Decimal
import re

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
from .size_utils import normalize_size_breakdown_list


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

    def validate_size_breakdown(self, value):
        return normalize_size_breakdown_list(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['size_breakdown'] = normalize_size_breakdown_list(data.get('size_breakdown'))
        return data


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
        row['size_breakdown'] = normalize_size_breakdown_list(row['size_breakdown'])
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


def _pi_line_match_key(item_name, color, item_code):
    return (
        (item_name or '').strip().upper(),
        (color or '').strip().upper(),
        (item_code or '').strip().upper(),
    )


def update_pi_preserving_lines(pi, header_fields, lines_data):
    """Update an existing PI in place.

    Matching style lines (item_name + color + item_code) keep their IDs so
    indents that reference selected_pi_line_ids stay linked. Removed styles
    are dropped from indent selections.
    """
    fields = dict(header_fields or {})
    cust = fields.get('customer', pi.customer)
    if cust is not None and not hasattr(cust, 'pk'):
        cust = Customer.objects.filter(pk=cust).first()
        if cust is not None:
            fields['customer'] = cust
    if cust is not None and hasattr(cust, 'pk'):
        fields.update(_sync_client_fields_from_customer(cust))

    normalized = _normalize_lines_payload(lines_data or [])
    fields.update(_rollup_header_from_lines(normalized))

    for attr, value in fields.items():
        if attr == 'lines':
            continue
        setattr(pi, attr, value)
    pi.save()

    existing = list(pi.lines.all().order_by('line_number'))
    by_key = {}
    for line in existing:
        by_key.setdefault(
            _pi_line_match_key(line.item_name, line.color, line.item_code),
            [],
        ).append(line)

    kept_ids = set()
    for row in normalized:
        key = _pi_line_match_key(row['item_name'], row['color'], row['item_code'])
        bucket = by_key.get(key) or []
        if bucket:
            line = bucket.pop(0)
            line.line_number = row['line_number']
            line.item_code = row['item_code']
            line.item_name = row['item_name']
            line.description = row['description']
            line.material = row['material']
            line.color = row['color']
            line.size_breakdown = row['size_breakdown']
            line.quantity_pcs = row['quantity_pcs']
            line.unit_price_usd = row['unit_price_usd']
            line.line_value_usd = row['line_value_usd']
            line.save()
            kept_ids.add(line.id)
        else:
            created = ProformaInvoiceLine.objects.create(
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
            kept_ids.add(created.id)

    removed_ids = [line.id for line in existing if line.id not in kept_ids]
    if removed_ids:
        ProformaInvoiceLine.objects.filter(id__in=removed_ids).delete()
        for indent in pi.indents.all():
            ids = list(indent.selected_pi_line_ids or [])
            filtered = [i for i in ids if i not in removed_ids]
            if filtered != ids:
                indent.selected_pi_line_ids = filtered
                indent.save(update_fields=['selected_pi_line_ids'])

    return _sync_pi_totals(pi)


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

class BlankAsZeroDecimalField(serializers.DecimalField):
    """Treat blank/null as zero — indent BOM rows often omit totals until calculated."""

    def to_internal_value(self, data):
        if data is None or data == '':
            return Decimal('0')
        if isinstance(data, str) and not data.strip():
            return Decimal('0')
        try:
            return super().to_internal_value(data)
        except serializers.ValidationError:
            return Decimal('0')


class TrimMasterSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default='')
    supplier_country = serializers.CharField(source='supplier.country', read_only=True, default='')

    class Meta:
        model = TrimMaster
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_properties(self, value):
        """Normalize property definitions and prevent ambiguous duplicate keys."""
        normalized = []
        seen = set()
        for prop in value or []:
            name = str((prop or {}).get('name') or '').strip()
            if not name:
                continue
            key = name.casefold()
            if key in seen:
                raise serializers.ValidationError(
                    f'Duplicate property name: {name}. Property names must be unique.'
                )
            seen.add(key)
            normalized.append({
                'name': name,
                'unit': str((prop or {}).get('unit') or '').strip(),
            })
        return normalized

    def update(self, instance, validated_data):
        """
        Rename property keys everywhere the trim is used.

        The editor keeps property order stable, so a changed name at the same
        index is a rename. This prevents existing indent rows from continuing
        to display the old property after the Trim Library schema is edited.
        """
        old_properties = list(instance.properties or [])
        new_properties = list(validated_data.get('properties', old_properties) or [])
        renames = []
        for index, old_prop in enumerate(old_properties):
            if index >= len(new_properties):
                break
            old_name = str((old_prop or {}).get('name') or '').strip()
            new_name = str((new_properties[index] or {}).get('name') or '').strip()
            if old_name and new_name and old_name != new_name:
                renames.append((old_name, new_name))

        instance = super().update(instance, validated_data)
        if not renames:
            return instance

        defaults = dict(instance.default_property_values or {})
        defaults_changed = False
        for old_name, new_name in renames:
            if old_name in defaults:
                if new_name not in defaults:
                    defaults[new_name] = defaults[old_name]
                del defaults[old_name]
                defaults_changed = True
        if defaults_changed:
            instance.default_property_values = defaults
            instance.save(update_fields=['default_property_values', 'updated_at'])

        for line in instance.indent_lines.all().only('id', 'property_values'):
            values = dict(line.property_values or {})
            changed = False
            for old_name, new_name in renames:
                if old_name in values:
                    if new_name not in values:
                        values[new_name] = values[old_name]
                    del values[old_name]
                    changed = True
            if changed:
                line.property_values = values
                line.save(update_fields=['property_values'])

        return instance


class IndentPiOptionSerializer(serializers.ModelSerializer):
    """Minimal PI fields for indent creation picker."""

    class Meta:
        model = ProformaInvoice
        fields = ['id', 'pi_number', 'client_name', 'quantity', 'garment_type', 'order_date']


class IndentPiContextSerializer(serializers.ModelSerializer):
    """PI + lines for indent workflow without full PI module access."""

    lines = ProformaInvoiceLineSerializer(many=True, read_only=True)

    class Meta:
        model = ProformaInvoice
        fields = ['id', 'pi_number', 'client_name', 'buyer_po_number', 'order_date', 'quantity', 'lines']


class IndentFabricLineSerializer(serializers.ModelSerializer):
    consumption_per_pc = BlankAsZeroDecimalField(max_digits=10, decimal_places=4, required=False)
    total_consumption = BlankAsZeroDecimalField(max_digits=14, decimal_places=4, required=False)

    class Meta:
        model = IndentFabricLine
        fields = [
            'id', 'material', 'color', 'gsm', 'roll_width', 'consumption_per_pc', 'unit',
            'total_consumption', 'remarks', 'sort_order',
        ]
        read_only_fields = ('id',)


class IndentTrimLineSerializer(serializers.ModelSerializer):
    consumption_per_pc = BlankAsZeroDecimalField(max_digits=10, decimal_places=4, required=False)
    total_consumption = BlankAsZeroDecimalField(max_digits=14, decimal_places=4, required=False)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, default='')
    supplier_country = serializers.CharField(source='supplier.country', read_only=True, default='')

    class Meta:
        model = IndentTrimLine
        fields = [
            'id', 'trim', 'trim_name', 'category', 'color_variant', 'size_variant',
            'property_values',
            'consumption_per_pc', 'unit', 'total_consumption', 'total_unit', 'parts', 'remarks',
            'sort_order', 'supplier', 'supplier_name', 'supplier_country',
        ]
        read_only_fields = ('id', 'supplier_name', 'supplier_country')


CARTON_BOX_CATEGORY = 'Carton Box'
CARTON_BOX_TRIM_NAME = 'CARTON BOX'
CARTON_BOX_PROPERTIES = [
    {'name': 'Pcs/Box', 'unit': ''},
    {'name': 'PLY', 'unit': ''},
    {'name': 'Dimensions', 'unit': ''},
    {'name': 'Dim. Unit', 'unit': 'CMS/INCH'},
]

# Preferred indent trim sequence (unknowns after Polybag, Carton Box last).
_INDENT_TRIM_CATEGORY_RANKERS = (
    (re.compile(r'^POCKETING(\s+FABRIC)?$', re.I), 0),
    (re.compile(r'^THREADS?$', re.I), 1),
    (re.compile(r'^ZIPPERS?$', re.I), 2),
    (re.compile(r'^(VELCRO|HOOK\s*(&|AND)?\s*LOOP)$', re.I), 3),
    (re.compile(r'^REFLECTIVE(\s+TAPE)?$', re.I), 4),
    (re.compile(r'^LABELS?$', re.I), 5),
    (re.compile(r'^OTHERS?$', re.I), 6),
    (re.compile(r'^POLY\s*BAGS?$', re.I), 7),
)
_INDENT_TRIM_UNKNOWN_RANK = 8
_INDENT_TRIM_CARTON_RANK = 9


def _normalize_indent_trim_category_key(value):
    key = re.sub(r'[_-]+', ' ', str(value or '').strip().upper())
    return re.sub(r'\s+', ' ', key).strip()


def _indent_trim_category_rank(category='', trim_name=''):
    key = _normalize_indent_trim_category_key(category) or _normalize_indent_trim_category_key(trim_name)
    if not key:
        return _INDENT_TRIM_UNKNOWN_RANK
    if re.match(r'^CARTON(\s*BOX)?$', key, re.I):
        return _INDENT_TRIM_CARTON_RANK
    for pattern, rank in _INDENT_TRIM_CATEGORY_RANKERS:
        if pattern.match(key):
            return rank
    return _INDENT_TRIM_UNKNOWN_RANK


def _sort_indent_trim_rows(trim_data):
    """Stable sort for save order: known categories → extras → Carton Box."""
    rows = list(trim_data or [])
    return sorted(
        enumerate(rows),
        key=lambda item: (
            _indent_trim_category_rank(
                (item[1] or {}).get('category', ''),
                (item[1] or {}).get('trim_name', ''),
            ),
            item[0],
        ),
    )


def _get_carton_box_trim():
    """Carton Box is just another trim in the library — one shared entry, like Velcro or Button.
    Per-indent values (Pcs/Box, PLY, Dimensions, unit) live on the indent's carton row itself,
    the same way other trims keep their per-use values in property_values — never written back
    onto this shared master record.
    """
    trim, _created = TrimMaster.objects.get_or_create(
        name=CARTON_BOX_TRIM_NAME,
        defaults={
            'category': CARTON_BOX_CATEGORY,
            'default_unit': 'PCS',
            'properties': CARTON_BOX_PROPERTIES,
        },
    )
    return trim


def _normalize_carton_boxes(raw):
    """Normalize carton rows and link each to the shared Carton Box trim."""
    if not isinstance(raw, list):
        return []
    out = []
    trim = None
    for row in raw:
        if not isinstance(row, dict):
            continue
        pcs = int(row.get('pcs_per_carton', 0) or 0)
        ply = str(row.get('carton_ply') or '').strip()
        dims = str(row.get('carton_dimensions') or '').strip()
        unit = str(row.get('carton_dimensions_unit') or 'CMS').strip().upper() or 'CMS'
        if unit not in ('CMS', 'INCH'):
            unit = 'CMS'
        if not (pcs or ply or dims):
            continue
        if trim is None:
            trim = _get_carton_box_trim()
        out.append({
            'pcs_per_carton': pcs,
            'carton_ply': ply,
            'carton_dimensions': dims,
            'carton_dimensions_unit': unit,
            'trim_id': trim.id,
            'trim_name': trim.name,
        })
    return out


def _legacy_carton_from_boxes(boxes):
    first = boxes[0] if boxes else {}
    return {
        'pcs_per_carton': first.get('pcs_per_carton') or 0,
        'carton_ply': first.get('carton_ply') or '',
        'carton_dimensions': first.get('carton_dimensions') or '',
        'carton_dimensions_unit': first.get('carton_dimensions_unit') or 'CMS',
    }


def _carton_boxes_from_instance(instance):
    boxes = instance.carton_boxes or []
    if not boxes and (instance.pcs_per_carton or instance.carton_ply or instance.carton_dimensions):
        boxes = [{
            'pcs_per_carton': instance.pcs_per_carton or 0,
            'carton_ply': instance.carton_ply or '',
            'carton_dimensions': instance.carton_dimensions or '',
            'carton_dimensions_unit': instance.carton_dimensions_unit or 'CMS',
        }]
    if not boxes:
        return []
    trim_ids = [row.get('trim_id') for row in boxes if row.get('trim_id')]
    trim_names = {}
    if trim_ids:
        trim_names = dict(
            TrimMaster.objects.filter(id__in=trim_ids).values_list('id', 'name')
        )
    enriched = []
    for row in boxes:
        item = dict(row)
        tid = item.get('trim_id')
        if tid and tid in trim_names:
            item['trim_name'] = trim_names[tid]
        enriched.append(item)
    return enriched


class IndentSerializer(serializers.ModelSerializer):
    fabric_lines = IndentFabricLineSerializer(many=True, required=False)
    trim_lines = IndentTrimLineSerializer(many=True, required=False)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    pi_number = serializers.CharField(source='pi.pi_number', read_only=True)
    pi_client_name = serializers.CharField(source='pi.client_name', read_only=True)
    pi_lines = serializers.SerializerMethodField()
    pi_detail = serializers.SerializerMethodField()
    linked_trims = serializers.SerializerMethodField()

    class Meta:
        model = Indent
        fields = [
            'id', 'pi', 'pi_number', 'pi_client_name', 'pi_lines', 'pi_detail', 'linked_trims',
            'selected_pi_line_ids',
            'indent_number', 'indent_date', 'status',
            'pcs_per_carton', 'carton_ply', 'carton_dimensions', 'carton_dimensions_unit', 'carton_boxes',
            'prepared_by', 'received_by', 'approved_by', 'notes',
            'fabric_lines', 'trim_lines',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at')

    def get_pi_lines(self, obj):
        return ProformaInvoiceLineSerializer(obj.pi.lines.all(), many=True).data

    def get_pi_detail(self, obj):
        return IndentPiContextSerializer(obj.pi).data

    def get_linked_trims(self, obj):
        trim_ids = set(
            obj.trim_lines.exclude(trim_id__isnull=True).values_list('trim_id', flat=True)
        )
        for row in obj.carton_boxes or []:
            tid = row.get('trim_id')
            if tid:
                try:
                    trim_ids.add(int(tid))
                except (TypeError, ValueError):
                    pass
        if not trim_ids:
            return []
        qs = TrimMaster.objects.filter(id__in=trim_ids).select_related('supplier')
        return TrimMasterSerializer(qs, many=True).data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['carton_boxes'] = _carton_boxes_from_instance(instance)
        return data

    def _apply_carton_boxes(self, validated_data):
        if 'carton_boxes' in validated_data:
            boxes = _normalize_carton_boxes(validated_data.pop('carton_boxes'))
            validated_data['carton_boxes'] = boxes
            validated_data.update(_legacy_carton_from_boxes(boxes))
        return validated_data

    def _save_lines(self, indent, fabric_data, trim_data):
        from suppliers.models import Supplier

        indent.fabric_lines.all().delete()
        for i, row in enumerate(fabric_data or []):
            row.pop('id', None)
            IndentFabricLine.objects.create(indent=indent, sort_order=i, **row)

        indent.trim_lines.all().delete()
        for i, (_orig_idx, row) in enumerate(_sort_indent_trim_rows(trim_data)):
            row = dict(row)
            row.pop('id', None)
            row.pop('supplier_name', None)
            row.pop('supplier_country', None)
            trim_fk = row.pop('trim', None)
            if trim_fk and hasattr(trim_fk, 'pk'):
                trim_fk = trim_fk.pk
            supplier_fk = row.pop('supplier', None)
            if supplier_fk and hasattr(supplier_fk, 'pk'):
                supplier_fk = supplier_fk.pk
            # sort_order always follows the canonical category sequence
            row.pop('sort_order', None)
            line = IndentTrimLine.objects.create(
                indent=indent,
                trim_id=trim_fk,
                supplier_id=supplier_fk,
                sort_order=i,
                **row,
            )
            if line.supplier_id and line.trim_name:
                supplier = Supplier.objects.filter(pk=line.supplier_id).first()
                if supplier:
                    supplier.add_supplies_in(line.trim_name, line.category or '')

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
                'unit': tl.unit, 'total_unit': tl.total_unit, 'parts': tl.parts or [], 'remarks': tl.remarks,
                'supplier': tl.supplier_id,
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
        self._apply_carton_boxes(validated_data)
        indent = Indent.objects.create(**validated_data)
        self._save_lines(indent, fabric_data, trim_data)
        self._upsert_templates(indent)
        return indent

    def update(self, instance, validated_data):
        fabric_data = validated_data.pop('fabric_lines', None)
        trim_data = validated_data.pop('trim_lines', None)
        self._apply_carton_boxes(validated_data)
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
    item_names = serializers.SerializerMethodField()
    total_qty = serializers.SerializerMethodField()
    fabric_count = serializers.SerializerMethodField()
    trim_count = serializers.SerializerMethodField()

    class Meta:
        model = Indent
        fields = [
            'id', 'indent_number', 'pi', 'pi_number', 'pi_ref',
            'item_name', 'item_names', 'total_qty', 'status', 'indent_date',
            'fabric_count', 'trim_count', 'created_by_name', 'created_at',
        ]

    def get_pi_ref(self, obj):
        po = obj.pi.buyer_pos.order_by('id').first()
        return po.po_number if po else None

    def _selected_pi_lines(self, obj):
        """PI lines linked to this indent (selected_pi_line_ids), or all PI lines if none set."""
        qs = obj.pi.lines.all()
        ids = obj.selected_pi_line_ids or []
        if ids:
            qs = qs.filter(id__in=ids)
        return qs

    def get_item_names(self, obj):
        return list(self._selected_pi_lines(obj).values_list('item_name', flat=True).distinct())

    def get_item_name(self, obj):
        return ', '.join(self.get_item_names(obj))

    def get_total_qty(self, obj):
        return self._selected_pi_lines(obj).aggregate(s=Sum('quantity_pcs'))['s'] or 0

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

    def validate_size_breakdown(self, value):
        return normalize_size_breakdown_list(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['size_breakdown'] = normalize_size_breakdown_list(data.get('size_breakdown'))
        return data


class BuyerPOListSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    ship_to_customer_name = serializers.SerializerMethodField()
    lines_count = serializers.SerializerMethodField()
    pi_id = serializers.IntegerField(source='pi.id', read_only=True, allow_null=True)

    class Meta:
        model = BuyerPO
        fields = [
            'id', 'po_number', 'po_date', 'buyer_name', 'buyer_contact',
            'customer', 'customer_name',
            'ship_to_customer', 'ship_to_customer_name', 'ship_to_name', 'ship_to_address',
            'currency', 'status',
            'ex_factory_date', 'total_qty', 'total_value', 'lines_count',
            'po_document', 'pi_ref', 'pi_id', 'created_at',
        ]

    def get_customer_name(self, obj):
        return obj.customer.company_legal_name if obj.customer else None

    def get_ship_to_customer_name(self, obj):
        return obj.ship_to_customer.company_legal_name if obj.ship_to_customer else None

    def get_lines_count(self, obj):
        return obj.lines.count()


class BuyerPOSerializer(serializers.ModelSerializer):
    lines = BuyerPOLineSerializer(many=True)
    customer_name = serializers.SerializerMethodField()
    ship_to_customer_name = serializers.SerializerMethodField()
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    indent_count = serializers.SerializerMethodField()

    class Meta:
        model = BuyerPO
        fields = [
            'id', 'po_number', 'po_date',
            'customer', 'customer_name', 'buyer_name', 'buyer_address',
            'buyer_contact',
            'ship_to_customer', 'ship_to_customer_name', 'ship_to_name', 'ship_to_address',
            'supplier_code', 'currency',
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

    def get_ship_to_customer_name(self, obj):
        return obj.ship_to_customer.company_legal_name if obj.ship_to_customer else None

    def get_indent_count(self, obj):
        if not obj.pi_id:
            return 0
        return obj.pi.indents.count()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        customer = attrs.get('customer', getattr(self.instance, 'customer', None) if self.instance else None)
        ship_to = attrs.get('ship_to_customer', getattr(self.instance, 'ship_to_customer', None) if self.instance else None)
        # Explicit null clears ship-to on update
        if 'ship_to_customer' in attrs and attrs['ship_to_customer'] is None:
            return attrs
        if ship_to and customer:
            code_a = (customer.customer_code or '').strip().upper()
            code_b = (ship_to.customer_code or '').strip().upper()
            if code_a and code_b and code_a != code_b:
                raise serializers.ValidationError({
                    'ship_to_customer': (
                        'Ship To must be under the same customer code as Bill To '
                        f'({customer.customer_code}).'
                    ),
                })
        return attrs

    def _save_lines(self, po, lines_data):
        po.lines.all().delete()
        for i, line_data in enumerate(lines_data, start=1):
            line_data.pop('id', None)
            line_data['size_breakdown'] = normalize_size_breakdown_list(line_data.get('size_breakdown'))
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

