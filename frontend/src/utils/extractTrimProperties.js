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

const HIDDEN_LABELS = new Set(['cons./pc', 'pi qty', 'order qty']);

const isHiddenLabel = (label) => {
  const key = (label || '').trim().toLowerCase();
  return HIDDEN_LABELS.has(key) || key.startsWith('cons.');
};

const isConsumptionLine = (line) =>
  /cons\.\/pc|pi qty|order qty/i.test(line || '');

/** Parse "Color: GREY · Width: 5 MM · Washes: 1" into individual { label, value, key }. */
const expandPropertySegments = (line) => {
  const segments = (line || '').split(/\s·\s/);
  const out = [];
  segments.forEach((seg) => {
    const trimmed = seg.trim();
    if (!trimmed) return;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) return;
    const label = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (!value || isHiddenLabel(label)) return;
    out.push({ label, value, key: label.toLowerCase() });
  });
  return out;
};

/** Clean display name — strip inline properties after em dash. */
export const getItemDisplayName = (item) => {
  const fromApi = (item?.trim_name || item?.item_name || '').trim();
  if (fromApi) return fromApi;

  const name = (item?.name || '').trim();
  if (!name) return '—';

  const dash = name.indexOf(' — ');
  if (dash > 0) return name.slice(0, dash).trim();

  const parsed = parseParticulars(name);
  if (parsed.name) {
    const parsedDash = parsed.name.indexOf(' — ');
    if (parsedDash > 0) return parsed.name.slice(0, parsedDash).trim();
    return parsed.name;
  }
  return name;
};

/**
 * Extract trim properties (Color, Width, Washes, etc.) as individual entries.
 * Skips Cons./pc, PI Qty, Order Qty.
 */
export const extractTrimProperties = (item) => {
  const collected = [];
  const seen = new Set();

  const addProps = (props) => {
    props.forEach((p) => {
      const id = `${p.label}:${p.value}`;
      if (!seen.has(id)) {
        seen.add(id);
        collected.push(p);
      }
    });
  };

  const rawLines = [];
  if (item?.property_lines?.length) {
    rawLines.push(...item.property_lines);
  } else {
    const parsed = parseParticulars(item?.name || '');
    if (parsed.properties.length) {
      rawLines.push(...parsed.properties);
    } else {
      const name = (item?.name || '').trim();
      const dash = name.indexOf(' — ');
      if (dash > 0) rawLines.push(name.slice(dash + 3).trim());
    }
  }

  rawLines.forEach((line) => {
    const trimmed = (line || '').trim();
    if (!trimmed || isConsumptionLine(trimmed)) return;
    addProps(expandPropertySegments(trimmed));
  });

  return collected;
};

/** @deprecated use extractTrimProperties — returns string lines for search */
export function getItemProperties(item) {
  return extractTrimProperties(item).map((p) => `${p.label}: ${p.value}`);
}
