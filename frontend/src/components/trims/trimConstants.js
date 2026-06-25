export const TRIM_PROPERTY_NAME_SUGGESTIONS = [
  'Width', 'Color', 'Grade', 'Quality', 'Size', 'Length', 'Microns', 'GSM',
  'Number', 'Washes',
];

/** Properties that store a numeric value (no separate unit field in trim library). */
export const isNumericTrimProperty = (name) =>
  /^(number|washes|microns|gsm)$/i.test(String(name || '').trim());

export const formatTrimPropertyLabel = (prop) => {
  const n = String(prop?.name || '').trim();
  if (/^gsm$/i.test(n)) return 'GSM';
  if (/^microns$/i.test(n)) return 'Microns';
  if (isNumericTrimProperty(prop?.name)) return prop.name;
  return prop?.unit ? `${prop.name} (${prop.unit})` : prop.name;
};

export const normalizeTrimPropertyName = (name) => {
  const trimmed = String(name || '').trim();
  if (/^number$/i.test(trimmed)) return 'Number';
  if (/^washes$/i.test(trimmed)) return 'Washes';
  if (/^microns$/i.test(trimmed)) return 'Microns';
  if (/^gsm$/i.test(trimmed)) return 'GSM';
  return trimmed;
};
