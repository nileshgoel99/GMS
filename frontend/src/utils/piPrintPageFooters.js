/**
 * Print helpers for Proforma Invoice.
 * The sheet footer is a page-margin line (see documentPrint.js), so it sits
 * at the foot of every page and does not follow the last paragraph.
 *
 * The browser uses document.title as the PDF save name. During print that
 * title is the PI number and party name, then the app title is restored.
 */

import { bindPrintRootLift } from './documentPrint';

const MM = 96 / 25.4;

let savedDocumentTitle = null;

/** Safe PDF save name: PI number and party name, without the site title. */
export function piDownloadFileName(piNumber, partyName) {
  const clean = (value) => String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return [clean(piNumber), clean(partyName)].filter(Boolean).join(' ') || 'Proforma Invoice';
}

/** Set the print/save name, remembering the app title so it can be restored. */
export function setPrintDocumentTitle(fileName) {
  if (savedDocumentTitle === null) {
    savedDocumentTitle = document.title;
  }
  document.title = fileName || 'Proforma Invoice';
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
  const unlift = bindPrintRootLift(rootId);
  const run = () => {
    const meta = typeof getMeta === 'function' ? getMeta() : (getMeta || {});
    setPrintDocumentTitle(meta.fileName);
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
    unlift();
  };
}

export function installPiPrintPageFooters(rootId, meta) {
  const info = meta || {};
  setPrintDocumentTitle(info.fileName);
  stampPiPrintPageEstimate(rootId, info);
}
