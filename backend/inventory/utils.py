"""Inventory display helpers and stock traceability."""

import re

HIDDEN_LABELS = {'cons./pc', 'pi qty', 'order qty'}


def _is_hidden_label(label):
    key = (label or '').strip().lower()
    return key in HIDDEN_LABELS or key.startswith('cons.')


def _is_consumption_line(line):
    return bool(re.search(r'cons\./pc|pi qty|order qty', line or '', re.I))


def _expand_property_segments(line):
    parts = []
    for seg in re.split(r'\s·\s', (line or '').strip()):
        seg = seg.strip()
        if not seg:
            continue
        colon = seg.find(':')
        if colon <= 0:
            continue
        label = seg[:colon].strip()
        value = seg[colon + 1 :].strip()
        if not value or _is_hidden_label(label):
            continue
        parts.append(f'{label}: {value}')
    return parts


def parse_particulars(text):
    """Split PO/bill particulars into trim name and property lines."""
    raw = (text or '').strip()
    if not raw:
        return '', []
    nl = raw.find('\n')
    if nl == -1:
        dash = raw.find(' — ')
        if dash > 0:
            return raw[:dash].strip(), _expand_property_segments(raw[dash + 3 :])
        return raw, []
    name = raw[:nl].strip()
    dash = name.find(' — ')
    if dash > 0:
        name = name[:dash].strip()
    lines = [line.strip() for line in raw[nl + 1 :].split('\n') if line.strip()]
    return name, lines


def item_display_name(item):
    if item.trim_id:
        return item.trim.name
    name, _ = parse_particulars(item.name)
    dash = (name or '').find(' — ')
    if dash > 0:
        return name[:dash].strip()
    return name or item.name


def item_property_lines(item):
    raw_lines = list(item.spec_lines) if item.spec_lines else []
    if not raw_lines:
        _, lines = parse_particulars(item.name)
        raw_lines = lines
        if not raw_lines:
            name = (item.name or '').strip()
            dash = name.find(' — ')
            if dash > 0:
                raw_lines = [name[dash + 3 :].strip()]

    result = []
    seen = set()
    for line in raw_lines:
        if _is_consumption_line(line):
            continue
        for prop in _expand_property_segments(line):
            if prop not in seen:
                seen.add(prop)
                result.append(prop)
    return result


def get_stock_sources_for_item(item):
    """Receipt lots with PI, customer, supplier traceability."""
    from procurement.models import PurchaseBill

    logs = list(
        item.logs.filter(transaction_type='RECEIVE')
        .order_by('-created_at')
        .values(
            'quantity',
            'created_at',
            'vendor_supplier',
            'reference_type',
            'reference_id',
            'reference_number',
        )
    )

    bill_ids = [
        log['reference_id']
        for log in logs
        if log['reference_type'] == 'BILL' and log['reference_id'] and str(log['reference_id']).isdigit()
    ]
    bills = {}
    if bill_ids:
        for bill in PurchaseBill.objects.filter(id__in=bill_ids).select_related(
            'purchase_order__pi', 'purchase_order', 'supplier'
        ):
            bills[str(bill.id)] = bill

    sources = []
    for log in logs:
        supplier = (log['vendor_supplier'] or '').strip()
        pi_number = None
        customer = None
        po_number = None

        if log['reference_type'] == 'BILL' and log['reference_id']:
            bill = bills.get(str(log['reference_id']))
            if bill:
                if not supplier:
                    supplier = (bill.supplier_name or '').strip()
                po = bill.purchase_order
                if po:
                    po_number = po.po_number
                    if not supplier:
                        supplier = (po.vendor_name or '').strip()
                    if po.pi_id:
                        pi_number = po.pi.pi_number
                        customer = po.pi.client_name

        sources.append(
            {
                'quantity': log['quantity'],
                'received_at': log['created_at'],
                'supplier': supplier,
                'bill_ref': log['reference_number'] or '',
                'pi_number': pi_number,
                'customer': customer,
                'po_number': po_number,
            }
        )

    return sources


def aggregate_pi_and_suppliers(item, sources=None):
    """Unique PI/customer pairs and supplier names for list display."""
    sources = sources if sources is not None else get_stock_sources_for_item(item)

    pi_map = {}
    suppliers = set()

    for src in sources:
        if src.get('supplier'):
            suppliers.add(src['supplier'])
        if src.get('pi_number'):
            pi_map[src['pi_number']] = src.get('customer') or ''

    if not pi_map:
        for poi in item.po_items.select_related('po__pi').all():
            po = poi.po
            if po.pi_id:
                pi_map[po.pi.pi_number] = po.pi.client_name
            if po.vendor_name:
                suppliers.add(po.vendor_name)

    pi_refs = [{'pi_number': k, 'customer': v} for k, v in sorted(pi_map.items())]
    return pi_refs, sorted(suppliers)
