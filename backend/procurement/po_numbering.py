import re
from datetime import date

from .models import PurchaseOrder


def fiscal_year_label(for_date=None):
    today = for_date or date.today()
    if today.month >= 4:
        fy_start, fy_end = today.year, today.year + 1
    else:
        fy_start, fy_end = today.year - 1, today.year
    return f"{str(fy_start)[-2:]}-{str(fy_end)[-2:]}"


def next_supplier_po_number():
    """Next supplier PO number: JBI/PO/26-27/<seq> (Indian FY, auto-increment)."""
    fy_label = fiscal_year_label()
    prefix = f"JBI/PO/{fy_label}/"
    pattern_re = re.compile(rf'^{re.escape(prefix)}(\d+)$')
    max_seq = 0
    for po_number in PurchaseOrder.objects.filter(po_number__startswith=prefix).values_list('po_number', flat=True):
        match = pattern_re.match(po_number)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    seq = max_seq + 1
    return {
        'po_number': f"{prefix}{seq}",
        'prefix': prefix,
        'fy_label': fy_label,
        'seq': seq,
    }
