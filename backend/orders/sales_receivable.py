from datetime import date, timedelta
from decimal import Decimal

from procurement.payment_due import parse_payment_days, month_bounds

from .models import SalesEntry


def compute_sales_due_date(entry: SalesEntry):
    if entry.due_date:
        return entry.due_date
    base = entry.sale_date
    if not base:
        return None
    days = parse_payment_days(entry.payment_terms)
    if days is not None:
        return base + timedelta(days=days)
    if entry.buyer_po_id and entry.buyer_po.ex_factory_date:
        return entry.buyer_po.ex_factory_date
    return base


def filter_sales_receivable_in_range(queryset, start: date, end: date):
    due_entries = []
    qs = queryset.filter(status__in=['OPEN', 'PARTIAL']).select_related('customer', 'buyer_po', 'pi')
    for entry in qs:
        if entry.balance_due <= 0:
            continue
        due = compute_sales_due_date(entry)
        if due and start <= due < end:
            due_entries.append(entry)
    due_entries.sort(key=lambda e: (compute_sales_due_date(e), e.internal_ref))
    return due_entries


def build_sales_receivables_payload(queryset=None):
    today, month_start, month_end = month_bounds()
    qs = queryset if queryset is not None else SalesEntry.objects.all()
    due_entries = filter_sales_receivable_in_range(qs, month_start, month_end)
    total_balance = sum((e.balance_due for e in due_entries), Decimal('0'))
    return {
        'current_month': today.strftime('%B %Y'),
        'payments_due_to_collect': {
            'count': len(due_entries),
            'total_amount': str(total_balance.quantize(Decimal('0.01'))),
            'items': due_entries,
        },
    }
