/**
 * Print helpers for Proforma Invoice.
 * Running footers use a table tfoot (see PIPrintSheet) so they reserve layout
 * space and never paint over Value / Date of Dispatch / etc.
 *
 * Also blanks document.title during print so the browser header does not show
 * the app/website title (e.g. "WeaveCore").
 */

const MM = 96 / 25.4;

let savedDocumentTitle = null;

/** Hide app/website title from browser print headers; restore after print. */
export function clearPrintDocumentTitle() {
  if (savedDocumentTitle === null) {
    savedDocumentTitle = document.title;
  }
  // Space (not empty) avoids some browsers substituting "Untitled" / the URL
  document.title = ' ';
}

export function restorePrintDocumentTitle() {
  if (savedDocumentTitle !== null) {
    document.title = savedDocumentTitle;
    savedDocumentTitle = null;
  }
}

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
    clearPrintDocumentTitle();
    const meta = typeof getMeta === 'function' ? getMeta() : (getMeta || {});
    requestAnimationFrame(() => {
      requestAnimationFrame(() => stampPiPrintPageEstimate(rootId, meta));
    });
  };

  const onAfterPrint = () => restorePrintDocumentTitle();

  window.addEventListener('beforeprint', run);
  window.addEventListener('afterprint', onAfterPrint);
  const mql = window.matchMedia('print');
  const onChange = (e) => {
    if (e.matches) run();
    else restorePrintDocumentTitle();
  };
  if (mql.addEventListener) mql.addEventListener('change', onChange);
  else if (mql.addListener) mql.addListener(onChange);

  return () => {
    window.removeEventListener('beforeprint', run);
    window.removeEventListener('afterprint', onAfterPrint);
    if (mql.removeEventListener) mql.removeEventListener('change', onChange);
    else if (mql.removeListener) mql.removeListener(onChange);
    restorePrintDocumentTitle();
  };
}

export function installPiPrintPageFooters(rootId, meta) {
  clearPrintDocumentTitle();
  stampPiPrintPageEstimate(rootId, meta);
}
