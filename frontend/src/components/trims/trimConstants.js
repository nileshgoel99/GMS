export const CARTON_BOX_CATEGORY = 'Carton Box';

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
  'Width', 'Color', 'Grade', 'Quality', 'Size', 'Garment Size', 'Length', 'Microns', 'GSM',
  'Number', 'Washes', 'Pcs/Box', 'PLY', 'Dimensions', 'Dim. Unit',
];

export const TRIM_CATEGORY_SUGGESTIONS = [
  'Fabric', 'Tape', 'Button', 'Velcro', 'Zipper', 'Thread', 'Label',
  'Polybag', 'Waist Band', 'Hook & Loop', 'Sticker', CARTON_BOX_CATEGORY, 'Other',
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
