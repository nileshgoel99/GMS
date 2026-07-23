import { extractTrimProperties, getItemDisplayName } from './extractTrimProperties';
import { isNumericTrimProperty } from '../components/trims/trimConstants';

/** Canonical property keys for comparing indent BOM values to inventory SKUs. */
export const normalizePropKey = (label) => {
  let k = String(label || '')
    .toLowerCase()
    .replace(/[#]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!k) return '';
  if (/^(no|number|num)$/.test(k)) return 'number';
  if (/^colou?r$/.test(k)) return 'color';
  if (/^(chain\s+)?material$/.test(k)) return 'material';
  if (/^zipper\s*type$/.test(k) || k === 'type') return 'type';
  if (/^puller(\s*type)?$/.test(k)) return 'puller';
  if (/^size$/.test(k)) return 'size';
  if (/^width$/.test(k)) return 'width';
  if (/^length$/.test(k)) return 'length';
  if (/^quality$/.test(k)) return 'quality';
  if (/^grade$/.test(k)) return 'grade';
  return k;
};

/** Normalize values so "17 cm", "17 CMS", "No. 5", "5" compare equal. */
export const normalizePropValue = (value) => {
  let v = String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!v) return '';
  v = v.replace(/^(no\.?|#)\s*/i, '').trim();
  v = v
    .replace(/\s*(cms?|mms?|mtrs?|meters?|metres?|pcs|inches?|inch|"|')\s*$/i, '')
    .trim();
  return v;
};

const valuesCompatible = (a, b) => {
  if (!a || !b) return false;
  if (a === b) return true;
  // "metal puller" ↔ "metal", "close ended" ↔ "close-ended"
  const aa = a.replace(/-/g, ' ');
  const bb = b.replace(/-/g, ' ');
  if (aa === bb) return true;
  if (aa.includes(bb) || bb.includes(aa)) return true;
  return false;
};

export const inventoryItemPropMap = (item) => {
  const map = new Map();
  extractTrimProperties(item || {}).forEach(({ label, value }) => {
    const key = normalizePropKey(label);
    const val = normalizePropValue(value);
    if (key && val) map.set(key, val);
  });
  if (item?.color) {
    const val = normalizePropValue(item.color);
    if (val) map.set('color', val);
  }
  if (item?.size) {
    const val = normalizePropValue(item.size);
    if (val) map.set('size', val);
  }
  return map;
};

export const indentRowPropMap = (row, trimSchema) => {
  const map = new Map();
  const pv = row?.property_values || {};
  Object.entries(pv).forEach(([name, value]) => {
    if (value == null || String(value).trim() === '') return;
    const schema = (trimSchema?.properties || []).find((p) => p.name === name);
    let raw = String(value).trim();
    if (schema?.unit && !isNumericTrimProperty(name)) {
      raw = `${raw} ${schema.unit}`;
    }
    const key = normalizePropKey(name);
    const val = normalizePropValue(raw);
    if (key && val) map.set(key, val);
  });
  if (row?.color_variant) {
    const val = normalizePropValue(row.color_variant);
    if (val) map.set('color', val);
  }
  if (row?.size_variant) {
    const val = normalizePropValue(row.size_variant);
    if (val) map.set('size', val);
  }
  return map;
};

const namesMatch = (row, item) => {
  const rowName = String(row?.trim_name || '').trim().toLowerCase();
  const itemTrimName = String(item?.trim_name || '').trim().toLowerCase();
  const itemDisplay = String(item?.item_name || getItemDisplayName(item) || '').trim().toLowerCase();
  if (row.trim != null && item.trim != null && Number(item.trim) === Number(row.trim)) return true;
  if (rowName && itemTrimName && rowName === itemTrimName) return true;
  if (rowName && itemDisplay && rowName === itemDisplay) return true;
  return false;
};

const categoryMatches = (row, item) => {
  const rowCat = String(row?.category || '').trim().toUpperCase();
  const itemCat = String(item?.category || '').trim().toUpperCase();
  if (!rowCat || !itemCat) return true;
  if (rowCat === itemCat) return true;
  // Trim library uses "Zipper"; inventory uses "ZIPPER"
  if (rowCat.replace(/\s+/g, '') === itemCat.replace(/\s+/g, '')) return true;
  return false;
};

const propsMatch = (needed, available) => {
  if (!needed.size) return true;
  for (const [key, value] of needed.entries()) {
    const have = available.get(key);
    if (!valuesCompatible(value, have)) return false;
  }
  return true;
};

/**
 * Best matching inventory SKU for an indent trim row (highest stock), or null.
 */
export const findMatchingInventoryItem = (row, inventoryItems, trimsList = []) => {
  if (!row || !Array.isArray(inventoryItems) || !inventoryItems.length) return null;
  if (!row.trim && !String(row.trim_name || '').trim()) return null;

  const trimSchema =
    (trimsList || []).find((t) => t.id === row.trim) ||
    (trimsList || []).find(
      (t) => String(t.name || '').toLowerCase() === String(row.trim_name || '').toLowerCase(),
    ) ||
    null;
  const needed = indentRowPropMap(row, trimSchema);

  let best = null;
  let bestQty = -1;
  inventoryItems.forEach((item) => {
    if (item?.is_active === false) return;
    const qty = parseFloat(item.current_stock) || 0;
    if (qty <= 0) return;
    const nameOk = namesMatch(row, item);
    const catOk = categoryMatches(row, item);
    // Same trim/name, or same category with properties filled (e.g. generic "Zipper")
    if (!nameOk && !(catOk && needed.size > 0)) return;
    if (!propsMatch(needed, inventoryItemPropMap(item))) return;
    if (qty > bestQty) {
      best = item;
      bestQty = qty;
    }
  });
  return best;
};

/** True when an active inventory SKU with stock > 0 matches this indent trim row. */
export const inventoryHasStockForTrimRow = (row, inventoryItems, trimsList = []) =>
  Boolean(findMatchingInventoryItem(row, inventoryItems, trimsList));

export const IN_STOCK_REMARK = 'In stock';

export const isInStockRemark = (remarks) =>
  String(remarks || '').trim().toLowerCase() === 'in stock';

export const applyInventoryStockRemark = (row, inventoryItems, trimsList = []) => {
  const match = findMatchingInventoryItem(row, inventoryItems, trimsList);
  const remarks = match ? IN_STOCK_REMARK : '';
  const matched_stock_qty = match ? String(match.current_stock ?? '') : '';
  const matched_stock_unit = match ? String(match.unit || '') : '';
  if (
    (row.remarks || '') === remarks &&
    (row.matched_stock_qty || '') === matched_stock_qty &&
    (row.matched_stock_unit || '') === matched_stock_unit
  ) {
    return row;
  }
  return { ...row, remarks, matched_stock_qty, matched_stock_unit };
};
