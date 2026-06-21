import React, { useState, useEffect, useCallback } from 'react';
import { Box, Button, Typography, IconButton, CircularProgress, Chip, TextField, Grid, Paper, Divider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { ArrowBack, Print, Edit, Save, Close, Assignment } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersAPI, companyAPI } from '../services/api';
import { slate } from '../theme/appTheme';
import { formatDateDMY } from '../utils/formatDate';

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
  if (!amount) return '';
  const [intPart, decPart] = Number(amount).toFixed(2).split('.');
  let words = `${currency} ${numToWords(parseInt(intPart))}`;
  if (parseInt(decPart) > 0) words += ` AND CENTS ${numToWords(parseInt(decPart))}`;
  return words + ' ONLY';
}

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #pi-view-print-root, #pi-view-print-root * { visibility: visible !important; }
  #pi-view-print-root {
    position: fixed; left: 0; top: 0; width: 100%;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { size: A4 portrait; margin: 14mm 14mm; }
}
@media screen { #pi-view-print-root { display: none; } }
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
  const totalAmt = parseFloat(pi.total_amount || 0);

  // Format date as DD-MM-YYYY
  const fmtDate = (d) => formatDateDMY(d);

  const currency = (pi.lines?.[0]?.currency) || 'USD';

  return (
    <Box sx={{ fontFamily: '"Times New Roman", serif', color: '#000', fontSize: '11pt', lineHeight: 1.4, p: 0 }}>
      {/* Letterhead */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, pb: 1.5, borderBottom: '2px solid #000' }}>
        <Box>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 900, fontSize: '18pt', lineHeight: 1.1 }}>
            {company.legal_name || 'J B INTERNATIONAL'}
          </Typography>
          {company.tagline && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#444', mt: 0.25 }}>{company.tagline}</Typography>
          )}
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', mt: 0.5, whiteSpace: 'pre-line', color: '#222' }}>
            {companyAddress}
          </Typography>
          {company.phone && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt', color: '#222' }}>
              TEL: {company.phone}{company.fax ? `  FAX: ${company.fax}` : ''}
            </Typography>
          )}
        </Box>
        {company.logo_url && (
          <Box component="img" src={company.logo_url} alt="logo" sx={{ height: 64, objectFit: 'contain', ml: 2 }} />
        )}
      </Box>

      {/* Title */}
      <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '14pt', textAlign: 'center', textDecoration: 'underline', mb: 2, letterSpacing: '0.06em' }}>
        PROFORMA INVOICE
      </Typography>

      {/* TO + Meta */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '10pt', mb: 0.3 }}>TO,</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '11pt' }}>{pi.client_name}</Typography>
          {pi.client_address && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '10pt', whiteSpace: 'pre-line' }}>{pi.client_address}</Typography>
          )}
        </Box>
        <Box sx={{ minWidth: 210 }}>
          {[
            ['DATE',          fmtDate(pi.order_date)],
            ['REF NO',        pi.pi_number],
            ['BUYER PO NO.',  pi.buyer_po_number ? `#${pi.buyer_po_number}` : ''],
          ].map(([label, val]) => val ? (
            <Box key={label} sx={{ display: 'flex', gap: 1, mb: 0.25 }}>
              <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '10pt', minWidth: 110 }}>{label}:</Typography>
              <Typography sx={{ fontFamily: 'inherit', fontSize: '10pt' }}>{val}</Typography>
            </Box>
          ) : null)}
        </Box>
      </Box>

      {/* Items table */}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: 1.5, fontSize: '10pt', fontFamily: 'inherit' }}>
        <Box component="thead">
          <Box component="tr" sx={{ bgcolor: '#f0f0f0' }}>
            {['S/N\nO.', 'ITEM', 'DESCRIPTION', 'QTY\nPCS.', `FOB UNIT\nPRICE (USD)`, `VALUE\n(USD)`].map((h) => (
              <Box component="th" key={h} sx={{
                border: '1px solid #000', p: '5px 7px', fontWeight: 700, fontFamily: 'inherit',
                verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.3, fontSize: '9.5pt',
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
                <Box component="td" sx={{ border: '1px solid #000', p: '6px 7px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'inherit' }}>{i + 1}.</Box>
                <Box component="td" sx={{ border: '1px solid #000', p: '6px 7px', fontWeight: 700, verticalAlign: 'top', fontFamily: 'inherit' }}>
                  {line.item_name}
                  {line.item_code && (
                    <Box component="span" sx={{ display: 'block', mt: '4px', fontWeight: 400, fontSize: '8.5pt', color: '#444' }}>
                      Code: <Box component="span" sx={{ fontWeight: 700, color: '#111' }}>{line.item_code}</Box>
                    </Box>
                  )}
                </Box>
                <Box component="td" sx={{ border: '1px solid #000', p: '6px 7px', verticalAlign: 'top', fontFamily: 'inherit', fontSize: '9.5pt' }}>
                  {line.material && (
                    <Box component="span" sx={{ display: 'block', fontWeight: 700, fontSize: '9.5pt', mb: '4px' }}>{line.material}</Box>
                  )}
                  {line.color && (
                    <Box component="span" sx={{ display: 'inline-block', mb: '5px' }}>
                      <Box component="span" sx={{ display: 'inline-block', px: '6px', py: '2px', border: '1px solid #666', borderRadius: '3px', fontSize: '8.5pt', fontStyle: 'italic', fontWeight: 600, color: '#222', background: '#f0f0f0' }}>
                        Colour: {line.color}
                      </Box>
                    </Box>
                  )}
                  <Box component="span" sx={{ display: 'block', color: '#333', lineHeight: 1.5 }}>{sizeDesc}</Box>
                </Box>
                <Box component="td" sx={{ border: '1px solid #000', p: '6px 7px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'inherit' }}>{qty}</Box>
                <Box component="td" sx={{ border: '1px solid #000', p: '6px 7px', textAlign: 'center', verticalAlign: 'top', fontFamily: 'inherit' }}>{price.toFixed(3)}</Box>
                <Box component="td" sx={{ border: '1px solid #000', p: '6px 7px', textAlign: 'right', verticalAlign: 'top', fontFamily: 'inherit' }}>{val.toFixed(3)}</Box>
              </Box>
            );
          })}
          <Box component="tr" sx={{ bgcolor: '#f0f0f0' }}>
            <Box component="td" colSpan={3} sx={{ border: '1px solid #000', p: '5px 7px', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit' }}>TOTAL:-</Box>
            <Box component="td" sx={{ border: '1px solid #000', p: '5px 7px', fontWeight: 700, textAlign: 'center', fontFamily: 'inherit' }}>{totalQty}</Box>
            <Box component="td" sx={{ border: '1px solid #000', fontFamily: 'inherit' }} />
            <Box component="td" sx={{ border: '1px solid #000', p: '5px 7px', fontWeight: 700, textAlign: 'right', fontFamily: 'inherit' }}>{totalAmt.toFixed(3)}</Box>
          </Box>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ fontSize: '9.5pt', fontFamily: 'inherit', mt: 1.5 }}>
        {[
          ['VALUE IN WORD',     amountInWords(totalAmt, currency)],
          ['DATE OF DISPATCH',  pi.date_of_dispatch_display || (pi.delivery_date ? `${pi.delivery_date} (EX-FACTORY DATE)` : '')],
          ['PAYMENT TERMS',     pi.payment_terms_display],
          ['INCO TERMS',        pi.inco_terms],
          ['PORT OF LOADING',   pi.port_of_loading],
          ['PORT OF DISCHARGE', pi.port_of_discharge],
        ].filter(([, v]) => v).map(([label, val]) => (
          <Box key={label} sx={{ display: 'flex', gap: 1, mb: 0.4 }}>
            <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', minWidth: 160 }}>{label}</Typography>
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9.5pt' }}>: {val}</Typography>
          </Box>
        ))}
        {pi.our_bank_details && (
          <Box sx={{ mt: 0.5 }}>
            <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', display: 'inline' }}>OUR BANK: </Typography>
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9.5pt', display: 'inline' }}>- {pi.our_bank_details}</Typography>
          </Box>
        )}
        {pi.intermediary_bank_details && (
          <Box sx={{ mt: 0.4 }}>
            <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt', display: 'inline' }}>INTERMEDIARY BANK: </Typography>
            <Typography sx={{ fontFamily: 'inherit', fontSize: '9.5pt', display: 'inline' }}>- {pi.intermediary_bank_details}</Typography>
          </Box>
        )}
      </Box>

      {/* Signature */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 5, pt: 1, borderTop: '1px solid #ccc', fontFamily: 'inherit', fontSize: '9.5pt' }}>
        <Box>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt' }}>SIGNATURE &amp; SEAL</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt' }}>FOR: {(pi.client_name || '').toUpperCase()}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '9.5pt' }}>SIGNATURE &amp; SEAL</Typography>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '9pt' }}>FOR: {(company.legal_name || '').toUpperCase()}</Typography>
        </Box>
      </Box>
      {company.email && (
        <Typography sx={{ fontFamily: 'inherit', fontSize: '8pt', textAlign: 'center', mt: 1.5, borderTop: '1px solid #eee', pt: 0.75, color: '#555' }}>
          PLS. SEAL &amp; SIGN ON THE ABOVE AND RETURN US BY E-MAIL ID: {company.email}
        </Typography>
      )}
    </Box>
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

  const handlePrint = useCallback(() => window.print(), []);

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
  const totalAmt = parseFloat(pi?.total_amount || 0);

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
          <Button startIcon={<Edit />} variant="outlined" size="small"
            onClick={() => navigate(`/buyer-pos/${pi.buyer_pos[0].id}/generate-pi`)}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Re-generate PI
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
            USD {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
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

      {/* A4 document */}
      <Box sx={{ p: { xs: 2, sm: 4 }, bgcolor: '#f8fafc', borderRadius: '0 0 8px 8px', border: `1px solid ${slate[200]}`, borderTop: 'none' }}>
        <Box sx={{ bgcolor: '#fff', p: { xs: 3, sm: 5 }, boxShadow: `0 4px 32px ${alpha(slate[900], 0.1)}`, borderRadius: 1, minHeight: 800 }}>
          <PIDocument pi={pi} company={company} />
        </Box>
      </Box>

      {/* Hidden print root */}
      <Box id="pi-view-print-root">
        <PIDocument pi={pi} company={company} />
      </Box>
    </Box>
  );
}
