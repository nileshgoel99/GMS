export const TRIM_PROPERTY_NAME_SUGGESTIONS = [
  'Width', 'Color', 'Grade', 'Size', 'Length', 'Number', 'Washes',
];

/** Properties that store a plain numeric value with no unit. */
export const isNumericTrimProperty = (name) =>
  /^(number|washes)$/i.test(String(name || '').trim());

export const formatTrimPropertyLabel = (prop) => {
  if (isNumericTrimProperty(prop?.name)) return prop.name;
  return prop?.unit ? `${prop.name} (${prop.unit})` : prop.name;
};

export const normalizeTrimPropertyName = (name) => {
  const trimmed = String(name || '').trim();
  if (/^number$/i.test(trimmed)) return 'Number';
  if (/^washes$/i.test(trimmed)) return 'Washes';
  return trimmed;
};
