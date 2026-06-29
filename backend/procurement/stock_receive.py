"""Post purchase bill receipts into inventory and supplier PO received qty."""

from decimal import Decimal

from django.db import transaction

from inventory.models import InventoryItem, InventoryLog
from inventory.utils import parse_particulars

UNIT_TO_INVENTORY = {
    'PCS': 'PCS',
    'MTRS': 'MTR',
    'MTR': 'MTR',
    'KG': 'KG',
    'ROLL': 'ROLL',
    'BOX': 'BOX',
    'SET': 'SET',
    'GROSS': 'PCS',
    'CONES': 'PCS',
    'PAIR': 'PCS',
}

TRIM_CATEGORY_MAP = {
    'button': 'BUTTON',
    'thread': 'THREAD',
    'zipper': 'ZIPPER',
    'tape': 'TAPE',
    'polybag': 'POLYBAG',
    'fabric': 'FABRIC',
    'label': 'LABEL',
}


def _inventory_unit(unit):
    key = (unit or 'PCS').upper()
    return UNIT_TO_INVENTORY.get(key, 'PCS')


def _category_for_trim(trim):
    if not trim:
        return 'OTHER'
    cat = (trim.category or '').lower()
    for needle, code in TRIM_CATEGORY_MAP.items():
        if needle in cat:
            return code
    return 'OTHER'


def _unique_item_code(base):
    code = base[:50]
    if not InventoryItem.objects.filter(item_code=code).exists():
        return code
    n = 1
    while InventoryItem.objects.filter(item_code=f'{code}-{n}').exists():
        n += 1
    return f'{code}-{n}'[:50]


def resolve_inventory_item(*, po_item=None, bill_line=None, user=None):
    """Resolve or create a store inventory SKU for a purchase bill line."""
    if po_item and po_item.item_id:
        return po_item.item

    trim = None
    if bill_line and bill_line.trim_id:
        trim = bill_line.trim
    elif po_item and po_item.trim_id:
        trim = po_item.trim

    name = ''
    particulars_raw = ''
    if bill_line and bill_line.particulars:
        particulars_raw = bill_line.particulars.strip()
        name = particulars_raw
    elif po_item and po_item.particulars:
        particulars_raw = po_item.particulars.strip()
        name = particulars_raw
    elif trim:
        name = trim.name

    if not name:
        return None

    display_name, spec_lines = parse_particulars(particulars_raw or name)
    if trim and not display_name:
        display_name = trim.name
    stored_name = (display_name or name)[:200]

    lookup = {'is_active': True}
    if trim:
        lookup['trim'] = trim
        if spec_lines:
            lookup['spec_lines'] = spec_lines
        else:
            lookup['name'] = stored_name
    else:
        lookup['name'] = name[:200]

    existing = InventoryItem.objects.filter(**lookup).order_by('id').first()
    if existing:
        return existing

    unit = bill_line.unit if bill_line else (po_item.unit if po_item else 'PCS')
    code_base = f'TRM-{trim.id}' if trim else f'PB-{abs(hash(name)) % 100000:05d}'

    return InventoryItem.objects.create(
        item_code=_unique_item_code(code_base),
        name=stored_name,
        trim=trim,
        spec_lines=spec_lines,
        category=_category_for_trim(trim),
        unit=_inventory_unit(unit),
        unit_cost=(bill_line.unit_price if bill_line else None) or (po_item.unit_price if po_item else None),
        created_by=user,
    )


def reverse_purchase_bill_stock(bill):
    """Undo inventory and PO received qty for a bill (before update/delete)."""
    logs = InventoryLog.objects.filter(reference_type='BILL', reference_id=str(bill.id)).select_related('item')
    for log in logs:
        inv = log.item
        inv.current_stock = max(Decimal('0'), (inv.current_stock or Decimal('0')) - log.quantity)
        inv.save(update_fields=['current_stock', 'updated_at'])

    for line in bill.items.select_related('po_item'):
        if line.po_item_id and line.quantity_billed:
            po_item = line.po_item
            po_item.quantity_received = max(
                Decimal('0'),
                (po_item.quantity_received or Decimal('0')) - line.quantity_billed,
            )
            po_item.save(update_fields=['quantity_received', 'updated_at'])

    logs.delete()

    if bill.purchase_order_id:
        bill.purchase_order.update_status()


@transaction.atomic
def post_purchase_bill_to_stock(bill, user):
    """Receive billed quantities into store stock and update PO received qty."""
    if bill.status in ('DRAFT', 'CANCELLED'):
        return

    for line in bill.items.select_related('po_item', 'po_item__item', 'po_item__trim', 'trim'):
        qty = Decimal(str(line.quantity_billed or 0))
        if qty <= 0:
            continue

        po_item = line.po_item
        inv = resolve_inventory_item(po_item=po_item, bill_line=line, user=user)
        if not inv:
            continue

        if po_item and not po_item.item_id:
            po_item.item = inv
            po_item.save(update_fields=['item', 'updated_at'])

        stock_before = inv.current_stock or Decimal('0')
        inv.current_stock = stock_before + qty
        inv.save(update_fields=['current_stock', 'updated_at'])
        if line.unit_price:
            inv.unit_cost = line.unit_price
            inv.save(update_fields=['unit_cost', 'updated_at'])

        InventoryLog.objects.create(
            item=inv,
            transaction_type='RECEIVE',
            quantity=qty,
            reference_type='BILL',
            reference_id=str(bill.id),
            reference_number=bill.internal_ref,
            vendor_supplier=bill.supplier_name,
            unit_cost=line.unit_price,
            stock_before=stock_before,
            stock_after=inv.current_stock,
            created_by=user,
        )

        if po_item:
            po_item.quantity_received = (po_item.quantity_received or Decimal('0')) + qty
            po_item.save(update_fields=['quantity_received', 'updated_at'])

    if bill.purchase_order_id:
        bill.purchase_order.update_status()
