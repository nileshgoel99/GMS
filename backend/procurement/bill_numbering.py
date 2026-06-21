import re
from datetime import date

from .models import PurchaseBill
from .po_numbering import fiscal_year_label


def next_purchase_bill_ref():
    """Next internal purchase bill ref: JBI/BILL/26-27/<seq> (Indian FY)."""
    fy_label = fiscal_year_label()
    prefix = f"JBI/BILL/{fy_label}/"
    pattern_re = re.compile(rf'^{re.escape(prefix)}(\d+)$')
    max_seq = 0
    for ref in PurchaseBill.objects.filter(internal_ref__startswith=prefix).values_list('internal_ref', flat=True):
        match = pattern_re.match(ref)
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    seq = max_seq + 1
    return {
        'internal_ref': f"{prefix}{seq}",
        'prefix': prefix,
        'fy_label': fy_label,
        'seq': seq,
    }
