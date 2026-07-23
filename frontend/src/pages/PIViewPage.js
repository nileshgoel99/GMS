import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, IconButton, CircularProgress, Chip, TextField, Grid, Paper, Divider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBack, Print, Edit, Save, Close, Assignment, Autorenew } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersAPI, companyAPI } from '../services/api';
import { slate } from '../theme/appTheme';
import { formatDateDMY } from '../utils/formatDate';
import PIDocumentFooter from '../components/orders/PIDocumentFooter';
import PIPrintSheet from '../components/orders/PIPrintSheet';
import { bindPiPrintPageFooters, installPiPrintPageFooters } from '../utils/piPrintPageFooters';

// ── Helpers ───────────────────────────────────────────────────────────────────
const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN',
  'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

function numToWords(n) {
  if (!n || n === 0) return 'ZERO';
  const num = Math.round(n);
  if (num < 20)       return ones[num];
  if (num < 100)      return tens[Math.floor(num / 10)] + (num % 10 ? ' ' + ones[num % 10] : '');
  if (num < 1000)     return ones[Math.floor(num / 100)] + ' HUNDRED' + (num % 100 ? ' ' + numToWords(num % 100) : '');
  if (num < 100000)   return numToWords(Math.floor(num / 1000)) + ' THOUSAND' + (num % 1000 ? ' ' + numToWords(num % 1000) : '');
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

function computePiTotal(pi) {
  const stored = parseFloat(pi?.total_amount);
  if (!Number.isNaN(stored) && stored > 0) return stored;
  return (pi?.lines || []).reduce((sum, line) => {
    const direct = parseFloat(line.line_value_usd);
    if (!Number.isNaN(direct) && direct > 0) return sum + direct;
    const price = parseFloat(line.unit_price_usd || 0);
    const qty = line.quantity_pcs || 0;
    return sum + price * qty;
  }, 0);
}

function getPiCurrency(pi) {
  return pi?.buyer_pos?.[0]?.currency || 'USD';
}

function getPiFooter(pi, company) {
  const po = pi?.buyer_pos?.[0];
  const dispatchFromPi = (pi?.date_of_dispatch_display || '').trim();
  const dispatchFromDelivery = pi?.delivery_date
    ? `${formatDateDMY(pi.delivery_date)} (EX-FACTORY DATE)`
    : '';
  const dispatchFromPo = po?.ex_factory_date
    ? `${formatDateDMY(po.ex_factory_date)} (EX-FACTORY DATE)`
    : '';
  return {
    dateOfDispatch: dispatchFromPi || dispatchFromDelivery || dispatchFromPo,
    paymentTerms: (pi?.payment_terms_display || po?.payment_terms || '').trim(),
    portOfDischarge: (pi?.port_of_discharge || po?.port_of_discharge || '').trim(),
    portOfLoading: (pi?.port_of_loading || po?.port_of_loading || '').trim(),
    incoTerms: (pi?.inco_terms || po?.inco_terms || po?.delivery_terms || '').trim(),
    ourBank: (pi?.our_bank_details || company?.our_bank_details || '').trim(),
    intermediaryBank: (pi?.intermediary_bank_details || '').trim(),
  };
}

const PRINT_STYLE = `
@media screen {
  .pi-print-sheet-foot { display: none !important; }
}
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm 12mm 16mm 12mm;
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
  #pi-view-print-root,
  #pi-view-print-root * {
    visibility: visible !important;
  }
  #pi-view-print-root {
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
  #pi-view-print-root .pi-print-sheet {
    width: 100% !important;
    border-collapse: collapse !important;
  }
  #pi-view-print-root .pi-print-sheet-body {
    display: table-row-group !important;
  }
  #pi-view-print-root .pi-print-sheet-body > tr {
    page-break-inside: auto !important;
    break-inside: auto !important;
  }
  #pi-view-print-root .pi-print-sheet-foot {
    display: table-footer-group !important;
  }
  #pi-view-print-root .pi-sheet-footer {
    padding-top: 4px !important;
    margin-top: 2mm !important;
  }
  #pi-view-print-root .pi-items-table {
    page-break-inside: auto !important;
  }
  #pi-view-print-root .pi-items-table thead {
    display: table-header-group !important;
  }
  #pi-view-print-root .pi-items-table tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
`;

// ── PI Document ───────────────────────────────────────────────────────────────
function PIDocument({ pi, company }) {
  if (!pi || !company) return null;

  const companyAddress = [
    company.address_line1, company.address_line2,
    [company.city, company.region_state, company.postal_code].filter(Boolean).join(', '),
    company.country,
  ].filter(Boolean).join(', ');

  const totalQty = (pi.lines || []).reduce((s, l) => s + (l.quantity_pcs || 0), 0);
  const totalAmt = computePiTotal(pi);
  const currency = getPiCurrency(pi);
  const footer = getPiFooter(pi, company);

  return (
    <PIPrintSheet
      companyName={company.legal_name || 'J B INTERNATIONAL'}
      centerText={pi.pi_number ? `PI ${pi.pi_number}` : 'PROFORMA INVOICE'}
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
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 900, fontSize: '16pt', lineHeight: 1.15 }}>
            {company.legal_name || 'J B INTERNATIONAL'}
          </Typography>
          {company.tagline && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#444', mt: 0.4 }}>{company.tagline}</Typography>
          )}
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', mt: 0.75, whiteSpace: 'pre-line', color: '#222', lineHeight: 1.4 }}>
            {companyAddress}
          </Typography>
          {company.phone && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#222', mt: 0.35 }}>
              TEL: {company.phone}{company.fax ? `  FAX: ${company.fax}` : ''}
            </Typography>
          )}
        </Box>
        {company.logo_url && (
          <Box component="img" src={company.logo_url} alt="logo"
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
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '11pt', mb: 0.35 }}>{pi.client_name}</Typography>
          {pi.client_address && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '10pt', whiteSpace: 'pre-line', lineHeight: 1.45 }}>{pi.client_address}</Typography>
          )}
        </Box>
        <Box sx={{ width: 220, flexShrink: 0 }}>
          {[
            ['DATE',          formatDateDMY(pi.order_date)],
            ['REF NO',        pi.pi_number],
            ['BUYER PO NO.',  pi.buyer_po_number ? `#${pi.buyer_po_number}` : ''],
          ].map(([label, val]) => val ? (
            <Box key={label} sx={{ display: 'flex', gap: 1.25, mb: 0.6, alignItems: 'baseline' }}>
              <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '10pt', minWidth: 108 }}>{label}:</Typography>
              <Typography sx={{ fontFamily: 'inherit', fontSize: '10pt' }}>{val}</Typography>
            </Box>
          ) : null)}
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
            {['S/N\nO.', 'ITEM', 'DESCRIPTION', 'QTY\nPCS.', `FOB UNIT\nPRICE (${currency})`, `VALUE\n(${currency})`].map((h) => (
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
              }}>{h}</Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {(pi.lines || []).map((line, i) => {
            const sb = (line.size_breakdown || []);
            const sizeDesc = sb.map((s) => `${s.size} – ${s.qty} pcs`).join(', ');
            const price = parseFloat(line.unit_price_usd || 0);
            const qty   = line.quantity_pcs || 0;
            const val   = parseFloat(line.line_value_usd || price * qty || 0);
            return (
              <Box component="tr" key={i}>
                <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '10px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'inherit' }}>{i + 1}.</Box>
                <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '10px', fontWeight: 700, verticalAlign: 'top', fontFamily: 'inherit', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {line.item_name}
                  {line.item_code && (
                    <Box component="span" sx={{ display: 'block', mt: '6px', fontWeight: 400, fontSize: '8.5pt', color: '#444' }}>
                      Code: <Box component="span" sx={{ fontWeight: 700, color: '#111' }}>{line.item_code}</Box>
                    </Box>
                  )}
                </Box>
                <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '10px', verticalAlign: 'top', fontFamily: 'inherit', fontSize: '9.5pt', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  {line.material && (
                    <Box component="span" sx={{ display: 'block', fontWeight: 700, fontSize: '9.5pt', mb: '6px' }}>{line.material}</Box>
                  )}
                  {line.color && (
                    <Box component="span" sx={{ display: 'block', mb: '6px', fontSize: '9pt', fontWeight: 600 }}>
                      Colour: {line.color}
                    </Box>
                  )}
                  <Box component="span" sx={{ display: 'block', color: '#333', lineHeight: 1.55, wordBreak: 'break-word' }}>{sizeDesc}</Box>
                </Box>
                <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '10px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{qty}</Box>
                <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '10px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{price.toFixed(3)}</Box>
                <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '10px', textAlign: 'right', verticalAlign: 'top', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{val.toFixed(3)}</Box>
              </Box>
            );
          })}
          <Box component="tr" sx={{ bgcolor: '#f0f0f0' }}>
            <Box component="td" colSpan={3} sx={{ border: '1px solid #000', px: '8px', py: '8px', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit' }}>TOTAL:-</Box>
            <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '8px', fontWeight: 700, textAlign: 'center', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{totalQty}</Box>
            <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '8px', fontFamily: 'inherit' }} />
            <Box component="td" sx={{ border: '1px solid #000', px: '8px', py: '8px', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{totalAmt.toFixed(3)}</Box>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ fontSize: '9.5pt', fontFamily: 'inherit', mt: 1, mb: 1 }}>
        {[
          ['VALUE IN WORD',     amountInWords(totalAmt, currency)],
          ['DATE OF DISPATCH',  footer.dateOfDispatch],
          ['PAYMENT TERMS',     footer.paymentTerms],
          ['INCO TERMS',        footer.incoTerms],
          ['PORT OF LOADING',   footer.portOfLoading],
          ['PORT OF DISCHARGE', footer.portOfDischarge],
        ].map(([label, val]) => (
          <Box key={label} sx={{ display: 'flex', gap: 1.5, mb: 0.85, fontFamily: 'inherit', alignItems: 'flex-start' }}>
            <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', minWidth: 150, flexShrink: 0 }}>{label}</Typography>
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9.5pt', flex: 1, wordBreak: 'break-word' }}>: {val || '—'}</Typography>
          </Box>
        ))}
        <Box sx={{ mt: 1.25, fontFamily: 'inherit' }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', mb: 0.35 }}>OUR BANK:</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', whiteSpace: 'pre-line', lineHeight: 1.45, pl: 0.5 }}>
            {footer.ourBank || '—'}
          </Typography>
        </Box>
        <Box sx={{ mt: 1.25, fontFamily: 'inherit' }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', mb: 0.35 }}>INTERMEDIARY BANK:</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', whiteSpace: 'pre-line', lineHeight: 1.45, pl: 0.5 }}>
            {footer.intermediaryBank || '—'}
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
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt' }}>FOR: {(pi.client_name || '').toUpperCase()}</Typography>
        </Box>
        <Box sx={{ flex: 1, textAlign: 'right' }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', mb: 0.5 }}>SIGNATURE &amp; SEAL</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt' }}>FOR: {(company.legal_name || '').toUpperCase()}</Typography>
        </Box>
      </Box>
      {company.email && (
        <Typography sx={{ fontFamily: 'inherit', fontSize: '8pt', textAlign: 'center', mt: 2.5, borderTop: '1px solid #ccc', pt: 1.25, color: '#555' }}>
          PLS. SEAL &amp; SIGN ON THE ABOVE AND RETURN US BY E-MAIL ID: {company.email}
        </Typography>
      )}

      <PIDocumentFooter
        company={company}
        refLabel={[pi.pi_number && `Ref: ${pi.pi_number}`, pi.buyer_po_number && `Buyer PO: #${pi.buyer_po_number}`].filter(Boolean).join('\n')}
      />
    </Box>
    </PIPrintSheet>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PIViewPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [pi, setPi]               = useState(null);
  const [company, setCompany]     = useState(null);
  const [loading, setLoading]     = useState(true);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailDraft, setDetailDraft]       = useState({});
  const [savingDetails, setSavingDetails]   = useState(false);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'pi-view-print-style';
    style.textContent = PRINT_STYLE;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    return bindPiPrintPageFooters('pi-view-print-root', () => ({
      marginTopMm: 12,
      marginBottomMm: 12,
    }));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [piRes, coRes] = await Promise.all([
          ordersAPI.getPI(id),
          companyAPI.getProfile(),
        ]);
        const piData = piRes.data;
        setPi(piData);
        setCompany(coRes.data);
        // Pre-populate the edit draft
        setDetailDraft({
          date_of_dispatch_display:  piData.date_of_dispatch_display || '',
          payment_terms_display:     piData.payment_terms_display || '',
          inco_terms:                piData.inco_terms || '',
          port_of_loading:           piData.port_of_loading || '',
          port_of_discharge:         piData.port_of_discharge || '',
          our_bank_details:          piData.our_bank_details || coRes.data.our_bank_details || '',
          intermediary_bank_details: piData.intermediary_bank_details || '',
        });
      } catch (e) {
        console.error(e);
        navigate('/orders');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const handlePrint = useCallback(() => {
    installPiPrintPageFooters('pi-view-print-root', {
      marginTopMm: 12,
      marginBottomMm: 12,
    });
    window.print();
  }, []);

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    try {
      const res = await ordersAPI.patchPI(id, detailDraft);
      setPi((prev) => ({ ...prev, ...res.data }));
      setEditingDetails(false);
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert('Save failed: ' + msg);
    } finally {
      setSavingDetails(false);
    }
  };

  const totalQty = (pi?.lines || []).reduce((s, l) => s + (l.quantity_pcs || 0), 0);
  const totalAmt = computePiTotal(pi);
  const currency = getPiCurrency(pi);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 1050, mx: 'auto' }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        mb: 3, p: 2, bgcolor: '#fff', borderRadius: 2,
        border: `1px solid ${slate[200]}`,
        boxShadow: `0 2px 12px ${alpha(slate[900], 0.06)}`,
        position: 'sticky', top: 12, zIndex: 100,
      }}>
        <IconButton size="small" onClick={() => navigate('/orders')} sx={{ bgcolor: slate[50] }}>
          <ArrowBack fontSize="small" />
        </IconButton>
        <Box>
          <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: slate[900] }}>
            {pi?.pi_number}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: slate[500] }}>
            {pi?.client_name} · {pi?.buyer_po_number ? `PO #${pi.buyer_po_number}` : ''}
          </Typography>
        </Box>
        <Chip label={pi?.status || 'CONFIRMED'} size="small" color="success"
          sx={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
        <Box sx={{ flex: 1 }} />
        {pi?.buyer_pos?.[0]?.id && (
          <Button startIcon={<Autorenew />} variant="outlined" size="small"
            onClick={() => navigate(`/buyer-pos/${pi.buyer_pos[0].id}/generate-pi`)}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, borderColor: '#b45309', color: '#b45309' }}>
            Regenerate PI
          </Button>
        )}
        <Button startIcon={<Assignment />} variant="outlined" size="small"
          onClick={() => navigate(`/indents/new?piId=${pi?.id}`)}
          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, borderColor: '#7c3aed', color: '#7c3aed', '&:hover': { borderColor: '#6d28d9', bgcolor: alpha('#7c3aed', 0.06) } }}>
          Create Indent
        </Button>
        <Button startIcon={editingDetails ? <Close /> : <Edit />} variant="outlined" size="small"
          onClick={() => setEditingDetails((v) => !v)}
          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5,
            borderColor: editingDetails ? '#e53935' : undefined,
            color: editingDetails ? '#e53935' : undefined }}>
          {editingDetails ? 'Cancel Edit' : 'Edit PI Details'}
        </Button>
        <Button startIcon={<Print />} variant="contained" onClick={handlePrint}
          sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5, px: 3 }}>
          Print / Download PDF
        </Button>
      </Box>

      {/* Summary bar */}
      <Box sx={{
        display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap',
        px: 3, py: 2, bgcolor: slate[900], borderRadius: '8px 8px 0 0',
      }}>
        {[
          ['Ref No', pi?.pi_number],
          ['Items', (pi?.lines || []).length],
          ['Total Qty', `${totalQty.toLocaleString()} pcs`],
        ].map(([label, val]) => (
          <Box key={label}>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4) }}>{label}</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: '#f1f5f9' }}>{val}</Typography>
          </Box>
        ))}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4) }}>Invoice Value</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '1.3rem', color: '#93c5fd', fontVariantNumeric: 'tabular-nums' }}>
            {currency} {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </Typography>
        </Box>
      </Box>

      {/* Edit PI Details panel */}
      {editingDetails && (
        <Paper elevation={0} sx={{ border: `2px solid #f59e0b`, borderRadius: 2, p: 3, mb: 0.5, bgcolor: '#fffbeb' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Edit sx={{ color: '#f59e0b', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#92400e' }}>
              Edit PI Footer Details
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#78716c', ml: 1 }}>
              These fields update the saved PI document immediately.
            </Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Date of Dispatch"
                placeholder="e.g. 30th JUNE 2025 (EX-FACTORY DATE)"
                value={detailDraft.date_of_dispatch_display}
                onChange={(e) => setDetailDraft((d) => ({ ...d, date_of_dispatch_display: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Payment Terms"
                placeholder="e.g. 30% ADVANCE, 70% AGAINST DOCUMENTS"
                value={detailDraft.payment_terms_display}
                onChange={(e) => setDetailDraft((d) => ({ ...d, payment_terms_display: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Inco Terms"
                placeholder="e.g. FOB NHAVA SHEVA"
                value={detailDraft.inco_terms}
                onChange={(e) => setDetailDraft((d) => ({ ...d, inco_terms: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Port of Loading"
                placeholder="e.g. NHAVA SHEVA PORT"
                value={detailDraft.port_of_loading}
                onChange={(e) => setDetailDraft((d) => ({ ...d, port_of_loading: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" label="Port of Discharge"
                placeholder="e.g. KHIDIRPUR PORT"
                value={detailDraft.port_of_discharge}
                onChange={(e) => setDetailDraft((d) => ({ ...d, port_of_discharge: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" multiline minRows={3} label="Our Bank"
                placeholder="Bank name, account details…"
                value={detailDraft.our_bank_details}
                onChange={(e) => setDetailDraft((d) => ({ ...d, our_bank_details: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" multiline minRows={3} label="Intermediary Bank"
                placeholder="Intermediary / correspondent bank details…"
                value={detailDraft.intermediary_bank_details}
                onChange={(e) => setDetailDraft((d) => ({ ...d, intermediary_bank_details: e.target.value }))} />
            </Grid>
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5, gap: 1.5 }}>
            <Button variant="outlined" size="small" onClick={() => setEditingDetails(false)}
              sx={{ fontWeight: 700, textTransform: 'none' }}>
              Cancel
            </Button>
            <Button variant="contained" size="small" startIcon={savingDetails ? <CircularProgress size={14} color="inherit" /> : <Save />}
              disabled={savingDetails} onClick={handleSaveDetails}
              sx={{ fontWeight: 700, textTransform: 'none', bgcolor: '#f59e0b', '&:hover': { bgcolor: '#d97706' } }}>
              {savingDetails ? 'Saving…' : 'Save Changes'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* A4 document (also the sole print target) */}
      <Box sx={{ p: { xs: 2, sm: 4 }, bgcolor: '#f8fafc', borderRadius: '0 0 8px 8px', border: `1px solid ${slate[200]}`, borderTop: 'none' }}>
        <Box
          id="pi-view-print-root"
          sx={{
            bgcolor: '#fff',
            p: { xs: 3, sm: 5 },
            boxShadow: `0 4px 32px ${alpha(slate[900], 0.1)}`,
            borderRadius: 1,
            minHeight: 800,
          }}
        >
          <PIDocument pi={pi} company={company} />
        </Box>
      </Box>
    </Box>
  );
}
