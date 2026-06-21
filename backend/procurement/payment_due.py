import re
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum

from .models import PurchaseOrder, PurchaseBill


def parse_payment_days(payment_terms):
    """Extract credit days from free-text payment terms."""
    if not payment_terms or not str(payment_terms).strip():
        return None

    text = str(payment_terms).strip().upper()

    if any(k in text for k in ('ADVANCE', 'IMMEDIATE', 'COD', 'CASH ON DELIVERY', 'UPFRONT', 'PREPAID')):
        return 0

    patterns = (
        r'(?:NET|WITHIN|IN)\s*(\d+)\s*DAYS?',
        r'(\d+)\s*DAYS?\s*(?:FROM|AFTER|@|$)',
        r'(\d+)\s*DAYS?',
        r'(\d+)\s*D\b',
    )
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return int(match.group(1))

    return None


def payment_base_date(po: PurchaseOrder):
    """Anchor date for computing supplier payment due."""
    terms = (po.payment_terms or '').upper()

    if any(k in terms for k in ('DELIVERY', 'RECEIPT', 'GRN', 'DISPATCH', 'SUPPLY')):
        return po.actual_delivery_date or po.expected_delivery_date or po.order_date

    if 'B/L' in terms or 'BL DATE' in terms:
        return po.expected_delivery_date or po.order_date

    return po.order_date


def compute_payment_due_date(po: PurchaseOrder):
    """Return payment due date for a supplier PO, or None if it cannot be determined."""
    base = payment_base_date(po)
    if not base:
        return None

    days = parse_payment_days(po.payment_terms)
    if days is not None:
        return base + timedelta(days=days)

    if po.expected_delivery_date:
        return po.expected_delivery_date

    return None


def filter_pos_payment_due_in_range(queryset, start: date, end: date):
    """Return POs whose computed payment due date falls in [start, end)."""
    due_pos = []
    # Avoid .iterator() on prefetched querysets (raises ValueError from viewset queryset).
    for po in queryset.filter(status__in=['ORDERED', 'PARTIAL']).select_related('buyer_po', 'supplier', 'pi'):
        due = compute_payment_due_date(po)
        if due and start <= due < end:
            due_pos.append(po)
    due_pos.sort(key=lambda p: (compute_payment_due_date(p), p.po_number))
    return due_pos


def month_bounds(today=None):
    today = today or date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)
    return today, month_start, month_end


def build_payments_due_to_pay_payload(queryset):
    """Summary + PO instances for supplier payables due this month (legacy PO-based)."""
    today, month_start, month_end = month_bounds()
    due_pos = filter_pos_payment_due_in_range(queryset, month_start, month_end)
    due_ids = [p.id for p in due_pos]
    agg = queryset.filter(id__in=due_ids).aggregate(count=Count('id'), total=Sum('total_amount'))
    total = agg['total'] or Decimal('0')
    return {
        'current_month': today.strftime('%B %Y'),
        'payments_due_to_pay': {
            'count': agg['count'] or 0,
            'total_amount': str(total),
            'items': due_pos,
        },
    }


def compute_bill_due_date(bill: PurchaseBill):
    """Return stored due date or compute from linked PO payment terms."""
    if bill.due_date:
        return bill.due_date
    if bill.purchase_order_id:
        return compute_payment_due_date(bill.purchase_order)
    return None


def filter_bills_payment_due_in_range(queryset, start: date, end: date):
    """Bills with balance due whose payment due date falls in [start, end)."""
    due_bills = []
    qs = queryset.filter(status__in=['OPEN', 'PARTIAL']).select_related('supplier', 'purchase_order')
    for bill in qs:
        if bill.balance_due <= 0:
            continue
        due = compute_bill_due_date(bill)
        if due and start <= due < end:
            due_bills.append(bill)
    due_bills.sort(key=lambda b: (compute_bill_due_date(b), b.internal_ref))
    return due_bills


def build_bills_payables_payload(queryset=None):
    """Summary + bill instances for payables due this month (purchase bill entry)."""
    today, month_start, month_end = month_bounds()
    qs = queryset if queryset is not None else PurchaseBill.objects.all()
    due_bills = filter_bills_payment_due_in_range(qs, month_start, month_end)
    total_balance = sum((b.balance_due for b in due_bills), Decimal('0'))
    return {
        'current_month': today.strftime('%B %Y'),
        'payments_due_to_pay': {
            'count': len(due_bills),
            'total_amount': str(total_balance.quantize(Decimal('0.01'))),
            'items': due_bills,
        },
    }
