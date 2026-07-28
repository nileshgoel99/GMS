export const CARTON_BOX_CATEGORY = 'Carton Box';

/**
 * Preferred indent trim sequence for save + print.
 * Unknown categories sort after Polybag and before Carton Box.
 * Carton Box is always last.
 */
export const INDENT_TRIM_CATEGORY_ORDER = [
  'Pocketing Fabric',
  'Threads',
  'Zipper',
  'Velcro',
  'Reflective Tape',
  'Labels',
  'Others',
  'Polybag',
];

const INDENT_TRIM_CATEGORY_RANKERS = [
  [/^POCKETING(\s+FABRIC)?$/, 0],
  [/^THREADS?$/, 1],
  [/^ZIPPERS?$/, 2],
  [/^(VELCRO|HOOK\s*(&|AND)?\s*LOOP)$/, 3],
  [/^REFLECTIVE(\s+TAPE)?$/, 4],
  [/^LABELS?$/, 5],
  [/^OTHERS?$/, 6],
  [/^POLY\s*BAGS?$/, 7],
];

const INDENT_TRIM_UNKNOWN_RANK = INDENT_TRIM_CATEGORY_ORDER.length; // after Polybag
const INDENT_TRIM_CARTON_RANK = INDENT_TRIM_UNKNOWN_RANK + 1;

export const normalizeIndentTrimCategoryKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

/** Rank used to order indent trim rows (lower = earlier). */
export const indentTrimCategoryRank = (category, trimName = '') => {
  const key = normalizeIndentTrimCategoryKey(category)
    || normalizeIndentTrimCategoryKey(trimName);
  if (!key) return INDENT_TRIM_UNKNOWN_RANK;
  if (/^CARTON(\s*BOX)?$/.test(key)) {
    return INDENT_TRIM_CARTON_RANK;
  }
  for (const [pattern, rank] of INDENT_TRIM_CATEGORY_RANKERS) {
    if (pattern.test(key)) return rank;
  }
  return INDENT_TRIM_UNKNOWN_RANK;
};

/** Stable sort: known categories → extras → Carton Box last. */
export const sortIndentTrimLines = (rows = []) => (
  rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const nameA = a.row?.trim_name || a.row?.name || '';
      const nameB = b.row?.trim_name || b.row?.name || '';
      const ra = indentTrimCategoryRank(a.row?.category, nameA);
      const rb = indentTrimCategoryRank(b.row?.category, nameB);
      if (ra !== rb) return ra - rb;
      const byName = String(nameA).localeCompare(String(nameB), undefined, { sensitivity: 'base' });
      if (byName !== 0) return byName;
      return a.index - b.index;
    })
    .map(({ row }) => row)
);

/** Full set of measurement units usable anywhere a trim/property unit is picked. */
export const TRIM_UNIT_OPTIONS = ['MTRS', 'PCS', 'CONES', 'KG', 'SET', 'PAIR', 'ROLL', 'GROSS', 'CMS', 'CM', 'MM', 'INCH', 'GMS'];

export const CARTON_DIM_UNITS = [
  { value: 'CMS', label: 'CMS' },
  { value: 'INCH', label: 'Inches' },
];

export const CARTON_BOX_PROPERTY_PRESETS = [
  { name: 'Pcs/Box', unit: '' },
  { name: 'PLY', unit: '' },
  { name: 'Dimensions', unit: '' },
  { name: 'Dim. Unit', unit: 'CMS/INCH' },
];

export const TRIM_PROPERTY_NAME_SUGGESTIONS = [
  'Width', 'Color', 'Grade', 'Quality', 'Size', 'Garment Size', 'Length', 'Height', 'Thickness',
  'Microns', 'GSM', 'Diameter', 'Number', 'Washes', 'Finish', 'Material', 'Chain Material',
  'Zipper Type', 'Puller Type', 'Teeth', 'Shade', 'Pantone', 'Logo', 'Composition',
  'Pcs/Box', 'PLY', 'Dimensions', 'Dim. Unit',
];

export const TRIM_CATEGORY_SUGGESTIONS = [
  ...INDENT_TRIM_CATEGORY_ORDER,
  'Waist Band',
  'Hook & Loop',
  'Sticker',
  'Button',
  'Tape',
  'Fabric',
  CARTON_BOX_CATEGORY,
];

/** PI garment size (S, M, L…) — links trim qty to PI size breakdown. */
export const isGarmentSizeTrimProperty = (name) =>
  /^garment\s*size$/i.test(String(name || '').trim());

/** Physical trim size (button diameter, etc.) — descriptive only, not used for PI qty. */
export const isTrimSpecSizeProperty = (name) =>
  /^size$/i.test(String(name || '').trim());

/** Properties that store a numeric value (no separate unit field in trim library). */
export const isNumericTrimProperty = (name) =>
  /^(number|washes|microns|gsm|pcs\s*\/?\s*box)$/i.test(String(name || '').trim());

export const isCartonBoxCategory = (category) =>
  /^carton\s*box$/i.test(String(category || '').trim());

export const isPcsPerBoxProperty = (name) =>
  /^pcs\s*\/?\s*box$/i.test(String(name || '').trim());

export const isPlyProperty = (name) =>
  /^ply$/i.test(String(name || '').trim());

export const isCartonDimensionsProperty = (name) =>
  /^dimensions?$/i.test(String(name || '').trim());

export const isCartonDimUnitProperty = (name) =>
  /^dim\.?\s*unit$/i.test(String(name || '').trim());

export const emptyCartonDefaults = () => ({
  pcs_per_carton: '',
  carton_ply: '',
  carton_dimensions: '',
  carton_dimensions_unit: 'CMS',
});

const findDefaultValue = (defaults, matcher) => {
  if (!defaults || typeof defaults !== 'object') return '';
  const entry = Object.entries(defaults).find(([key]) => matcher(key));
  return entry ? String(entry[1] ?? '') : '';
};

export const cartonBoxFromDefaultValues = (defaults) => ({
  pcs_per_carton: findDefaultValue(defaults, isPcsPerBoxProperty),
  carton_ply: findDefaultValue(defaults, isPlyProperty),
  carton_dimensions: findDefaultValue(defaults, isCartonDimensionsProperty),
  carton_dimensions_unit: findDefaultValue(defaults, isCartonDimUnitProperty) || 'CMS',
});

export const defaultValuesFromCartonBox = (box) => ({
  'Pcs/Box': box?.pcs_per_carton != null ? String(box.pcs_per_carton) : '',
  PLY: box?.carton_ply || '',
  Dimensions: box?.carton_dimensions || '',
  'Dim. Unit': box?.carton_dimensions_unit || 'CMS',
});

export const applyCartonBoxCategoryToForm = (form) => {
  if (!isCartonBoxCategory(form.category)) return form;
  const hasCartonProps = (form.properties || []).some((prop) =>
    isPcsPerBoxProperty(prop.name) || isPlyProperty(prop.name) || isCartonDimensionsProperty(prop.name),
  );
  return {
    ...form,
    properties: hasCartonProps ? form.properties : [...CARTON_BOX_PROPERTY_PRESETS],
    cartonDefaults: form.cartonDefaults || emptyCartonDefaults(),
  };
};

export const formatCartonBoxSummary = (defaults) => {
  const box = cartonBoxFromDefaultValues(defaults);
  const parts = [];
  if (box.pcs_per_carton) parts.push(`${box.pcs_per_carton} pcs/box`);
  if (box.carton_ply) parts.push(box.carton_ply);
  if (box.carton_dimensions) {
    const unitLabel = box.carton_dimensions_unit === 'INCH' ? 'Inches' : 'CMS';
    parts.push(`${box.carton_dimensions} (${unitLabel})`);
  }
  return parts.length ? parts.join(' · ') : '';
};

export const formatTrimPropertyLabel = (prop) => {
  const n = String(prop?.name || '').trim();
  if (/^gsm$/i.test(n)) return 'GSM';
  if (/^microns$/i.test(n)) return 'Microns';
  if (/^garment\s*size$/i.test(n)) return 'Garment Size';
  if (isNumericTrimProperty(prop?.name)) return prop.name;
  return prop?.unit ? `${prop.name} (${prop.unit})` : prop.name;
};

/** Resolve unit for a property name from trim master schema (case-insensitive). */
export const findTrimPropertyUnit = (propName, properties = []) => {
  const key = String(propName || '').trim().toLowerCase();
  if (!key) return '';
  const hit = (properties || []).find((p) => String(p?.name || '').trim().toLowerCase() === key);
  return String(hit?.unit || '').trim();
};

/**
 * COLOR / VARIANT text for indent print & view — includes property units (e.g. Width: 5 MM).
 * trimSchema = TrimMaster row (or { properties }) when available.
 */
export const formatTrimVariantDisplay = (row, trimSchema = null) => {
  const pv = row?.property_values || {};
  const properties = trimSchema?.properties || [];
  const entries = Object.entries(pv).filter(([, v]) => v != null && String(v).trim() !== '');
  if (entries.length) {
    return entries.map(([name, raw]) => {
      const value = String(raw).trim();
      const unit = findTrimPropertyUnit(name, properties);
      if (unit && !new RegExp(`(^|\\s)${unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i').test(value)) {
        return `${name}: ${value} ${unit}`;
      }
      return `${name}: ${value}`;
    }).join(' · ');
  }
  return [row?.color_variant, row?.size_variant].filter(Boolean).join(' / ');
};

export const normalizeTrimPropertyName = (name) => {
  const trimmed = String(name || '').trim();
  if (/^(number|no\.?|#)$/i.test(trimmed)) return 'Number';
  if (/^washes$/i.test(trimmed)) return 'Washes';
  if (/^microns$/i.test(trimmed)) return 'Microns';
  if (/^gsm$/i.test(trimmed)) return 'GSM';
  if (/^garment\s*size$/i.test(trimmed)) return 'Garment Size';
  if (/^pcs\s*\/?\s*box$/i.test(trimmed)) return 'Pcs/Box';
  if (/^ply$/i.test(trimmed)) return 'PLY';
  if (/^dimensions?$/i.test(trimmed)) return 'Dimensions';
  if (/^dim\.?\s*unit$/i.test(trimmed)) return 'Dim. Unit';
  if (/^colou?r$/i.test(trimmed)) return 'Color';
  if (/^(chain\s+)?material$/i.test(trimmed)) return 'Chain Material';
  if (/^zipper\s*type$/i.test(trimmed)) return 'Zipper Type';
  if (/^puller(\s*type)?$/i.test(trimmed)) return 'Puller Type';
  return trimmed;
};
