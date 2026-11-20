"""Normalize garment size labels across size breakdown payloads."""

import re
from functools import cmp_to_key

# XXS → 5XL display / storage order for letter sizes.
GARMENT_LETTER_SIZE_ORDER = [
    'XXS',
    'XS',
    'S',
    'M',
    'L',
    'XL',
    'XXL',
    '3XL',
    '4XL',
    '5XL',
]

LETTER_SIZE_ALIASES = {
    '2XS': 'XXS',
    'MM': 'M',
    '2XL': 'XXL',
    'XXXL': '3XL',
    'XXXXL': '4XL',
    'XXXXXL': '5XL',
}

_NUMERIC_SIZE_RE = re.compile(r'^\d+(\.\d+)?$')


def normalize_garment_size(value) -> str:
    normalized = str(value or '').strip().upper()
    if not normalized:
        return ''
    return LETTER_SIZE_ALIASES.get(normalized, normalized)


def _letter_size_rank(size: str) -> int:
    lookup = normalize_garment_size(size)
    if not lookup:
        return -1
    try:
        return GARMENT_LETTER_SIZE_ORDER.index(lookup)
    except ValueError:
        return -1


def _is_numeric_garment_size(size: str) -> bool:
    return bool(_NUMERIC_SIZE_RE.match(normalize_garment_size(size)))


def compare_garment_sizes(a, b) -> int:
    """Sort key comparator: XXS→5XL, then numeric ascending, then other labels."""
    a_norm = normalize_garment_size(a)
    b_norm = normalize_garment_size(b)
    a_letter = _letter_size_rank(a_norm)
    b_letter = _letter_size_rank(b_norm)
    a_numeric = _is_numeric_garment_size(a_norm)
    b_numeric = _is_numeric_garment_size(b_norm)

    if a_letter >= 0 and b_letter >= 0:
        if a_letter != b_letter:
            return a_letter - b_letter
        return (a_norm > b_norm) - (a_norm < b_norm)
    if a_letter >= 0:
        return -1
    if b_letter >= 0:
        return 1

    if a_numeric and b_numeric:
        diff = float(a_norm) - float(b_norm)
        if diff != 0:
            return -1 if diff < 0 else 1
        return (a_norm > b_norm) - (a_norm < b_norm)
    if a_numeric:
        return -1
    if b_numeric:
        return 1

    if not a_norm and not b_norm:
        return 0
    if not a_norm:
        return 1
    if not b_norm:
        return -1

    if a_norm < b_norm:
        return -1
    if a_norm > b_norm:
        return 1
    return 0


def sort_garment_sizes(sizes) -> list:
    return sorted(sizes or [], key=cmp_to_key(compare_garment_sizes))


def _product_code_key(value) -> str:
    return str(value or '').strip().upper()


def compare_size_breakdown_entries(a, b) -> int:
    """Size order first, then product code, so the same size stays distinct per code."""
    size_cmp = compare_garment_sizes((a or {}).get('size'), (b or {}).get('size'))
    if size_cmp != 0:
        return size_cmp
    a_code = _product_code_key((a or {}).get('product_code'))
    b_code = _product_code_key((b or {}).get('product_code'))
    if a_code < b_code:
        return -1
    if a_code > b_code:
        return 1
    return 0


def sort_size_breakdown_entries(rows: list) -> list:
    return sorted(rows or [], key=cmp_to_key(compare_size_breakdown_entries))


def normalize_size_breakdown_list(raw) -> list:
    """Normalize [{size, qty, product_code?}] lists.

    Rows merge only when both the size and the product code match.
    BK-30-R / 30 and BK-30-T / 30 stay as two sizes.
    """
    if not isinstance(raw, list):
        return []

    merged = {}
    order = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        size = normalize_garment_size(entry.get('size'))
        if not size:
            continue
        qty = int(entry.get('qty', 0) or 0)
        product_code = str(entry.get('product_code') or '').strip()
        key = (size, _product_code_key(product_code))
        if key not in merged:
            merged[key] = {'qty': 0, 'product_code': product_code}
            order.append(key)
        else:
            if product_code and not merged[key]['product_code']:
                merged[key]['product_code'] = product_code
        merged[key]['qty'] += qty

    out = []
    for key in order:
        size, _code = key
        data = merged[key]
        row = {'size': size, 'qty': data['qty']}
        if data['product_code']:
            row['product_code'] = data['product_code']
        out.append(row)

    return sort_size_breakdown_entries(out)


def normalize_size_breakdown_sheet(raw) -> list:
    """Normalize intent sheet rows with nested size maps."""
    if not isinstance(raw, list):
        return []

    out = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        sizes = row.get('sizes')
        normalized_sizes = {}
        if isinstance(sizes, dict):
            for key, value in sizes.items():
                size = normalize_garment_size(key)
                if not size:
                    continue
                qty = int(value or 0)
                normalized_sizes[size] = normalized_sizes.get(size, 0) + qty

        item = {**row}
        if normalized_sizes:
            ordered = sort_garment_sizes(normalized_sizes.keys())
            item['sizes'] = {size: normalized_sizes[size] for size in ordered}
        out.append(item)
    return out
