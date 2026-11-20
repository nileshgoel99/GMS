/** Map common aliases onto the canonical letter-size sequence. */
const LETTER_SIZE_ALIASES = {
  '2XS': 'XXS',
  MM: 'M',
  '2XL': 'XXL',
  XXXL: '3XL',
  'XXXXL': '4XL',
  'XXXXXL': '5XL',
};

/** Normalize garment size labels so 3XL and 3xl are treated as the same size. */
export function normalizeGarmentSize(value) {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return '';
  return LETTER_SIZE_ALIASES[normalized] || normalized;
}

/** Standard letter-size column order for size breakdown tables. */
export const GARMENT_LETTER_SIZE_ORDER = [
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
];

const letterSizeRank = (size) => {
  const lookup = normalizeGarmentSize(size);
  if (!lookup) return -1;
  return GARMENT_LETTER_SIZE_ORDER.indexOf(lookup);
};

const isNumericGarmentSize = (size) => /^\d+(\.\d+)?$/.test(normalizeGarmentSize(size));

/** Compare two size labels: XXS→5XL, then numeric ascending, then other labels. */
export function compareGarmentSizes(a, b) {
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
    const diff = parseFloat(aNorm) - parseFloat(bNorm);
    if (diff !== 0) return diff;
    return aNorm.localeCompare(bNorm);
  }
  if (aNumeric) return -1;
  if (bNumeric) return 1;

  // Empty sizes sort last (used when padding editor rows)
  if (!aNorm && !bNorm) return 0;
  if (!aNorm) return 1;
  if (!bNorm) return -1;

  return aNorm.localeCompare(bNorm, undefined, { numeric: true, sensitivity: 'base' });
}

/** Sort sizes: XXS→5XL sequence, then numeric ascending, then any others alphabetically. */
export function sortGarmentSizes(sizes) {
  return [...sizes].sort(compareGarmentSizes);
}

const productCodeKey = (value) => String(value ?? '').trim().toUpperCase();

/** Same size with a different product code is a different row. */
export function compareSizeBreakdownEntries(a, b) {
  const sizeCmp = compareGarmentSizes(a?.size, b?.size);
  if (sizeCmp !== 0) return sizeCmp;
  return productCodeKey(a?.product_code).localeCompare(productCodeKey(b?.product_code));
}

/** Sort size-breakdown rows; blank size rows stay at the end. */
export function sortSizeBreakdownEntries(breakdown) {
  if (!Array.isArray(breakdown)) return [];
  return [...breakdown].sort(compareSizeBreakdownEntries);
}

/**
 * Normalize [{ size, qty, product_code? }] rows.
 * Merge only when size and product code both match.
 * BK-30-R / 30 and BK-30-T / 30 stay as two sizes.
 */
export function normalizeSizeBreakdownEntries(breakdown) {
  if (!Array.isArray(breakdown)) return [];

  const merged = new Map();
  breakdown.forEach((entry) => {
    const size = normalizeGarmentSize(entry?.size);
    if (!size) return;
    const qty = parseInt(entry?.qty, 10) || 0;
    const product_code = String(entry?.product_code ?? '').trim();
    const key = `${size}\0${productCodeKey(product_code)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.qty += qty;
      if (!existing.product_code && product_code) existing.product_code = product_code;
    } else {
      merged.set(key, { size, qty, product_code });
    }
  });

  const rows = [...merged.values()].map(({ size, qty, product_code }) => {
    const row = { size, qty };
    if (product_code) row.product_code = product_code;
    return row;
  });
  return sortSizeBreakdownEntries(rows);
}

/** PI description line: product code with its size, when a code is set. */
export function formatPiSizeBreakdown(rows) {
  return (rows || [])
    .filter((row) => row && (row.size || row.qty))
    .map((row) => {
      const size = normalizeGarmentSize(row.size) || String(row.size || '').trim();
      const code = String(row.product_code || '').trim();
      const label = code ? `${code} · ${size}` : size;
      return `${label} – ${row.qty} pcs`;
    })
    .join(', ');
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
