"""Normalize garment size labels across size breakdown payloads."""


def normalize_garment_size(value) -> str:
    return str(value or '').strip().upper()


def normalize_size_breakdown_list(raw) -> list:
    """Normalize [{size, qty}] lists and merge duplicate size labels."""
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
        if size not in merged:
            merged[size] = 0
            order.append(size)
        merged[size] += qty

    return [{'size': size, 'qty': merged[size]} for size in order]


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
