import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, TextField, Grid, Paper,
  IconButton, CircularProgress, Alert, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBack, Print, Edit, CheckCircle, Autorenew } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersAPI, companyAPI } from '../services/api';
import { normalizeGarmentSize, sortSizeBreakdownEntries } from '../utils/normalizeGarmentSize';
import { slate } from '../theme/appTheme';
import PIDocumentFooter from '../components/orders/PIDocumentFooter';
import PIPrintSheet from '../components/orders/PIPrintSheet';
import { bindPiPrintPageFooters, installPiPrintPageFooters } from '../utils/piPrintPageFooters';
import { companyContactLines } from '../utils/formatCompanyPhone';

// ── Number to words ───────────────────────────────────────────────────────────
const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function numToWords(n) {
  if (!n || n === 0) return 'ZERO';
  const num = Math.round(n);
  if (num < 20)   return ones[num];
  if (num < 100)  return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000) return ones[Math.floor(num / 100)] + ' HUNDRED' + (num % 100 ? ' ' + numToWords(num % 100) : '');
  if (num < 100000)  return numToWords(Math.floor(num / 1000)) + ' THOUSAND' + (num % 1000 ? ' ' + numToWords(num % 1000) : '');
  if (num < 10000000) return numToWords(Math.floor(num / 100000)) + ' LAKH' + (num % 100000 ? ' ' + numToWords(num % 100000) : '');
  return numToWords(Math.floor(num / 10000000)) + ' CRORE' + (num % 10000000 ? ' ' + numToWords(num % 10000000) : '');
}

function amountInWords(amount, currency = 'USD') {
  if (!amount || Number(amount) === 0) return `${currency} ZERO ONLY`;
  const [intPart, decPart] = Number(amount).toFixed(2).split('.');
  let words = `${currency} ${numToWords(parseInt(intPart, 10))}`;
  if (parseInt(decPart, 10) > 0) words += ` AND CENTS ${numToWords(parseInt(decPart, 10))}`;
  return words + ' ONLY';
}

// Group PO lines that share the same style (name + colour + code); merge sizes only within that group.
function lineGroupKey(line) {
  return [
    (line.item_name || '').trim(),
    (line.color || '').trim(),
    (line.item_code || '').trim(),
  ].join('\0').toUpperCase();
}

function groupLines(lines) {
  const map = new Map();
  (lines || []).forEach((line) => {
    const key = lineGroupKey(line);
    if (!map.has(key)) {
      map.set(key, {
        item_code: line.item_code || '',
        item_name: line.item_name,
        fabric: line.fabric || '',
        color: line.color || '',
        unit_price: parseFloat(line.unit_price) || 0,
        discount: parseFloat(line.discount) || 0,
        uom: line.uom || 'PCS',
        sizes: [],
        quantity: 0,
      });
    }
    const grp = map.get(key);
    (line.size_breakdown || []).forEach((sb) => {
      const qty = parseInt(sb.qty) || 0;
      if (!qty) return;
      const size = normalizeGarmentSize(sb.size);
      if (!size) return;
      const existing = grp.sizes.find((s) => s.size === size);
      if (existing) existing.qty += qty;
      else grp.sizes.push({ size, qty });
    });
    grp.quantity += parseInt(line.quantity) || 0;
  });
  return Array.from(map.values()).map((g) => ({
    ...g,
    sizes: sortSizeBreakdownEntries(g.sizes),
    line_amount: g.unit_price && g.quantity
      ? g.quantity * g.unit_price * (1 - g.discount / 100)
      : 0,
  }));
}

function ordinalDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = d.getDate();
  const suffix = [, 'ST', 'ND', 'RD'][((day % 100) - 20) % 10] || [, 'ST', 'ND', 'RD'][day % 100] || 'TH';
  return `${day}${suffix} ${d.toLocaleString('en-US', { month: 'long' }).toUpperCase()} ${d.getFullYear()}`;
}

// ── Print styles: hide chrome, print only the single #pi-print-root sheet ─────
const PRINT_STYLE = `
@media screen {
  .pi-print-sheet-foot { display: none !important; }
}
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 12mm 16mm 12mm;
    /* Suppress browser default header/footer (date, time, title, URL) where supported */
    @top-left { content: none; }
    @top-center { content: none; }
    @top-right { content: none; }
    @bottom-left { content: none; }
    @bottom-center { content: none; }
    @bottom-right {
      content: "Page " counter(page) " / " counter(pages);
      font-family: "Times New Roman", Times, serif;
      font-size: 8pt;
      color: #333;
      vertical-align: top;
      padding-top: 1mm;
    }
  }
  html, body {
    background: #fff !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  body * {
    visibility: hidden !important;
  }
  #pi-print-root,
  #pi-print-root * {
    visibility: visible !important;
  }
  #pi-print-root {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    max-width: none !important;
    margin: 0 !important;
    padding: 6mm !important;
    background: #fff !important;
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    min-height: 0 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* Outer sheet: allow the document to flow across pages */
  #pi-print-root .pi-print-sheet {
    width: 100% !important;
    border-collapse: collapse !important;
  }
  #pi-print-root .pi-print-sheet-body {
    display: table-row-group !important;
  }
  #pi-print-root .pi-print-sheet-body > tr {
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  /* Repeating footer — takes layout space on every page (no overlay) */
  #pi-print-root .pi-print-sheet-foot {
    display: table-footer-group !important;
  }
  #pi-print-root .pi-sheet-footer {
    padding-top: 4px !important;
    margin-top: 2mm !important;
  }
  /* Only item rows avoid splitting mid-row */
  #pi-print-root .pi-items-table {
    page-break-inside: auto !important;
  }
  #pi-print-root .pi-items-table thead {
    display: table-header-group !important;
  }
  #pi-print-root .pi-items-table tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
`;

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GeneratePIPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [po, setPo] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(true); // true = edit form; false = preview only

  // Editable PI fields
  const [piDate, setPiDate]             = useState(new Date().toISOString().slice(0, 10));
  const [piRef, setPiRef]               = useState('');
  const [portOfDischarge, setPort]      = useState('');
  const [portOfLoading, setPortLoading] = useState('');
  const [incoTerms, setIncoTerms]       = useState('');
  const [ourBank, setOurBank]           = useState('');
  const [interBank, setInterBank]       = useState('');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');

  // Editable grouped items (user can adjust unit price per group)
  const [piLines, setPiLines] = useState([]);

  useEffect(() => {
    // Inject print style
    const style = document.createElement('style');
    style.id = 'pi-print-style';
    style.textContent = PRINT_STYLE;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    return bindPiPrintPageFooters('pi-print-root', () => ({
      marginTopMm: 12,
      marginBottomMm: 12,
    }));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [poRes, coRes, refRes, banksRes, accountsRes] = await Promise.all([
          ordersAPI.getBuyerPO(id),
          companyAPI.getProfile(),
          ordersAPI.getNextPiRef(),
          companyAPI.getCurrencyBanks(),
          companyAPI.getBankAccounts(),
        ]);
        const poData = poRes.data;
        const coData = coRes.data;
        const banks = banksRes.data.results || banksRes.data;
        const accounts = accountsRes.data.results || accountsRes.data || [];
        const currency = (poData.currency || 'USD').toUpperCase();
        const matchedBank = banks.find((b) => b.currency.toUpperCase() === currency);

        setPo(poData);
        setCompany(coData);
        setBankAccounts(accounts);
        setPaymentTerms(poData.payment_terms || '');
        setPort(poData.port_of_discharge || localStorage.getItem('pi_port') || '');
        setPortLoading(poData.port_of_loading || localStorage.getItem('pi_port_loading') || '');
        setIncoTerms(poData.inco_terms || poData.delivery_terms || localStorage.getItem('pi_inco_terms') || '');

        const storedBankId = localStorage.getItem('pi_our_bank_id');
        const preferred =
          accounts.find((a) => String(a.id) === String(storedBankId))
          || accounts.find((a) => a.is_default)
          || accounts[0]
          || null;
        if (preferred) {
          setSelectedBankId(String(preferred.id));
          setOurBank(preferred.bank_details || '');
        } else {
          setSelectedBankId('');
          setOurBank(coData.our_bank_details || localStorage.getItem('pi_our_bank') || '');
        }
        setInterBank(matchedBank?.intermediary_bank_details || localStorage.getItem('pi_inter_bank') || '');
        // Use existing pi_ref if already generated, otherwise use next available
        setPiRef(poData.pi_ref || refRes.data.pi_ref || '');
        setPiLines(groupLines(poData.lines));
      } catch (e) {
        console.error(e);
        navigate(-1);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const handleSelectBankAccount = (bankId) => {
    setSelectedBankId(bankId);
    if (!bankId) return;
    const account = bankAccounts.find((a) => String(a.id) === String(bankId));
    if (account) {
      setOurBank(account.bank_details || '');
      localStorage.setItem('pi_our_bank_id', String(account.id));
    }
  };

  const updateLine = (i, patch) =>
    setPiLines((ls) => ls.map((l, idx) => idx === i ? {
      ...l, ...patch,
      line_amount: ((patch.unit_price ?? l.unit_price) * (l.discount ? (1 - l.discount / 100) : 1) * l.quantity),
    } : l));

  const totalQty = piLines.reduce((s, l) => s + (l.quantity || 0), 0);
  const totalAmt = piLines.reduce((s, l) => s + (l.line_amount || 0), 0);

  const [confirming, setConfirming] = useState(false);

  const isRegenerate = Boolean(po?.pi);

  const handleConfirm = async () => {
    if (isRegenerate) {
      const indentNote = po.indent_count
        ? `\n\nWarning: ${po.indent_count} indent(s) linked to the current PI will also be deleted.`
        : '';
      const ok = window.confirm(
        `Replace existing PI (${po.pi_ref || 'current'}) with a new one from this PO?\n\nThe old PI will be permanently deleted.${indentNote}`,
      );
      if (!ok) return;
    }

    setConfirming(true);
    try {
      // Save bank/port/inco to localStorage for next time
      localStorage.setItem('pi_port', portOfDischarge);
      localStorage.setItem('pi_port_loading', portOfLoading);
      localStorage.setItem('pi_inco_terms', incoTerms);
      localStorage.setItem('pi_our_bank', ourBank);
      localStorage.setItem('pi_inter_bank', interBank);
      if (selectedBankId) localStorage.setItem('pi_our_bank_id', String(selectedBankId));

      const disc = (line) => line.discount ? (1 - line.discount / 100) : 1;

      const res = await ordersAPI.createPiFromBuyerPo(id, {
        pi_ref:                   piRef,
        pi_date:                  piDate,
        port_of_discharge:        portOfDischarge,
        port_of_loading:          portOfLoading,
        inco_terms:               incoTerms,
        payment_terms:            paymentTerms,
        our_bank_details:         ourBank,
        intermediary_bank_details: interBank,
        replace_existing:           isRegenerate,
        date_of_dispatch_display: po.ex_factory_date ? `${ordinalDate(po.ex_factory_date)} (EX-FACTORY DATE)` : '',
        lines: piLines.map((line) => ({
          item_code:      line.item_code,
          item_name:      line.item_name,
          fabric:         line.fabric,
          color:          line.color,
          sizes:          line.sizes,
          quantity:       line.quantity,
          unit_price:     line.unit_price,
          line_amount:    +(line.unit_price * disc(line) * line.quantity).toFixed(3),
        })),
      });

      // Navigate to the saved PI view
      navigate(`/orders/pi/${res.data.id}/view`, { replace: true });
    } catch (e) {
      console.error(e);
      const msg = e.response?.data ? JSON.stringify(e.response.data, null, 2) : e.message;
      alert('Error saving PI:\n' + msg);
    } finally {
      setConfirming(false);
    }
  };

  const handlePrint = useCallback(() => {
    installPiPrintPageFooters('pi-print-root', {
      marginTopMm: 12,
      marginBottomMm: 12,
    });
    window.print();
  }, []);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  // ── Address helper ──────────────────────────────────────────────────────────
  const companyAddress = [
    company?.address_line1,
    company?.address_line2,
    [company?.city, company?.region_state, company?.postal_code].filter(Boolean).join(', '),
    company?.country,
  ].filter(Boolean).join(', ');

  // ── PI Document (shared between screen preview and print) ───────────────────
  const contact = companyContactLines(company);
  const PIDocument = () => (
    <PIPrintSheet
      companyName={company?.legal_name || 'J B INTERNATIONAL'}
      centerText={piRef ? `PI ${piRef}` : 'PROFORMA INVOICE'}
    >
    <Box
      sx={{
        fontFamily: '"Times New Roman", Times, serif',
        color: '#000',
        fontSize: '10.5pt',
        lineHeight: 1.45,
        p: { xs: 1, sm: 0 },
      }}
    >
      {/* Letterhead */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          mb: 2.5,
          pb: 1.75,
          borderBottom: '2px solid #000',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 900, fontSize: '16pt', lineHeight: 1.15, color: '#000' }}>
            {company?.legal_name || 'J B INTERNATIONAL'}
          </Typography>
          {company?.tagline && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#444', mt: 0.4 }}>
              {company.tagline}
            </Typography>
          )}
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', mt: 0.75, whiteSpace: 'pre-line', color: '#222', lineHeight: 1.4 }}>
            {companyAddress}
          </Typography>
          {(contact.phone || contact.email || company?.fax) && (
            <Box sx={{ mt: 0.35 }}>
              {contact.phone && (
                <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#222' }}>
                  {contact.telLine}{company?.fax ? `  FAX: ${company.fax}` : ''}
                </Typography>
              )}
              {!contact.phone && company?.fax && (
                <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#222' }}>
                  FAX: {company.fax}
                </Typography>
              )}
              {contact.email && (
                <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#222' }}>
                  {contact.emailLine}
                </Typography>
              )}
            </Box>
          )}
        </Box>
        {company?.logo && (
          <Box component="img" src={company.logo} alt="logo"
            sx={{ height: 72, maxWidth: 120, objectFit: 'contain', flexShrink: 0 }} />
        )}
      </Box>

      {/* Title */}
      <Typography
        sx={{
          fontFamily: 'inherit',
          fontWeight: 700,
          fontSize: '14pt',
          textAlign: 'center',
          textDecoration: 'underline',
          mb: 2.5,
          mt: 0.5,
          letterSpacing: '0.08em',
        }}
      >
        PROFORMA INVOICE
      </Typography>

      {/* TO + Meta */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2.5, gap: 4, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '10pt', mb: 0.5 }}>TO,</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '11pt', mb: 0.35 }}>{po?.buyer_name}</Typography>
          {po?.buyer_address && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '10pt', whiteSpace: 'pre-line', lineHeight: 1.45 }}>{po.buyer_address}</Typography>
          )}
          {(po?.ship_to_name || po?.ship_to_address) && (
            <Box sx={{ mt: 1.75 }}>
              <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '10pt', mb: 0.5 }}>SHIP TO,</Typography>
              {po?.ship_to_name && (
                <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '11pt', mb: 0.35 }}>{po.ship_to_name}</Typography>
              )}
              {po?.ship_to_address && (
                <Typography sx={{ fontFamily: 'inherit', fontSize: '10pt', whiteSpace: 'pre-line', lineHeight: 1.45 }}>{po.ship_to_address}</Typography>
              )}
            </Box>
          )}
        </Box>
        <Box sx={{ width: 220, flexShrink: 0 }}>
          {[
            ['DATE', piDate ? new Date(piDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') : ''],
            ['REF NO', piRef],
            ['BUYER PO NO.', `#${po?.po_number}`],
          ].map(([label, val]) => (
            <Box key={label} sx={{ display: 'flex', gap: 1.25, mb: 0.6, alignItems: 'baseline' }}>
              <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '10pt', minWidth: 108 }}>{label}:</Typography>
              <Typography sx={{ fontFamily: 'inherit', fontSize: '10pt' }}>{val}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Items table */}
      <Box
        component="table"
        className="pi-items-table"
        sx={{
          width: '100%',
          tableLayout: 'fixed',
          borderCollapse: 'collapse',
          mb: 2.5,
          fontSize: '9.5pt',
          fontFamily: 'inherit',
        }}
      >
        <Box component="colgroup">
          <Box component="col" sx={{ width: '6%' }} />
          <Box component="col" sx={{ width: '22%' }} />
          <Box component="col" sx={{ width: '40%' }} />
          <Box component="col" sx={{ width: '10%' }} />
          <Box component="col" sx={{ width: '11%' }} />
          <Box component="col" sx={{ width: '11%' }} />
        </Box>
        <Box component="thead">
          <Box component="tr" sx={{ bgcolor: '#f0f0f0' }}>
            {['S/N\nO.', 'ITEM', 'DESCRIPTION', 'QTY\nPCS.', `FOB UNIT\nPRICE (${po?.currency || 'USD'})`, `VALUE\n(${po?.currency || 'USD'})`].map((h) => (
              <Box component="th" key={h} sx={{
                border: '1px solid #000',
                px: '8px',
                py: '8px',
                fontWeight: 700,
                fontFamily: 'inherit',
                verticalAlign: 'middle',
                textAlign: 'center',
                whiteSpace: 'pre-line',
                lineHeight: 1.35,
                fontSize: '9pt',
              }}>
                {h}
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {piLines.map((line, i) => {
              const sizeDesc = line.sizes.map((s) => `${s.size} – ${s.qty} pcs`).join(', ');
            const disc = line.discount ? (1 - line.discount / 100) : 1;
            const netPrice = line.unit_price * disc;
            const lineAmt = netPrice * line.quantity;
            return (
              <Box component="tr" key={i}>
                <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '10px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'inherit' }}>{i + 1}.</Box>
                <Box
                  component="td"
                  sx={{
                    border: '1px solid #000',
                    px: '8px',
                    py: '10px',
                    fontWeight: 700,
                    verticalAlign: 'top',
                    fontFamily: 'inherit',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {line.item_name}
                  {line.item_code && (
                    <Box component="span" sx={{ display: 'block', mt: '6px', fontWeight: 400, fontSize: '8.5pt', color: '#444', letterSpacing: '0.02em' }}>
                      Code: <Box component="span" sx={{ fontWeight: 700, color: '#111' }}>{line.item_code}</Box>
                    </Box>
                  )}
                </Box>
                <Box
                  component="td"
                  sx={{
                    border: '1px solid #000',
                    px: '8px',
                    py: '10px',
                    verticalAlign: 'top',
                    fontFamily: 'inherit',
                    fontSize: '9.5pt',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {line.fabric && (
                    <Box component="span" sx={{ display: 'block', fontWeight: 700, fontSize: '9.5pt', mb: '6px' }}>
                      {line.fabric}
                    </Box>
                  )}
                  {line.color && (
                    <Box component="span" sx={{ display: 'block', mb: '6px', fontSize: '9pt', fontWeight: 600 }}>
                      Colour: {line.color}
                    </Box>
                  )}
                  <Box component="span" sx={{ display: 'block', color: '#333', lineHeight: 1.55, wordBreak: 'break-word' }}>
                    {sizeDesc}
                  </Box>
                </Box>
                <Box
                  component="td"
                  sx={{
                    border: '1px solid #000',
                    px: '8px',
                    py: '10px',
                    textAlign: 'center',
                    verticalAlign: 'top',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {line.quantity || 0}
                </Box>
                <Box
                  component="td"
                  sx={{
                    border: '1px solid #000',
                    px: '8px',
                    py: '10px',
                    textAlign: 'center',
                    verticalAlign: 'top',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {Number(netPrice || 0).toFixed(3)}
                </Box>
                <Box
                  component="td"
                  sx={{
                    border: '1px solid #000',
                    px: '8px',
                    py: '10px',
                    textAlign: 'right',
                    verticalAlign: 'top',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {Number(lineAmt || 0).toFixed(3)}
                </Box>
              </Box>
            );
          })}
          {/* Total row */}
          <Box component="tr" sx={{ bgcolor: '#f0f0f0' }}>
            <Box component="td" colSpan={3} sx={{ border: '1px solid #000', px: '8px', py: '8px', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit' }}>TOTAL:-</Box>
            <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '8px', fontWeight: 700, textAlign: 'center', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{totalQty}</Box>
            <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '8px', fontFamily: 'inherit' }} />
            <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '8px', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{totalAmt.toFixed(3)}</Box>
          </Box>
        </Box>
      </Box>

      {/* Footer details */}
      <Box sx={{ fontSize: '9.5pt', fontFamily: 'inherit', mt: 1, mb: 1 }}>
        {[
          ['VALUE IN WORD',      amountInWords(totalAmt, po?.currency || 'USD')],
          ['DATE OF DISPATCH',   po?.ex_factory_date ? `${ordinalDate(po.ex_factory_date)} (EX-FACTORY DATE)` : ''],
          ['PAYMENT TERMS',      paymentTerms],
          ['INCO TERMS',         incoTerms],
          ['PORT OF LOADING',    portOfLoading],
          ['PORT OF DISCHARGE',  portOfDischarge],
        ].map(([label, val]) => (
          <Box key={label} sx={{ display: 'flex', gap: 1.5, mb: 0.85, fontFamily: 'inherit', alignItems: 'flex-start' }}>
            <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', minWidth: 150, flexShrink: 0 }}>{label}</Typography>
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9.5pt', flex: 1, wordBreak: 'break-word' }}>: {val || '—'}</Typography>
          </Box>
        ))}
        <Box sx={{ mt: 1.25, fontFamily: 'inherit' }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', mb: 0.35 }}>OUR BANK:</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', whiteSpace: 'pre-line', lineHeight: 1.45, pl: 0.5 }}>
            {ourBank || '—'}
          </Typography>
        </Box>
        <Box sx={{ mt: 1.25, fontFamily: 'inherit' }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', mb: 0.35 }}>INTERMEDIARY BANK:</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', whiteSpace: 'pre-line', lineHeight: 1.45, pl: 0.5 }}>
            {interBank || '—'}
          </Typography>
        </Box>
      </Box>

      {/* Signature */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          mt: 5,
          pt: 2,
          borderTop: '1px solid #999',
          fontFamily: 'inherit',
          fontSize: '9.5pt',
          gap: 3,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', mb: 0.5 }}>SIGNATURE &amp; SEAL</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt' }}>FOR: {po?.buyer_name?.toUpperCase()}</Typography>
        </Box>
        <Box sx={{ flex: 1, textAlign: 'right' }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', mb: 0.5 }}>SIGNATURE &amp; SEAL</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt' }}>FOR: {company?.legal_name?.toUpperCase()}</Typography>
        </Box>
      </Box>

      {company?.email && (
        <Typography sx={{ fontFamily: 'inherit', fontSize: '8pt', textAlign: 'center', mt: 2.5, borderTop: '1px solid #ccc', pt: 1.25, color: '#555' }}>
          PLS. SEAL &amp; SIGN ON THE ABOVE AND RETURN US BY E-MAIL ID: {company.email}
        </Typography>
      )}

      <PIDocumentFooter
        company={company}
        refLabel={[piRef && `Ref: ${piRef}`, po?.po_number && `Buyer PO: #${po.po_number}`].filter(Boolean).join('\n')}
      />
    </Box>
    </PIPrintSheet>
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* ── Toolbar ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        mb: 3, p: 2, bgcolor: '#fff', borderRadius: 2, border: `1px solid ${slate[200]}`,
        boxShadow: `0 2px 12px ${alpha(slate[900], 0.06)}`,
        position: 'sticky', top: 12, zIndex: 100,
      }}>
        <IconButton size="small" onClick={() => navigate(`/buyer-pos/${id}`)} sx={{ bgcolor: slate[50] }}>
          <ArrowBack fontSize="small" />
        </IconButton>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: slate[900] }}>
            {isRegenerate ? 'Regenerate Proforma Invoice' : 'Generate Proforma Invoice'}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: slate[500] }}>PO {po?.po_number} · {po?.buyer_name}</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        {isRegenerate && po?.pi && (
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/orders/pi/${po.pi}/view`)}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}
          >
            View current PI
          </Button>
        )}
        {!editing && (
          <Button startIcon={<Edit />} variant="outlined" size="small" onClick={() => setEditing(true)}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Edit Details
          </Button>
        )}
        {editing ? (
          <Button
            startIcon={isRegenerate ? <Autorenew /> : <CheckCircle />}
            variant="contained"
            onClick={handleConfirm}
            disabled={confirming}
            sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5, px: 3, ...(isRegenerate && { bgcolor: '#b45309', '&:hover': { bgcolor: '#92400e' } }) }}
          >
            {confirming ? (isRegenerate ? 'Replacing PI…' : 'Saving PI…') : (isRegenerate ? 'Replace PI' : 'Confirm & Save PI')}
          </Button>
        ) : (
          <Button startIcon={<Print />} variant="contained" onClick={handlePrint}
            sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5, px: 3 }}>
            Print / Download PDF
          </Button>
        )}
      </Box>

      {isRegenerate && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          A PI already exists for this PO ({po?.pi_ref || 'linked PI'}). Review the lines below, then click
          {' '}<strong>Replace PI</strong> to delete the old PI and save a new one from the current PO lines.
          {po?.indent_count > 0 && (
            <> {' '}<strong>{po.indent_count} indent(s)</strong> linked to the current PI will also be removed.</>
          )}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* ── Edit form ── */}
        {editing && (
          <Grid item xs={12} md={4}>
            <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${slate[200]}`, overflow: 'hidden' }}>
              <Box sx={{ px: 3, py: 2, bgcolor: slate[50], borderBottom: `1px solid ${slate[200]}` }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: slate[700] }}>PI Details</Typography>
              </Box>
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <TextField size="small" fullWidth label="PI Date" type="date"
                  value={piDate} onChange={(e) => setPiDate(e.target.value)}
                  InputLabelProps={{ shrink: true }} />
                <TextField size="small" fullWidth label="PI Ref No."
                  value={piRef} onChange={(e) => setPiRef(e.target.value)}
                  placeholder="e.g. JBI/26-27/11" />
                <TextField size="small" fullWidth label="Inco Terms"
                  value={incoTerms} onChange={(e) => setIncoTerms(e.target.value)}
                  placeholder="e.g. FOB NHAVA SHEVA" />
                <TextField size="small" fullWidth label="Port of Loading"
                  value={portOfLoading} onChange={(e) => setPortLoading(e.target.value)}
                  placeholder="e.g. NHAVA SHEVA PORT" />
                <TextField size="small" fullWidth label="Port of Discharge"
                  value={portOfDischarge} onChange={(e) => setPort(e.target.value)}
                  placeholder="e.g. KHIDIRPUR PORT" />
                <TextField size="small" fullWidth label="Payment Terms"
                  value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. BOL 60 DAYS" />
                <FormControl size="small" fullWidth>
                  <InputLabel id="pi-our-bank-select-label">Our Bank Account</InputLabel>
                  <Select
                    labelId="pi-our-bank-select-label"
                    label="Our Bank Account"
                    value={selectedBankId}
                    onChange={(e) => handleSelectBankAccount(e.target.value)}
                    displayEmpty
                  >
                    {bankAccounts.length === 0 && (
                      <MenuItem value="">
                        <em>No accounts — add in Company profile</em>
                      </MenuItem>
                    )}
                    {bankAccounts.map((a) => (
                      <MenuItem key={a.id} value={String(a.id)}>
                        {a.name}{a.is_default ? ' (default)' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" fullWidth multiline minRows={3} label="Our Bank Details"
                  value={ourBank} onChange={(e) => setOurBank(e.target.value)}
                  placeholder="Bank name, A/C No, SWIFT code…"
                  helperText={bankAccounts.length ? 'Filled from the selected account — edit if needed for this PI only' : undefined}
                />
                <TextField size="small" fullWidth multiline minRows={2} label="Intermediary Bank"
                  value={interBank} onChange={(e) => setInterBank(e.target.value)}
                  placeholder="Correspondent bank details…" />
              </Box>
            </Paper>

            {/* Item unit prices */}
            <Paper elevation={0} sx={{ mt: 2, borderRadius: 2, border: `1px solid ${slate[200]}`, overflow: 'hidden' }}>
              <Box sx={{ px: 3, py: 2, bgcolor: slate[50], borderBottom: `1px solid ${slate[200]}` }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: slate[700] }}>Adjust Unit Prices</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: slate[400] }}>Items grouped by style (name · colour · code)</Typography>
              </Box>
              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {piLines.map((line, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: slate[800] }} noWrap>
                        {line.item_name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: slate[400] }}>
                        {line.quantity} pcs · {line.sizes.length} sizes
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      type="number"
                      value={line.unit_price}
                      onChange={(e) => updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })}
                      InputProps={{ startAdornment: <Typography sx={{ fontSize: '0.8rem', color: slate[400], mr: 0.5 }}>$</Typography> }}
                      sx={{ width: 90,
                        '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
                        '& input[type=number]': { MozAppearance: 'textfield' },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* ── PI Preview ── */}
        <Grid item xs={12} md={editing ? 8 : 12}>
          <Paper elevation={0} sx={{ borderRadius: 2, border: `1px solid ${slate[200]}`, overflow: 'hidden' }}>
            {/* Summary banner */}
            <Box sx={{ px: 3, py: 1.75, bgcolor: slate[900], display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4) }}>Styles</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#f1f5f9' }}>{piLines.length}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4) }}>Total Qty</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{totalQty.toLocaleString()} pcs</Typography>
              </Box>
              <Box sx={{ flex: 1 }} />
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4) }}>Invoice Value</Typography>
                <Typography sx={{ fontWeight: 900, fontSize: '1.3rem', color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>
                  {po?.currency || 'USD'} {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>

            {/* A4-like white sheet (also the sole print target) */}
            <Box sx={{ p: { xs: 2, sm: 4 }, bgcolor: '#f8fafc' }}>
              <Box
                id="pi-print-root"
                sx={{
                  bgcolor: '#fff',
                  p: { xs: 3, sm: 5 },
                  boxShadow: `0 4px 32px ${alpha(slate[900], 0.1)}`,
                  borderRadius: 1,
                  minHeight: 800,
                }}
              >
                <PIDocument />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
