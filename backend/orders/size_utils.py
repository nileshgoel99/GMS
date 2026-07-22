"""Normalize garment size labels across size breakdown payloads."""


def normalize_garment_size(value) -> str:
    return str(value or '').strip().upper()


def normalize_size_breakdown_list(raw) -> list:
    """Normalize [{size, qty, product_code?}] lists and merge duplicate size labels."""
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
        if size not in merged:
            merged[size] = {'qty': 0, 'product_code': ''}
            order.append(size)
        merged[size]['qty'] += qty
        if product_code and not merged[size]['product_code']:
            merged[size]['product_code'] = product_code

    out = []
    for size in order:
        row = {'size': size, 'qty': merged[size]['qty']}
        if merged[size]['product_code']:
            row['product_code'] = merged[size]['product_code']
        out.append(row)
    return out


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
            item['sizes'] = normalized_sizes
        out.append(item)
    return out
