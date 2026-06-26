export const TRIM_PROPERTY_NAME_SUGGESTIONS = [
  'Width', 'Color', 'Grade', 'Quality', 'Size', 'Garment Size', 'Length', 'Microns', 'GSM',
  'Number', 'Washes',
];

/** PI garment size (S, M, L…) — links trim qty to PI size breakdown. */
export const isGarmentSizeTrimProperty = (name) =>
  /^garment\s*size$/i.test(String(name || '').trim());

/** Physical trim size (button diameter, etc.) — descriptive only, not used for PI qty. */
export const isTrimSpecSizeProperty = (name) =>
  /^size$/i.test(String(name || '').trim());

/** Properties that store a numeric value (no separate unit field in trim library). */
export const isNumericTrimProperty = (name) =>
  /^(number|washes|microns|gsm)$/i.test(String(name || '').trim());

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
  if (/^number$/i.test(trimmed)) return 'Number';
  if (/^washes$/i.test(trimmed)) return 'Washes';
  if (/^microns$/i.test(trimmed)) return 'Microns';
  if (/^gsm$/i.test(trimmed)) return 'GSM';
  if (/^garment\s*size$/i.test(trimmed)) return 'Garment Size';
  return trimmed;
};
