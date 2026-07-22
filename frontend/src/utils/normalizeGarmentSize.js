/** Normalize garment size labels so 3XL and 3xl are treated as the same size. */
export function normalizeGarmentSize(value) {
  return String(value ?? '').trim().toUpperCase();
}

/** Standard letter-size column order for size breakdown tables. */
export const GARMENT_LETTER_SIZE_ORDER = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'];

const letterSizeRank = (size) => {
  const normalized = normalizeGarmentSize(size);
  if (!normalized) return -1;
  const lookup = normalized === '2XL' ? 'XXL' : normalized;
  return GARMENT_LETTER_SIZE_ORDER.indexOf(lookup);
};

const isNumericGarmentSize = (size) => /^\d+(\.\d+)?$/.test(normalizeGarmentSize(size));

/** Sort sizes: S→5XL sequence, then numeric ascending, then any others alphabetically. */
export function sortGarmentSizes(sizes) {
  return [...sizes].sort((a, b) => {
    const aNorm = normalizeGarmentSize(a);
    const bNorm = normalizeGarmentSize(b);
    const aLetter = letterSizeRank(aNorm);
    const bLetter = letterSizeRank(bNorm);
    const aNumeric = isNumericGarmentSize(aNorm);
    const bNumeric = isNumericGarmentSize(bNorm);

    if (aLetter >= 0 && bLetter >= 0) {
      if (aLetter !== bLetter) return aLetter - bLetter;
      return aNorm.localeCompare(bNorm);
    }
    if (aLetter >= 0) return -1;
    if (bLetter >= 0) return 1;

    if (aNumeric && bNumeric) {
      return parseFloat(aNorm) - parseFloat(bNorm);
    }
    if (aNumeric) return 1;
    if (bNumeric) return -1;

    return aNorm.localeCompare(bNorm, undefined, { numeric: true, sensitivity: 'base' });
  });
}

/** Normalize and merge [{ size, qty, product_code? }] rows by uppercase size label. */
export function normalizeSizeBreakdownEntries(breakdown) {
  if (!Array.isArray(breakdown)) return [];

  const merged = new Map();
  breakdown.forEach((entry) => {
    const size = normalizeGarmentSize(entry?.size);
    if (!size) return;
    const qty = parseInt(entry?.qty, 10) || 0;
    const product_code = String(entry?.product_code ?? '').trim();
    const existing = merged.get(size);
    if (existing) {
      existing.qty += qty;
      if (!existing.product_code && product_code) existing.product_code = product_code;
    } else {
      merged.set(size, { qty, product_code });
    }
  });

  return [...merged.entries()].map(([size, { qty, product_code }]) => {
    const row = { size, qty };
    if (product_code) row.product_code = product_code;
    return row;
  });
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
