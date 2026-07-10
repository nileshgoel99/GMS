/** Normalize garment size labels so 3XL and 3xl are treated as the same size. */
export function normalizeGarmentSize(value) {
  return String(value ?? '').trim().toUpperCase();
}

/** Normalize and merge [{ size, qty }] rows by uppercase size label. */
export function normalizeSizeBreakdownEntries(breakdown) {
  if (!Array.isArray(breakdown)) return [];

  const merged = new Map();
  breakdown.forEach((entry) => {
    const size = normalizeGarmentSize(entry?.size);
    if (!size) return;
    const qty = parseInt(entry?.qty, 10) || 0;
    merged.set(size, (merged.get(size) || 0) + qty);
  });

  return [...merged.entries()].map(([size, qty]) => ({ size, qty }));
}

/** Normalize size keys in intent sheet maps, merging duplicate labels. */
export function normalizeSizeMapKeys(sizes) {
  if (!sizes || typeof sizes !== 'object') return {};

  const merged = {};
  Object.entries(sizes).forEach(([key, value]) => {
    const size = normalizeGarmentSize(key);
    if (!size) return;
    const qty = parseInt(value, 10) || 0;
    merged[size] = (merged[size] || 0) + qty;
  });
  return merged;
}
