from decimal import Decimal

from .models import InventoryItemAudit

AUDITED_FIELDS = (
    'item_code',
    'name',
    'category',
    'color',
    'size',
    'finish',
    'material',
    'unit',
    'reorder_level',
    'unit_cost',
    'description',
    'is_active',
    'spec_lines',
)


def _jsonable(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return format(value, 'f')
    if isinstance(value, (list, dict, bool, int, str)):
        return value
    return str(value)


def snapshot_item(item):
    return {field: _jsonable(getattr(item, field, None)) for field in AUDITED_FIELDS}


def diff_snapshots(before, after):
    changes = {}
    for field in AUDITED_FIELDS:
        old = before.get(field)
        new = after.get(field)
        if old != new:
            changes[field] = {'old': old, 'new': new}
    return changes


def record_item_audit(*, item, action, user, changes=None):
    return InventoryItemAudit.objects.create(
        item=item,
        item_code=getattr(item, 'item_code', '') or '',
        item_name=getattr(item, 'name', '') or '',
        action=action,
        changes=changes or {},
        performed_by=user if getattr(user, 'is_authenticated', False) else None,
    )
