/**
 * Print helpers for Proforma Invoice.
 * Running footers use a table tfoot (see PIPrintSheet) so they reserve layout
 * space and never paint over Value / Date of Dispatch / etc.
 */

const MM = 96 / 25.4;

export function piPrintPageHeightPx(marginTopMm = 12, marginBottomMm = 16) {
  return (297 - marginTopMm - marginBottomMm) * MM;
}

/** Stamp estimated page count on the print root (for debugging / future use). */
export function stampPiPrintPageEstimate(rootId, {
  marginTopMm = 12,
  marginBottomMm = 16,
} = {}) {
  const root = document.getElementById(rootId);
  if (!root) return;

  const pageH = piPrintPageHeightPx(marginTopMm, marginBottomMm);
  const height = Math.max(root.scrollHeight, 1);
  const totalPages = Math.max(1, Math.ceil(height / pageH));
  root.setAttribute('data-pi-total-pages', String(totalPages));
}

export function bindPiPrintPageFooters(rootId, getMeta) {
  const run = () => {
    const meta = typeof getMeta === 'function' ? getMeta() : (getMeta || {});
    requestAnimationFrame(() => {
      requestAnimationFrame(() => stampPiPrintPageEstimate(rootId, meta));
    });
  };

  window.addEventListener('beforeprint', run);
  const mql = window.matchMedia('print');
  const onChange = (e) => {
    if (e.matches) run();
  };
  if (mql.addEventListener) mql.addEventListener('change', onChange);
  else if (mql.addListener) mql.addListener(onChange);

  return () => {
    window.removeEventListener('beforeprint', run);
    if (mql.removeEventListener) mql.removeEventListener('change', onChange);
    else if (mql.removeListener) mql.removeListener(onChange);
  };
}

export function installPiPrintPageFooters(rootId, meta) {
  stampPiPrintPageEstimate(rootId, meta);
}
