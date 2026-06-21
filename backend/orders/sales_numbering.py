import re
from datetime import date

from .models import SalesEntry
from procurement.po_numbering import fiscal_year_label


def next_sales_entry_ref():
    """Next internal sales ref: JBI/SALE/26-27/<seq> (Indian FY)."""
    fy_label = fiscal_year_label()
    prefix = f"JBI/SALE/{fy_label}/"
    pattern_re = re.compile(rf'^{re.escape(prefix)}(\d+)$')
    max_seq = 0
    for ref in SalesEntry.objects.filter(internal_ref__startswith=prefix).values_list('internal_ref', flat=True):
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
