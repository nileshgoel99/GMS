/**
 * Shared print pagination for every generated document.
 *
 * Content stays in normal block flow so the browser breaks at the space left
 * on the page. Blocks that must stay intact opt into `.doc-keep`. Tables with
 * `.pi-items-table`, `.po-print-items-table`, or `.indent-print-table` repeat
 * their header and do not split a row. Sheet footers are `position: fixed`
 * inside the page margin, so they repeat without reserving a table-footer
 * gap or covering the body.
 *
 * Print roots that live inside the app layout are moved to `document.body`
 * for the print (see `bindPrintRootLift`). Hiding the rest of the body with
 * `display: none` drops the editor's height, which `visibility: hidden` keeps
 * and prints as blank pages.
 */

const placeholders = new Map();

export function pageNumberRules(fontFamily) {
  return `
    @top-left { content: none; }
    @top-center { content: none; }
    @top-right { content: none; }
    @bottom-left { content: none; }
    @bottom-center { content: none; }
    @bottom-right {
      content: "Page " counter(page) " / " counter(pages);
      font-family: ${fontFamily};
      font-size: 8pt;
      color: #333;
      vertical-align: top;
      padding-top: 1mm;
    }
  `;
}

/** Rules that apply inside one print root. */
export function flowRulesCss(root) {
  return `
    ${root} .doc-keep,
    ${root} .po-print-no-break,
    ${root} .indent-print-no-break {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    ${root} .doc-heading {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    ${root} .doc-flow-table,
    ${root} .pi-items-table,
    ${root} .po-print-items-table,
    ${root} .indent-print-table {
      break-inside: auto !important;
      page-break-inside: auto !important;
    }
    ${root} .pi-items-table thead,
    ${root} .po-print-items-table thead,
    ${root} .indent-print-table thead {
      display: table-header-group !important;
    }
    ${root} .pi-items-table tr,
    ${root} .po-print-items-table tr,
    ${root} .indent-print-table tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    ${root} .pi-sheet-footer,
    ${root} .po-sheet-footer {
      display: flex !important;
      position: fixed;
      bottom: 1.5mm;
      left: 0;
      right: 34mm;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin: 0;
      padding-top: 1mm;
      border-top: 0.6pt solid #888;
      background: #fff;
      font-size: 8pt;
      line-height: 1.2;
      color: #333;
      z-index: 2;
    }
  `;
}

export function isolatePrintRootCss(rootId) {
  return `
    html, body {
      background: #fff !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    body > *:not(#${rootId}) {
      display: none !important;
    }
    #${rootId} {
      display: block !important;
      position: static !important;
      left: auto !important;
      top: auto !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      height: auto !important;
      min-height: 0 !important;
      background: #fff !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      overflow: visible !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  `;
}

export function piPrintCss(rootId) {
  return `
@media screen {
  .pi-sheet-footer { display: none !important; }
}
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 12mm 16mm 12mm;
    ${pageNumberRules('"Times New Roman", Times, serif')}
  }
  ${isolatePrintRootCss(rootId)}
  #${rootId} {
    padding: 6mm !important;
  }
  ${flowRulesCss(`#${rootId}`)}
}
`;
}

/**
 * Move a print root onto document.body while printing, then put it back.
 * Idempotent if the node is already a body child (indent portal).
 */
export function bindPrintRootLift(rootId) {
  const lift = () => {
    const el = document.getElementById(rootId);
    if (!el || el.parentNode === document.body || placeholders.has(rootId)) return;
    const marker = document.createComment(`print-lift:${rootId}`);
    el.parentNode.insertBefore(marker, el);
    document.body.appendChild(el);
    placeholders.set(rootId, marker);
  };
  const restore = () => {
    const marker = placeholders.get(rootId);
    placeholders.delete(rootId);
    const el = document.getElementById(rootId);
    if (!marker || !marker.parentNode || !el) return;
    marker.parentNode.insertBefore(el, marker);
    marker.remove();
  };

  window.addEventListener('beforeprint', lift);
  window.addEventListener('afterprint', restore);
  return () => {
    window.removeEventListener('beforeprint', lift);
    window.removeEventListener('afterprint', restore);
    restore();
  };
}
