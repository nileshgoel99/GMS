/** Shared PI line / size-split helpers (Pi editor + line items section). */

export const sumSizeQty = (sizes) =>
  (sizes || []).reduce((acc, row) => acc + (parseInt(row.qty, 10) || 0), 0);

export const lineValue = (qty, price) => {
  const q = parseInt(qty, 10) || 0;
  const p = parseFloat(String(price ?? ''));
  if (!q || Number.isNaN(p)) return '';
  return (q * p).toFixed(2);
};

export const fmtSizePreview = (sizes, qtyPcs) => {
  const parts = (sizes || [])
    .filter((s) => (s.size || '').trim() || (parseInt(s.qty, 10) || 0) > 0)
    .map((s) => {
      const sz = (s.size || '').trim();
      const q = parseInt(s.qty, 10) || 0;
      return sz ? `${sz} / ${q}` : String(q);
    });
  const q = parseInt(qtyPcs, 10) || 0;
  if (!parts.length) return q ? `${q} PCS` : '—';
  return `${parts.join(', ')} = ${q} PCS`;
};

export const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

/** Split breakdown into quick grid (standard) vs extra custom rows. */
export const splitSizeBreakdown = (sb) => {
  const list = Array.isArray(sb) ? sb : [];
  const quick = {};
  STANDARD_SIZES.forEach((k) => {
    quick[k] = '';
  });
  const extra = [];
  for (const row of list) {
    const s = (row.size || '').trim();
    if (!s && !(parseInt(row.qty, 10) > 0)) continue;
    if (STANDARD_SIZES.includes(s)) {
      if (quick[s] === '' || quick[s] === '0') {
        quick[s] = row.qty != null && String(row.qty) !== '' ? String(row.qty) : '';
      } else {
        extra.push({ ...row, size: s, qty: String(row.qty ?? '') });
      }
    } else {
      extra.push({ size: s, qty: String(row.qty ?? '') });
    }
  }
  return { quick, extra };
};

export const mergeQuickAndExtra = (quick, extra) => {
  const out = [];
  STANDARD_SIZES.forEach((sz) => {
    const n = parseInt(String(quick[sz] ?? ''), 10);
    if (n > 0) {
      out.push({ size: sz, qty: String(n) });
    }
  });
  (extra || []).forEach((row) => {
    const s = (row.size || '').trim();
    const n = parseInt(String(row.qty ?? ''), 10);
    if (!s && !(n > 0)) return;
    out.push({ size: s, qty: n > 0 ? String(n) : String(row.qty ?? '') });
  });
  return out;
};
