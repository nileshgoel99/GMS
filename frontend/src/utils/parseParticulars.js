/** Split PO/bill particulars into trim name and property lines. */
export const parseParticulars = (text) => {
  const raw = (text || '').trim();
  if (!raw) return { name: '', properties: [] };
  const nl = raw.indexOf('\n');
  if (nl === -1) return { name: raw, properties: [] };
  const name = raw.slice(0, nl).trim();
  const properties = raw
    .slice(nl + 1)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return { name, properties };
};
