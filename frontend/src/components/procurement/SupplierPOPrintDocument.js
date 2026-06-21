import React from 'react';
import { formatDateDisplay } from '../../utils/formatDate';

/** Brand palette — Gold #F3E21A · Rich Black #000000 · Navy #1E3A5F */
const BRAND = {
  gold: '#F3E21A',
  black: '#000000',
  navy: '#1E3A5F',
  navyDark: '#152a45',
  navyLight: 'rgba(30, 58, 95, 0.06)',
  white: '#ffffff',
  border: 'rgba(30, 58, 95, 0.18)',
  textMuted: '#475569',
  pageBg: '#ffffff',
};

const FONT = {
  display: '"Libre Baskerville", "Georgia", "Times New Roman", serif',
  body: '"Source Sans 3", "Segoe UI", system-ui, sans-serif',
};

const SECTION_GAP = 14;
const ITEMS_FIRST_PAGE = 5;

export const SUPPLIER_PO_PRINT_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;500;600;700&display=swap');

@media print {
  html, body {
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body * { visibility: hidden !important; }
  #supplier-po-print-root,
  #supplier-po-print-root * { visibility: visible !important; }
  #supplier-po-print-root {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    background: ${BRAND.pageBg} !important;
    font-family: ${FONT.body} !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .po-print-page {
    page-break-after: always !important;
    break-after: page !important;
  }
  .po-print-page:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }
  .po-print-no-break { page-break-inside: avoid !important; break-inside: avoid !important; }
  @page {
    size: A4 portrait;
    margin: 8mm 9mm;
  }
}
@media screen {
  #supplier-po-print-root { display: none !important; }
}
`;

const pageStyle = {
  fontFamily: FONT.body,
  fontSize: '8.5pt',
  lineHeight: 1.45,
  color: BRAND.black,
  width: '100%',
  maxWidth: '192mm',
  margin: '0 auto',
  padding: '0',
  boxSizing: 'border-box',
  backgroundColor: BRAND.pageBg,
  position: 'relative',
  overflow: 'hidden',
};

const contentWrap = {
  position: 'relative',
  zIndex: 1,
  padding: '2mm 1mm',
};

const tabular = { fontVariantNumeric: 'tabular-nums' };

const fmtMoney = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const computePaymentDueDate = (po) => {
  if (po.payment_due_date) return po.payment_due_date;
  const terms = po.payment_terms || '';
  const match = terms.match(/(\d+)\s*days?/i);
  if (!match || !po.order_date) return null;
  const [y, m, d] = po.order_date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + parseInt(match[1], 10));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const lineTotal = (row) => {
  const q = parseFloat(row.quantity_ordered);
  const p = parseFloat(row.unit_price);
  if (Number.isNaN(q) || Number.isNaN(p)) return 0;
  return q * p;
};

const calcTotals = (po) => {
  const items = po.items || [];
  const subtotal = items.reduce((s, r) => s + lineTotal(r), 0);
  const sub = Math.round(subtotal * 100) / 100;
  if (po.tax_mode === 'IGST') {
    const pct = parseFloat(po.igst_percent) || 0;
    const igst = Math.round(sub * pct) / 100;
    return { subtotal: sub, cgst: 0, sgst: 0, igst, total: sub + igst };
  }
  const cgstPct = parseFloat(po.cgst_percent) || 0;
  const sgstPct = parseFloat(po.sgst_percent) || 0;
  const cgst = Math.round(sub * cgstPct) / 100;
  const sgst = Math.round(sub * sgstPct) / 100;
  return { subtotal: sub, cgst, sgst, igst: 0, total: sub + cgst + sgst };
};

function PrintSection({ children, last = false }) {
  return (
    <div
      className="po-print-no-break"
      style={{ marginBottom: last ? 0 : SECTION_GAP }}
    >
      {children}
    </div>
  );
}

const thStyle = (align = 'left') => ({
  border: `1px solid ${BRAND.navyDark}`,
  padding: '8px 10px',
  fontWeight: 600,
  fontSize: '7.5pt',
  fontFamily: FONT.body,
  textAlign: align,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  backgroundColor: BRAND.navy,
  color: BRAND.white,
});

const tdStyle = (align = 'left', alt = false) => ({
  border: `1px solid ${BRAND.border}`,
  padding: '7px 10px',
  fontSize: '8pt',
  fontFamily: FONT.body,
  textAlign: align,
  verticalAlign: 'middle',
  color: BRAND.black,
  backgroundColor: alt ? BRAND.navyLight : BRAND.white,
  lineHeight: 1.45,
});

const SectionHead = ({ title }) => (
  <div style={{
    background: BRAND.navy,
    color: BRAND.white,
    padding: '6px 12px',
    fontSize: '7.5pt',
    fontWeight: 600,
    fontFamily: FONT.body,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  }}
  >
    {title}
  </div>
);

const PartyCell = ({ title, children }) => (
  <div style={{ border: `1px solid ${BRAND.border}`, borderRadius: 6, overflow: 'hidden', height: '100%' }}>
    <SectionHead title={title} />
    <div style={{ padding: '10px 12px', background: BRAND.white, fontSize: '8pt', lineHeight: 1.45, fontFamily: FONT.body }}>
      {children}
    </div>
  </div>
);

const MetaChip = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, padding: '2px 0' }}>
    <span style={{
      fontSize: '6.5pt',
      color: BRAND.navy,
      fontWeight: 600,
      fontFamily: FONT.body,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}
    >
      {label}
    </span>
    <span style={{
      fontSize: '8pt',
      fontWeight: 500,
      color: BRAND.black,
      fontFamily: FONT.body,
      wordBreak: 'break-word',
      lineHeight: 1.35,
    }}
    >
      {value || '—'}
    </span>
  </div>
);

const getItemLabel = (row, trimsMap) => {
  const trim = row.trim ? trimsMap[row.trim] : null;
  const name = row.particulars || trim?.name || '—';
  const props = row.property_label || '';
  return props ? `${name} — ${props.replace(/\n/g, ' · ')}` : name;
};

function PoHeader({ po, company, companyName, addrLine, contactLine }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: company?.logo_url ? '54px 1fr auto' : '1fr auto',
      gap: 12,
      alignItems: 'center',
      padding: '14px 16px',
      background: BRAND.navy,
      borderRadius: 6,
      borderBottom: `3px solid ${BRAND.gold}`,
      color: BRAND.white,
    }}
    >
      {company?.logo_url && (
        <img
          src={company.logo_url}
          alt=""
          style={{ width: 50, height: 50, objectFit: 'contain', background: '#fff', borderRadius: 4, padding: 3 }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: '12pt', lineHeight: 1.2, color: BRAND.white }}>
          {companyName}
        </div>
        {company?.tagline && (
          <div style={{ fontSize: '7.5pt', color: 'rgba(255,255,255,0.88)', marginTop: 3, fontFamily: FONT.body }}>
            {company.tagline}
          </div>
        )}
        {addrLine && <div style={{ fontSize: '7.5pt', opacity: 0.88, marginTop: 4, fontFamily: FONT.body, lineHeight: 1.4 }}>{addrLine}</div>}
        <div style={{ fontSize: '7.5pt', opacity: 0.88, marginTop: 2, fontFamily: FONT.body }}>
          {[contactLine, company?.tax_registration && `GSTIN: ${company.tax_registration}`].filter(Boolean).join(' · ')}
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
        <div style={{ fontSize: '7.5pt', fontWeight: 600, letterSpacing: '0.16em', color: BRAND.white, fontFamily: FONT.body, opacity: 0.92 }}>
          PURCHASE ORDER
        </div>
        <div style={{ fontFamily: FONT.body, fontWeight: 700, fontSize: '11pt', marginTop: 4, color: BRAND.white, ...tabular }}>
          {po.po_number}
        </div>
      </div>
    </div>
  );
}

function PoMeta({ po, paymentDue, piLabel }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '10px 14px',
      padding: '12px 14px',
      background: BRAND.navyLight,
      border: `1px solid ${BRAND.border}`,
      borderRadius: 6,
    }}
    >
      <MetaChip label="Order Date" value={formatDateDisplay(po.order_date)} />
      <MetaChip label="Delivery" value={formatDateDisplay(po.expected_delivery_date)} />
      <MetaChip label="Payment Due" value={formatDateDisplay(paymentDue)} />
      <MetaChip label="Payment Terms" value={po.payment_terms} />
      <MetaChip label="Buyer PO Ref" value={po.reference_number} />
      {piLabel && <MetaChip label="PI Ref" value={piLabel} />}
      {po.delivery_terms && <MetaChip label="Delivery Terms" value={po.delivery_terms} />}
      {po.transport_paid_by && (
        <MetaChip
          label="Transport"
          value={po.transport_paid_by === 'SUPPLIER' ? 'Paid by Supplier' : 'Paid by Buyer'}
        />
      )}
      <MetaChip label="Tax Mode" value={po.tax_mode === 'IGST' ? 'IGST' : 'CGST + SGST'} />
    </div>
  );
}

function PoParties({ po }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 10,
    }}
    >
      <PartyCell title="Supplier">
        <strong style={{ fontSize: '8pt', fontFamily: FONT.body, color: BRAND.black }}>{po.vendor_name || '—'}</strong>
        {po.vendor_address && <div style={{ whiteSpace: 'pre-line', marginTop: 4, color: BRAND.textMuted }}>{po.vendor_address}</div>}
        {[po.attention && `Attn: ${po.attention}`, po.vendor_phone, po.vendor_email].filter(Boolean).map((t) => (
          <div key={t} style={{ color: BRAND.textMuted, marginTop: 2 }}>{t}</div>
        ))}
      </PartyCell>
      <PartyCell title="Bill To">
        <div style={{ whiteSpace: 'pre-line', color: BRAND.textMuted }}>{po.bill_to || '—'}</div>
      </PartyCell>
      <PartyCell title="Ship To">
        <div style={{ whiteSpace: 'pre-line', color: BRAND.textMuted }}>{po.ship_to || '—'}</div>
      </PartyCell>
    </div>
  );
}

function PoItemsTable({ items, trimsMap, startIndex = 0, showContinuation = false, poNumber }) {
  return (
    <div>
      {showContinuation && (
        <div style={{
          padding: '10px 14px',
          marginBottom: 10,
          background: BRAND.navy,
          color: BRAND.white,
          borderRadius: 6,
          fontSize: '8.5pt',
          fontWeight: 600,
          fontFamily: FONT.body,
          letterSpacing: '0.04em',
        }}
        >
          Purchase Order {poNumber} — Line Items (continued)
        </div>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: FONT.body, borderRadius: 6, overflow: 'hidden' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle('center'), width: '4%' }}>#</th>
            <th style={{ ...thStyle('left'), width: '36%' }}>Particulars</th>
            <th style={{ ...thStyle('center'), width: '9%' }}>HSN</th>
            <th style={{ ...thStyle('right'), width: '10%' }}>Qty</th>
            <th style={{ ...thStyle('center'), width: '7%' }}>Unit</th>
            <th style={{ ...thStyle('right'), width: '12%' }}>Rate ₹</th>
            <th style={{ ...thStyle('right'), width: '14%' }}>Amount ₹</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ ...tdStyle('center'), color: '#94a3b8', padding: 14 }}>No line items</td>
            </tr>
          ) : (
            items.map((row, i) => {
              const globalIndex = startIndex + i;
              const label = getItemLabel(row, trimsMap);
              return (
                <tr key={row.id ?? globalIndex}>
                  <td style={{ ...tdStyle('center', i % 2 === 1), fontWeight: 600 }}>{row.serial_no || globalIndex + 1}</td>
                  <td style={{ ...tdStyle('left', i % 2 === 1), wordBreak: 'break-word' }}>{label}</td>
                  <td style={{ ...tdStyle('center', i % 2 === 1), ...tabular }}>{row.hsn_code || '—'}</td>
                  <td style={{ ...tdStyle('right', i % 2 === 1), fontWeight: 600, ...tabular }}>{fmtMoney(row.quantity_ordered)}</td>
                  <td style={{ ...tdStyle('center', i % 2 === 1) }}>{row.unit || 'PCS'}</td>
                  <td style={{ ...tdStyle('right', i % 2 === 1), ...tabular }}>{fmtMoney(row.unit_price)}</td>
                  <td style={{ ...tdStyle('right', i % 2 === 1), fontWeight: 600, ...tabular }}>{fmtMoney(lineTotal(row))}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function PoFooter({ po, totals, companyName, company }) {
  return (
    <>
      <PrintSection>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 210px',
          gap: 14,
          alignItems: 'start',
        }}
        >
          <div style={{
            padding: '12px 14px',
            border: `1px solid ${BRAND.border}`,
            borderLeft: `4px solid ${BRAND.navy}`,
            borderRadius: 6,
            background: BRAND.white,
            minHeight: 52,
          }}
          >
            <div style={{
              fontSize: '7.5pt',
              fontWeight: 600,
              color: BRAND.navy,
              fontFamily: FONT.body,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 6,
            }}
            >
              Terms & Comments
            </div>
            <div style={{ fontSize: '7.5pt', color: BRAND.textMuted, whiteSpace: 'pre-line', lineHeight: 1.5, fontFamily: FONT.body }}>
              {po.po_comments || '—'}
            </div>
          </div>
          <div style={{ border: `1px solid ${BRAND.navy}`, borderRadius: 6, overflow: 'hidden' }}>
            {[
              ['Subtotal', totals.subtotal],
              ...(po.tax_mode === 'IGST'
                ? [[`IGST ${po.igst_percent || 0}%`, totals.igst]]
                : [[`CGST ${po.cgst_percent || 0}%`, totals.cgst], [`SGST ${po.sgst_percent || 0}%`, totals.sgst]]),
            ].map(([label, amt]) => (
              <div key={label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '6px 12px',
                fontSize: '8pt',
                fontFamily: FONT.body,
                borderBottom: `1px solid ${BRAND.border}`,
                background: BRAND.white,
                color: BRAND.black,
              }}
              >
                <span>{label}</span>
                <span style={{ fontWeight: 600, ...tabular }}>₹ {fmtMoney(amt)}</span>
              </div>
            ))}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: BRAND.navy,
              color: BRAND.white,
              fontWeight: 700,
              fontSize: '9pt',
              fontFamily: FONT.body,
            }}
            >
              <span>Grand Total</span>
              <span style={{ ...tabular }}>₹ {fmtMoney(totals.total)}</span>
            </div>
          </div>
        </div>
      </PrintSection>

      <PrintSection last>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          paddingTop: 4,
        }}
        >
          <div style={{
            padding: '12px 14px',
            border: `1px solid ${BRAND.border}`,
            borderTop: `3px solid ${BRAND.navy}`,
            borderRadius: 6,
            background: BRAND.white,
          }}
          >
            <div style={{ fontSize: '8pt', fontWeight: 700, color: BRAND.navy, fontFamily: FONT.display, marginBottom: 6 }}>
              For {companyName}
            </div>
            <div style={{ fontSize: '7.5pt', marginBottom: 10, fontFamily: FONT.body, color: BRAND.black }}>
              Placed by: {po.order_placed_by || '—'}
            </div>
            <div style={{ fontSize: '7.5pt', marginTop: 12, fontFamily: FONT.body, color: BRAND.black }}>
              Sign: _________________ &nbsp; Name: _________________ &nbsp; Date: _________
            </div>
          </div>
          <div style={{
            padding: '12px 14px',
            border: `1px solid ${BRAND.border}`,
            borderTop: `3px solid ${BRAND.navy}`,
            borderRadius: 6,
            background: BRAND.white,
          }}
          >
            <div style={{ fontSize: '8pt', fontWeight: 700, color: BRAND.navy, fontFamily: FONT.display, marginBottom: 6 }}>
              Supplier Acknowledgement
            </div>
            <div style={{ fontSize: '7.5pt', color: BRAND.textMuted, marginBottom: 10, fontFamily: FONT.body }}>
              Confirm acceptance of this order
            </div>
            <div style={{ fontSize: '7.5pt', marginTop: 12, fontFamily: FONT.body, color: BRAND.black }}>
              Sign: _________________ &nbsp; Name: {po.supplier_ack_name || '_________________'} &nbsp; Date: {formatDateDisplay(po.supplier_ack_date) === '—' ? '_________' : formatDateDisplay(po.supplier_ack_date)}
            </div>
          </div>
        </div>

        {company?.pdf_footer_note && (
          <div style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: `1px dashed ${BRAND.border}`,
            fontSize: '7pt',
            color: BRAND.textMuted,
            fontFamily: FONT.body,
            textAlign: 'center',
            whiteSpace: 'pre-line',
            lineHeight: 1.45,
          }}
          >
            {company.pdf_footer_note}
          </div>
        )}
      </PrintSection>
    </>
  );
}

function CompanyWatermark({ company, companyName }) {
  const text = (company?.watermark_text || companyName || '').trim();
  if (!text && !company?.logo_url) return null;

  const displayText = text.toUpperCase().slice(0, 48);

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', userSelect: 'none', zIndex: 0 }}>
      {company?.logo_url && (
        <img
          src={company.logo_url}
          alt=""
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 180,
            height: 180,
            objectFit: 'contain',
            opacity: 0.05,
          }}
        />
      )}
      {displayText && (
        <div style={{
          position: 'absolute',
          top: '48%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-35deg)',
          fontSize: '30pt',
          fontWeight: 700,
          fontFamily: FONT.display,
          color: 'rgba(30, 58, 95, 0.07)',
          letterSpacing: '0.14em',
          whiteSpace: 'nowrap',
        }}
        >
          {displayText}
        </div>
      )}
    </div>
  );
}

function PrintPage({ company, companyName, children }) {
  return (
    <div className="po-print-page" style={pageStyle}>
      <CompanyWatermark company={company} companyName={companyName} />
      <div style={contentWrap}>
        {children}
      </div>
    </div>
  );
}

export default function SupplierPOPrintDocument({ po, company, trimsMap = {} }) {
  if (!po) return null;

  const totals = calcTotals(po);
  const companyName = company?.legal_name || 'J.B. International';
  const paymentDue = computePaymentDueDate(po);
  const piLabel = po.pi_number || (po.pi && typeof po.pi === 'object' ? po.pi.pi_number : null);

  const addrLine = [
    company?.address_line1,
    company?.address_line2,
    [company?.city, company?.region_state, company?.postal_code].filter(Boolean).join(', '),
    company?.country,
  ].filter(Boolean).join(' · ');

  const contactLine = [
    company?.phone && `Tel: ${company.phone}`,
    company?.email,
  ].filter(Boolean).join(' · ');

  const allItems = po.items || [];
  const hasContinuation = allItems.length > ITEMS_FIRST_PAGE;
  const firstPageItems = hasContinuation ? allItems.slice(0, ITEMS_FIRST_PAGE) : allItems;
  const continuationItems = hasContinuation ? allItems.slice(ITEMS_FIRST_PAGE) : [];

  const headerProps = { po, company, companyName, addrLine, contactLine };

  if (!hasContinuation) {
    return (
      <PrintPage company={company} companyName={companyName}>
        <PrintSection><PoHeader {...headerProps} /></PrintSection>
        <PrintSection><PoMeta po={po} paymentDue={paymentDue} piLabel={piLabel} /></PrintSection>
        <PrintSection><PoParties po={po} /></PrintSection>
        <PrintSection><PoItemsTable items={firstPageItems} trimsMap={trimsMap} startIndex={0} /></PrintSection>
        <PoFooter po={po} totals={totals} companyName={companyName} company={company} />
      </PrintPage>
    );
  }

  return (
    <>
      <PrintPage company={company} companyName={companyName}>
        <PrintSection><PoHeader {...headerProps} /></PrintSection>
        <PrintSection><PoMeta po={po} paymentDue={paymentDue} piLabel={piLabel} /></PrintSection>
        <PrintSection><PoParties po={po} /></PrintSection>
        <PrintSection last><PoItemsTable items={firstPageItems} trimsMap={trimsMap} startIndex={0} /></PrintSection>
      </PrintPage>

      <PrintPage company={company} companyName={companyName}>
        <PrintSection><PoItemsTable items={continuationItems} trimsMap={trimsMap} startIndex={ITEMS_FIRST_PAGE} showContinuation poNumber={po.po_number} /></PrintSection>
        <PoFooter po={po} totals={totals} companyName={companyName} company={company} />
      </PrintPage>
    </>
  );
}
