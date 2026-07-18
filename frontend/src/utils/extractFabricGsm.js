/** Pull GSM / gr. per sqm from fabric composition text, e.g. "245gr./sqm". */
export function extractGsmFromFabricComposition(text) {
  const source = String(text || '').trim();
  if (!source) return '';

  const grSqm = source.match(/(\d+(?:\.\d+)?)\s*gr\.?\s*\/\s*sqm/i);
  if (grSqm) return grSqm[1];

  const gsmLabel = source.match(/(\d+(?:\.\d+)?)\s*gsm\b/i);
  if (gsmLabel) return gsmLabel[1];

  return '';
}

/** Apply GSM from material description when the row does not already have one. */
export function enrichFabricRowGsm(row) {
  if (!row || row.gsm) return row;
  const gsm = extractGsmFromFabricComposition(row.material);
  return gsm ? { ...row, gsm } : row;
}
