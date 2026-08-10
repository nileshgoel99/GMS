"""Helpers for cutting records — PI line options, rolls registry, indent fabric lookup."""
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

from django.db.models import Q
from django.shortcuts import get_object_or_404
from orders.models import BuyerPO, Indent, IndentFabricLine
from orders.size_utils import normalize_size_breakdown_list
from .models import CuttingRecord, FabricRoll


def _to_decimal(value):
    if value is None or value == '':
        return None
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError):
        return None


def _q(value):
    if value is None:
        return None
    return str(value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP))


def normalize_roll_entries(raw):
    """
    Normalize roll lines to:
    [{ roll_no, total_meters?, used_meters?, rejected_meters?, balance_meters? }]
    Balance = total − used − rejected. Accepts legacy string entries.
    """
    if not isinstance(raw, list):
        return []

    out = []
    seen = set()
    for entry in raw:
        if isinstance(entry, dict):
            roll_no = str(entry.get('roll_no') or entry.get('roll_number') or '').strip()
            total = _to_decimal(entry.get('total_meters'))
            used = _to_decimal(entry.get('used_meters'))
            rejected = _to_decimal(entry.get('rejected_meters'))
        else:
            roll_no = str(entry or '').strip()
            total = used = rejected = None

        if not roll_no or roll_no in seen:
            continue
        seen.add(roll_no)

        row = {'roll_no': roll_no}
        if total is not None:
            row['total_meters'] = _q(total)
        if used is not None:
            row['used_meters'] = _q(used)
        if rejected is not None:
            row['rejected_meters'] = _q(rejected)
        elif used is not None or total is not None:
            row['rejected_meters'] = '0.0000'
            rejected = Decimal('0')

        if total is not None and used is not None:
            rej = rejected if rejected is not None else Decimal('0')
            balance = total - used - rej
            row['balance_meters'] = _q(balance)
        out.append(row)
    return out


def sum_roll_used_meters(rolls):
    total = Decimal('0')
    for row in rolls or []:
        used = _to_decimal(row.get('used_meters') if isinstance(row, dict) else None)
        if used is not None and used > 0:
            total += used
    return total.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)


def _entry_balance(entry):
    bal = _to_decimal(entry.get('balance_meters'))
    if bal is not None:
        return bal
    total = _to_decimal(entry.get('total_meters')) or Decimal('0')
    used = _to_decimal(entry.get('used_meters')) or Decimal('0')
    rejected = _to_decimal(entry.get('rejected_meters')) or Decimal('0')
    return total - used - rejected


def iter_roll_usages(roll_no):
    """Yield (cutting, normalized_entry) for RECORDED cuttings that used this roll, oldest first."""
    roll_no = str(roll_no or '').strip()
    if not roll_no:
        return
    qs = (
        CuttingRecord.objects
        .filter(status='RECORDED')
        .select_related('buyer_po', 'pi')
        .order_by('cutting_date', 'created_at', 'id')
    )
    for rec in qs:
        for entry in normalize_roll_entries(rec.roll_numbers):
            if entry.get('roll_no') == roll_no:
                yield rec, entry
                break


def recompute_fabric_roll(roll_no, fabric='', color='', unit='MTRS'):
    """Rebuild FabricRoll from cutting history. Balance of last use = current_balance."""
    roll_no = str(roll_no or '').strip()
    if not roll_no:
        return None

    usages = list(iter_roll_usages(roll_no))
    if not usages:
        FabricRoll.objects.filter(roll_no=roll_no).delete()
        return None

    first_entry = usages[0][1]
    last_rec, last_entry = usages[-1]
    original = _to_decimal(first_entry.get('total_meters')) or Decimal('0')
    balance = _entry_balance(last_entry)

    defaults = {
        'original_meters': original,
        'current_balance': balance,
        'unit': unit or last_rec.consumption_unit or 'MTRS',
        'fabric': fabric or last_rec.fabric or '',
        'color': color or last_rec.color or '',
    }
    obj, _ = FabricRoll.objects.update_or_create(roll_no=roll_no, defaults=defaults)
    return obj


def sync_rolls_for_cutting(cutting, previous_roll_nos=None):
    """After create/update/delete, recompute registry for affected roll numbers."""
    current = {e['roll_no'] for e in normalize_roll_entries(cutting.roll_numbers or [])}
    affected = set(previous_roll_nos or []) | current
    for roll_no in affected:
        recompute_fabric_roll(
            roll_no,
            fabric=cutting.fabric or '',
            color=cutting.color or '',
            unit=cutting.consumption_unit or 'MTRS',
        )


def ensure_rolls_seeded():
    """Seed FabricRoll from existing cuttings when the registry is empty."""
    if FabricRoll.objects.exists():
        return
    seen = set()
    for rec in CuttingRecord.objects.filter(status='RECORDED').order_by('cutting_date', 'id'):
        for entry in normalize_roll_entries(rec.roll_numbers):
            roll_no = entry.get('roll_no')
            if roll_no and roll_no not in seen:
                seen.add(roll_no)
                recompute_fabric_roll(
                    roll_no,
                    fabric=rec.fabric or '',
                    color=rec.color or '',
                    unit=rec.consumption_unit or 'MTRS',
                )


def serialize_fabric_roll(obj):
    return {
        'id': obj.id,
        'roll_no': obj.roll_no,
        'original_meters': str(obj.original_meters),
        'current_balance': str(obj.current_balance),
        'fabric': obj.fabric or '',
        'color': obj.color or '',
        'unit': obj.unit or 'MTRS',
        'notes': obj.notes or '',
        'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
    }


def list_fabric_rolls(search='', limit=100):
    ensure_rolls_seeded()
    qs = FabricRoll.objects.all()
    search = (search or '').strip()
    if search:
        qs = qs.filter(
            Q(roll_no__icontains=search)
            | Q(fabric__icontains=search)
            | Q(color__icontains=search)
        )
    return [serialize_fabric_roll(r) for r in qs[:limit]]


def suggested_total_meters(roll_no, exclude_cutting_id=None):
    """
    Meters available for the next cut = balance after the last prior usage.
    When editing a cutting, exclude that cutting so total is the pre-edit balance.
    Returns None if the roll has no prior usages (brand new).
    """
    exclude_id = None
    if exclude_cutting_id not in (None, ''):
        try:
            exclude_id = int(exclude_cutting_id)
        except (TypeError, ValueError):
            exclude_id = None

    prior = []
    for rec, entry in iter_roll_usages(roll_no):
        if exclude_id is not None and rec.id == exclude_id:
            continue
        prior.append(entry)
    if not prior:
        return None
    return _q(_entry_balance(prior[-1]))


def get_roll_usage_history(roll_no, exclude_cutting_id=None):
    roll_no = str(roll_no or '').strip()
    ensure_rolls_seeded()
    roll = FabricRoll.objects.filter(roll_no=roll_no).first()
    usages = []
    for rec, entry in iter_roll_usages(roll_no):
        usages.append({
            'cutting_id': rec.id,
            'cutting_number': rec.cutting_number,
            'cutting_date': str(rec.cutting_date),
            'buyer_po_number': rec.buyer_po.po_number if rec.buyer_po_id else '',
            'pi_number': rec.pi.pi_number if rec.pi_id else '',
            'item_name': rec.item_name or '',
            'fabric': rec.fabric or '',
            'color': rec.color or '',
            'total_meters': entry.get('total_meters'),
            'used_meters': entry.get('used_meters'),
            'rejected_meters': entry.get('rejected_meters', '0'),
            'balance_meters': entry.get('balance_meters'),
        })
    last = usages[-1] if usages else None
    suggested = suggested_total_meters(roll_no, exclude_cutting_id=exclude_cutting_id)
    return {
        'roll_no': roll_no,
        'exists': bool(roll) or bool(usages),
        'is_new': suggested is None and not usages,
        'original_meters': str(roll.original_meters) if roll else (usages[0]['total_meters'] if usages else '0'),
        'current_balance': str(roll.current_balance) if roll else (last['balance_meters'] if last else '0'),
        'suggested_total': suggested if suggested is not None else None,
        'fabric': (roll.fabric if roll else '') or (last['fabric'] if last else ''),
        'color': (roll.color if roll else '') or (last['color'] if last else ''),
        'unit': (roll.unit if roll else '') or 'MTRS',
        'usages': list(reversed(usages)),  # newest first for UI
    }


def _norm(value):
    return str(value or '').strip().lower()


def match_indent_fabric_rate(pi, fabric, color):
    """
    Find the best IndentFabricLine rate for a PI style colour.
    Prefer exact colour match; then material contains match.
    """
    if not pi:
        return None

    fabric_n = _norm(fabric)
    color_n = _norm(color)

    lines = list(
        IndentFabricLine.objects
        .filter(indent__pi=pi)
        .select_related('indent')
        .order_by('-indent__indent_date', '-indent_id', 'sort_order', 'id')
    )
    if not lines:
        return None

    def score(fl: IndentFabricLine):
        s = 0
        fl_color = _norm(fl.color)
        fl_mat = _norm(fl.material)
        if color_n and fl_color == color_n:
            s += 100
        elif color_n and fl_color and (color_n in fl_color or fl_color in color_n):
            s += 40
        if fabric_n and fl_mat:
            if fabric_n == fl_mat:
                s += 50
            elif fabric_n in fl_mat or fl_mat in fabric_n:
                s += 25
        if fl.consumption_per_pc and Decimal(fl.consumption_per_pc) > 0:
            s += 1
        return s

    ranked = sorted(lines, key=score, reverse=True)
    best = ranked[0]
    if score(best) <= 0:
        # Fall back to first fabric line with a rate if nothing matched
        for fl in ranked:
            if fl.consumption_per_pc and Decimal(fl.consumption_per_pc) > 0:
                return fl
        return None
    return best


def _roll_nos_from_record(record):
    rolls = []
    for entry in record.roll_numbers or []:
        if isinstance(entry, dict):
            roll_no = str(entry.get('roll_no') or entry.get('roll_number') or '').strip()
        else:
            roll_no = str(entry or '').strip()
        if roll_no and roll_no not in rolls:
            rolls.append(roll_no)
    return rolls


def _aggregate_prior_cut_by_size(records):
    """Sum prior cut qty per size and collect roll numbers from past cutting records."""
    out = {}
    for rec in records:
        rolls = _roll_nos_from_record(rec)
        for row in rec.size_breakdown or []:
            size = str(row.get('size') or '').strip()
            qty = int(row.get('qty') or 0)
            if not size or qty <= 0:
                continue
            if size not in out:
                out[size] = {'qty': 0, 'rolls': [], 'entries': []}
            bucket = out[size]
            bucket['qty'] += qty
            for roll_no in rolls:
                if roll_no not in bucket['rolls']:
                    bucket['rolls'].append(roll_no)
            bucket['entries'].append({
                'cutting_id': rec.id,
                'cutting_number': rec.cutting_number,
                'cutting_date': str(rec.cutting_date),
                'qty': qty,
                'rolls': rolls,
            })
    return out


def _prior_cuts_by_item_line(buyer_po_id, exclude_cutting_id=None):
    qs = CuttingRecord.objects.filter(
        buyer_po_id=buyer_po_id,
        status='RECORDED',
    ).only(
        'id', 'cutting_number', 'cutting_date', 'pi_line_id', 'buyer_po_line_id',
        'size_breakdown', 'roll_numbers',
    )
    if exclude_cutting_id:
        try:
            qs = qs.exclude(pk=int(exclude_cutting_id))
        except (TypeError, ValueError):
            pass

    grouped = {}
    for rec in qs:
        if rec.pi_line_id:
            key = ('pi', rec.pi_line_id)
        elif rec.buyer_po_line_id:
            key = ('bpo', rec.buyer_po_line_id)
        else:
            continue
        grouped.setdefault(key, []).append(rec)

    return {key: _aggregate_prior_cut_by_size(records) for key, records in grouped.items()}


def build_cutting_context(buyer_po_id, exclude_cutting_id=None):
    buyer_po = get_object_or_404(
        BuyerPO.objects.select_related('pi', 'customer').prefetch_related('lines', 'pi__lines'),
        pk=buyer_po_id,
    )
    pi = buyer_po.pi
    items = []
    prior_by_line = _prior_cuts_by_item_line(buyer_po_id, exclude_cutting_id)

    if pi is not None:
        for line in pi.lines.all().order_by('line_number', 'id'):
            fabric = line.material or ''
            color = line.color or ''
            rate_line = match_indent_fabric_rate(pi, fabric, color)
            items.append({
                'source': 'pi_line',
                'pi_line_id': line.id,
                'buyer_po_line_id': None,
                'item_code': line.item_code or '',
                'item_name': line.item_name or '',
                'fabric': fabric,
                'color': color,
                'size_breakdown': normalize_size_breakdown_list(line.size_breakdown),
                'ordered_qty': line.quantity_pcs or 0,
                'consumption_per_pc': str(rate_line.consumption_per_pc) if rate_line else '0',
                'consumption_unit': rate_line.unit if rate_line else 'MTRS',
                'roll_width': rate_line.roll_width if rate_line else '',
                'gsm': rate_line.gsm if rate_line else '',
                'indent_number': rate_line.indent.indent_number if rate_line else '',
                'indent_fabric_material': rate_line.material if rate_line else '',
                'indent_fabric_color': rate_line.color if rate_line else '',
                'prior_cut_by_size': prior_by_line.get(('pi', line.id), {}),
            })
    else:
        for line in buyer_po.lines.all().order_by('line_number', 'id'):
            fabric = line.fabric or ''
            color = line.color or ''
            items.append({
                'source': 'buyer_po_line',
                'pi_line_id': None,
                'buyer_po_line_id': line.id,
                'item_code': line.item_code or '',
                'item_name': line.item_name or '',
                'fabric': fabric,
                'color': color,
                'size_breakdown': normalize_size_breakdown_list(line.size_breakdown),
                'ordered_qty': line.quantity or 0,
                'consumption_per_pc': '0',
                'consumption_unit': 'MTRS',
                'roll_width': '',
                'gsm': '',
                'indent_number': '',
                'indent_fabric_material': '',
                'indent_fabric_color': '',
                'prior_cut_by_size': prior_by_line.get(('bpo', line.id), {}),
            })

    indent_count = Indent.objects.filter(pi=pi).count() if pi else 0

    return {
        'buyer_po': {
            'id': buyer_po.id,
            'po_number': buyer_po.po_number,
            'po_date': buyer_po.po_date,
            'buyer_name': buyer_po.buyer_name,
            'status': buyer_po.status,
            'total_qty': buyer_po.total_qty,
        },
        'pi': None if pi is None else {
            'id': pi.id,
            'pi_number': pi.pi_number,
            'client_name': pi.client_name,
            'garment_type': pi.garment_type,
            'quantity': pi.quantity,
            'status': pi.status,
            'order_date': pi.order_date,
            'delivery_date': pi.delivery_date,
        },
        'indent_count': indent_count,
        'items': items,
    }
