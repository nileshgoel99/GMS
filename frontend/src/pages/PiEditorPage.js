import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Chip,
  Stack,
  Paper,
  Divider,
  LinearProgress,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  ArrowBack,
  PictureAsPdf,
  Save,
  AutoAwesome,
  ListAlt,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ordersAPI, customersAPI } from '../services/api';
import { formatDispatchFromIso } from '../utils/formatDispatchDate';
import { usdAmountToWords } from '../utils/numberToWordsUsd';
import { lineValue, sumSizeQty } from '../utils/piLineHelpers';
import PiLineItemsSection from '../components/pi/PiLineItemsSection';

const DEFAULT_PAYMENT =
  '20% ADVANCE, REMAINING 80% AGAINST SHIPMENT DOCUMENTS';
const DEFAULT_OUR_BANK =
  'PUNJAB NATIONAL BANK, BIRHANA ROAD, KANPUR, A/C NO 188200UD00000066, SWIFT NO- PUNBINBBCKH';
const DEFAULT_INTERMEDIARY =
  'CITI BANK NA, 11 WALL STREET, INDIAN SERVICE MGMT CENTRE, NEW YORK, NY 11043, USA, SWIFT – CITIUS33';

const emptyLine = () => ({
  item_name: '',
  description: '',
  material: '',
  color: '',
  size_breakdown: [],
  quantity_pcs: '',
  unit_price_usd: '',
});

/** Long-form PI: anchor targets for section jump bar */
const PI_FORM_SECTIONS = [
  { id: 'pi-section-header', label: 'Header & buyer' },
  { id: 'pi-section-lines', label: 'Styles & qty' },
  { id: 'pi-section-totals', label: 'Totals' },
  { id: 'pi-section-dispatch', label: 'Dispatch & terms' },
  { id: 'pi-section-banks', label: 'Banking' },
  { id: 'pi-section-signoff', label: 'Sign-off' },
];

/** Light PI workspace — matches app shell textures */
const piCanvasSx = (theme) => ({
  position: 'relative',
  mx: { xs: -2, sm: -3, md: -4 },
  mt: { xs: -2, sm: -2.5 },
  mb: { xs: -4, md: -5 },
  px: { xs: 2, sm: 2.5, md: 3 },
  py: { xs: 2, sm: 2.5, md: 3 },
  borderRadius: { xs: 0, md: '20px' },
  overflow: 'hidden',
  bgcolor: alpha(theme.palette.background.default, 0.85),
  backgroundImage: `
    radial-gradient(ellipse 100% 72% at 6% 0%, ${alpha(theme.palette.primary.main, 0.07)}, transparent 54%),
    radial-gradient(ellipse 85% 55% at 100% 0%, ${alpha('#b45309', 0.045)}, transparent 50%),
    repeating-linear-gradient(-11deg, ${alpha('#334155', 0.018)} 0px, ${alpha('#334155', 0.018)} 1px, transparent 1px, transparent 6px),
    radial-gradient(circle at 1px 1px, ${alpha('#64748b', 0.04)} 1px, transparent 0)
  `,
  backgroundSize: 'auto, auto, auto, 18px 18px',
  boxShadow: `inset 0 1px 0 ${alpha('#fff', 0.9)}, 0 1px 0 ${alpha(theme.palette.divider, 0.9)}`,
});

const segmentPanel = (theme, accent) => ({
  position: 'relative',
  zIndex: 1,
  mt: 3,
  borderRadius: '14px',
  bgcolor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderTop: `4px solid ${accent}`,
  boxShadow: `0 8px 28px ${alpha(theme.palette.common.black, 0.05)}`,
  overflow: 'hidden',
});

const segmentHeaderSx = (theme) => ({
  px: 2,
  py: 1.25,
  bgcolor: alpha('#f8fafc', 0.98),
  borderBottom: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  flexWrap: 'wrap',
});

const segmentHeaderTitleProps = {
  component: 'span',
  variant: 'subtitle1',
  color: 'text.secondary',
  fontWeight: 600,
  letterSpacing: '-0.01em',
};

const segmentContentSx = {
  p: { xs: 3, sm: 3.5 },
  bgcolor: '#ffffff',
};

/** Small multiline blocks: short default height, grow with content up to maxRows (scroll after). */
const piCompactMultilineSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 1 },
  '& .MuiInputBase-input': { fontSize: '0.875rem', lineHeight: 1.45, py: 0.65 },
};

const sectionChipSx = (accent) => ({
  ml: 'auto',
  fontWeight: 700,
  bgcolor: alpha(accent, 0.1),
  color: accent,
  border: `1px solid ${alpha(accent, 0.28)}`,
});

const toolbarPaperSx = (theme) => ({
  mb: 3,
  p: 2,
  borderRadius: '16px',
  bgcolor: alpha(theme.palette.background.paper, 0.94),
  border: `1px solid ${theme.palette.divider}`,
  borderTop: `3px solid ${theme.palette.primary.main}`,
  boxShadow: `0 10px 36px ${alpha(theme.palette.common.black, 0.05)}`,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
});

const PiEditorPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const isCreate = id === 'new';

  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [customersList, setCustomersList] = useState([]);
  const [piNumberSaved, setPiNumberSaved] = useState('');
  const [piSectionTab, setPiSectionTab] = useState(0);

  const scrollToPiSection = useCallback((index) => {
    const id = PI_FORM_SECTIONS[index]?.id;
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handlePiSectionTabChange = useCallback(
    (_, value) => {
      setPiSectionTab(value);
      scrollToPiSection(value);
    },
    [scrollToPiSection],
  );

  const numericId = useMemo(() => {
    if (isCreate) return null;
    const n = parseInt(id, 10);
    return Number.isNaN(n) ? null : n;
  }, [id, isCreate]);

  const [formData, setFormData] = useState({
    pi_number: '',
    buyer_po_number: '',
    customer: '',
    order_date: format(new Date(), 'yyyy-MM-dd'),
    delivery_date: '',
    status: 'DRAFT',
    notes: '',
    date_of_dispatch_display: '',
    payment_terms_display: DEFAULT_PAYMENT,
    port_of_discharge: '',
    our_bank_details: DEFAULT_OUR_BANK,
    intermediary_bank_details: DEFAULT_INTERMEDIARY,
    seller_signatory_for: 'CID TRADING LTD',
    buyer_signatory_for: 'J B INTERNATIONAL',
    return_email_instruction: 'shivangi.jain@jbinternational.co.in',
  });

  const [piLines, setPiLines] = useState([emptyLine()]);
  const [piIntents, setPiIntents] = useState([]);
  const [intentsLoading, setIntentsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await customersAPI.getAll({ is_active: true });
        setCustomersList(res.data.results || res.data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const mapApiLinesToState = (lines) => {
    if (!lines || !lines.length) return [emptyLine()];
    return lines.map((l) => ({
      id: l.id,
      item_name: l.item_name || '',
      description: l.description || '',
      material: l.material || '',
      color: l.color || '',
      size_breakdown: Array.isArray(l.size_breakdown)
        ? l.size_breakdown.map((s) => ({
            size: s.size || '',
            qty: s.qty != null ? String(s.qty) : '',
          }))
        : [],
      quantity_pcs: l.quantity_pcs != null ? String(l.quantity_pcs) : '',
      unit_price_usd: l.unit_price_usd != null ? String(l.unit_price_usd) : '',
    }));
  };

  useEffect(() => {
    if (isCreate) {
      setLoading(false);
      return;
    }
    if (!numericId) {
      navigate('/orders');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await ordersAPI.getById(numericId);
        if (cancelled) return;
        const o = res.data;
        setPiNumberSaved(o.pi_number);
        setFormData({
          pi_number: o.pi_number,
          buyer_po_number: o.buyer_po_number || '',
          customer: o.customer || '',
          order_date: o.order_date,
          delivery_date: o.delivery_date || '',
          status: o.status,
          notes: o.notes || '',
          date_of_dispatch_display: o.date_of_dispatch_display || '',
          payment_terms_display: o.payment_terms_display || DEFAULT_PAYMENT,
          port_of_discharge: o.port_of_discharge || '',
          our_bank_details: o.our_bank_details || DEFAULT_OUR_BANK,
          intermediary_bank_details: o.intermediary_bank_details || DEFAULT_INTERMEDIARY,
          seller_signatory_for: o.seller_signatory_for || 'CID TRADING LTD',
          buyer_signatory_for: o.buyer_signatory_for || 'J B INTERNATIONAL',
          return_email_instruction: o.return_email_instruction || 'shivangi.jain@jbinternational.co.in',
        });
        setPiLines(mapApiLinesToState(o.lines));
        setIntentsLoading(true);
        try {
          const ir = await ordersAPI.getIntents({ pi: numericId });
          const list = Array.isArray(ir.data) ? ir.data : ir.data?.results;
          setPiIntents(Array.isArray(list) ? list : []);
        } catch (ie) {
          console.error(ie);
          setPiIntents([]);
        } finally {
          setIntentsLoading(false);
        }
      } catch (e) {
        console.error(e);
        alert('Could not load PI');
        navigate('/orders');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCreate, numericId, navigate]);

  const selectedCustomer = useMemo(
    () => customersList.find((c) => String(c.id) === String(formData.customer)),
    [customersList, formData.customer],
  );

  const updateLine = (index, patch) => {
    setPiLines((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const addLine = () => setPiLines((rows) => [...rows, emptyLine()]);
  const removeLine = (index) => {
    setPiLines((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)));
  };

  const moveLine = (index, delta) => {
    setPiLines((rows) => {
      const j = index + delta;
      if (j < 0 || j >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const duplicateLine = (index) => {
    setPiLines((rows) => {
      const src = rows[index];
      if (!src) return rows;
      const copy = {
        ...src,
        id: undefined,
        size_breakdown: (src.size_breakdown || []).map((r) => ({ size: r.size, qty: r.qty })),
      };
      return [...rows.slice(0, index + 1), copy, ...rows.slice(index + 1)];
    });
  };

  const addSizeRow = (lineIndex) => {
    setPiLines((rows) =>
      rows.map((r, i) =>
        i === lineIndex ? { ...r, size_breakdown: [...(r.size_breakdown || []), { size: '', qty: '' }] } : r,
      ),
    );
  };

  const updateSizeRow = (lineIndex, sizeIndex, patch) => {
    setPiLines((rows) =>
      rows.map((r, i) => {
        if (i !== lineIndex) return r;
        const sb = [...(r.size_breakdown || [])];
        sb[sizeIndex] = { ...sb[sizeIndex], ...patch };
        return { ...r, size_breakdown: sb };
      }),
    );
  };

  const removeSizeRow = (lineIndex, sizeIndex) => {
    setPiLines((rows) =>
      rows.map((r, i) => {
        if (i !== lineIndex) return r;
        const sb = (r.size_breakdown || []).filter((_, j) => j !== sizeIndex);
        return { ...r, size_breakdown: sb };
      }),
    );
  };

  const syncQtyFromSizes = (lineIndex) => {
    setPiLines((rows) =>
      rows.map((r, i) => (i === lineIndex ? { ...r, quantity_pcs: String(sumSizeQty(r.size_breakdown)) } : r)),
    );
  };

  const applyDispatchFromDelivery = () => {
    if (!formData.delivery_date) {
      alert('Set ex-factory / delivery date first.');
      return;
    }
    setFormData((fd) => ({
      ...fd,
      date_of_dispatch_display: formatDispatchFromIso(fd.delivery_date),
    }));
  };

  const buildLinesPayload = () =>
    piLines.map((l) => ({
      item_name: l.item_name.trim(),
      description: l.description || '',
      material: l.material || '',
      color: l.color || '',
      size_breakdown: (l.size_breakdown || [])
        .filter((s) => (s.size || '').trim() || (parseInt(s.qty, 10) || 0) > 0)
        .map((s) => ({ size: (s.size || '').trim(), qty: parseInt(s.qty, 10) || 0 })),
      quantity_pcs: parseInt(l.quantity_pcs, 10) || 0,
      unit_price_usd: l.unit_price_usd === '' || l.unit_price_usd == null ? null : String(l.unit_price_usd),
    }));

  const { grandQty, grandUsd } = useMemo(() => {
    let q = 0;
    let v = 0;
    piLines.forEach((l) => {
      const qi = parseInt(l.quantity_pcs, 10) || 0;
      q += qi;
      const lv = parseFloat(lineValue(l.quantity_pcs, l.unit_price_usd));
      if (!Number.isNaN(lv)) v += lv;
    });
    return { grandQty: q, grandUsd: v };
  }, [piLines]);

  const amountWords = useMemo(() => usdAmountToWords(grandUsd), [grandUsd]);

  const handleSubmit = async () => {
    if (!formData.customer) {
      alert('Select a customer — buyer (TO) details come from the customer record.');
      return;
    }
    const linesPayload = buildLinesPayload();
    if (linesPayload.some((l) => !l.item_name)) {
      alert('Each line needs a style / item name.');
      return;
    }
    if (!formData.pi_number.trim()) {
      alert('PI number is required.');
      return;
    }
    const payload = {
      pi_number: formData.pi_number.trim(),
      buyer_po_number: formData.buyer_po_number || '',
      customer: formData.customer,
      order_date: formData.order_date,
      delivery_date: formData.delivery_date || null,
      status: formData.status,
      notes: formData.notes || '',
      date_of_dispatch_display: formData.date_of_dispatch_display || '',
      payment_terms_display: formData.payment_terms_display || '',
      port_of_discharge: formData.port_of_discharge || '',
      our_bank_details: formData.our_bank_details || '',
      intermediary_bank_details: formData.intermediary_bank_details || '',
      seller_signatory_for: formData.seller_signatory_for || '',
      buyer_signatory_for: formData.buyer_signatory_for || '',
      return_email_instruction: formData.return_email_instruction || '',
      lines: linesPayload,
    };
    setSaving(true);
    try {
      if (isCreate) {
        const res = await ordersAPI.create(payload);
        navigate(`/orders/pi/${res.data.id}`, { replace: true });
      } else {
        await ordersAPI.update(numericId, payload);
        setPiNumberSaved(formData.pi_number.trim());
        alert('PI saved.');
      }
    } catch (error) {
      console.error(error);
      const msg =
        error.response?.data && typeof error.response.data === 'object'
          ? JSON.stringify(error.response.data)
          : error.message;
      alert(`Error saving PI: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = useCallback(async () => {
    if (isCreate || !numericId) return;
    try {
      const blob = await ordersAPI.downloadPiPdf(numericId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(piNumberSaved || formData.pi_number || 'PI').replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Could not download PDF.');
    }
  }, [isCreate, numericId, piNumberSaved, formData.pi_number]);

  if (loading) {
    return (
      <Box sx={{ ...piCanvasSx(theme), minHeight: 360 }}>
        <Box sx={{ position: 'relative', zIndex: 1, py: 6 }}>
          <LinearProgress
            sx={{
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              '& .MuiLinearProgress-bar': { bgcolor: theme.palette.primary.main },
            }}
          />
          <Typography align="center" sx={{ mt: 2, color: 'text.secondary', fontWeight: 600 }}>
            Loading PI…
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ ...piCanvasSx(theme), pb: 2 }}>
      <Box sx={{ position: 'relative', zIndex: 1, pb: { xs: 10, sm: 12 } }}>
        <Paper elevation={0} sx={toolbarPaperSx(theme)}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
              <Button startIcon={<ArrowBack />} variant="outlined" color="inherit" onClick={() => navigate('/orders')}>
                Back to list
              </Button>
              <Box>
                <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 800, letterSpacing: '0.14em' }}>
                  {isCreate ? 'New PI' : 'Edit PI'}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 600, color: 'text.primary', letterSpacing: '-0.02em' }}>
                  Proforma invoice workspace
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {!isCreate ? (
                <Button variant="outlined" color="primary" startIcon={<PictureAsPdf />} onClick={handleDownloadPdf}>
                  Download PDF
                </Button>
              ) : null}
              <Button variant="contained" color="primary" size="large" startIcon={<Save />} onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : isCreate ? 'Create PI' : 'Save PI'}
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {!isCreate && numericId ? (
          <Paper
            elevation={0}
            sx={{
              mb: 2.5,
              p: 2,
              borderRadius: '16px',
              border: (t) => `1px solid ${t.palette.divider}`,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.96),
            }}
          >
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              spacing={1.5}
              sx={{ mb: piIntents.length || intentsLoading ? 1.5 : 0 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <ListAlt color="primary" />
                <Box>
                  <Typography variant="subtitle1" fontWeight={800}>
                    Indents (material requirements)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add one intent per Excel sheet tab (e.g. Trousers, Unlined Jacket). Size grid and BOM match your
                    workshop indent.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate(`/intents?piFilter=${numericId}`)}
                >
                  List for this PI
                </Button>
                <Button variant="contained" size="small" onClick={() => navigate(`/intents/new?pi=${numericId}`)}>
                  New indent
                </Button>
              </Stack>
            </Stack>
            {intentsLoading ? (
              <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            ) : piIntents.length ? (
              <Stack spacing={0.75}>
                {piIntents.map((it) => (
                  <Stack
                    key={it.id}
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    justifyContent="space-between"
                    spacing={0.5}
                    sx={{
                      py: 1,
                      px: 1.25,
                      borderRadius: 1,
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                      border: (t) => `1px solid ${alpha(t.palette.divider, 0.8)}`,
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={800}>
                        {it.garment_sheet_name || it.indent_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {it.indent_number} · {it.total_garment_qty != null ? `${it.total_garment_qty} pcs` : '—'} ·{' '}
                        {it.status}
                      </Typography>
                    </Box>
                    <Button size="small" onClick={() => navigate(`/intents/${it.id}`)}>
                      Open
                    </Button>
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No indents yet — use <strong>New indent</strong> to add the first sheet (BOM, sizes, colours).
              </Typography>
            )}
          </Paper>
        ) : null}

        <Paper
          component="nav"
          elevation={0}
          aria-label="Jump to form section"
          sx={{
            mb: 2.5,
            borderRadius: '12px',
            border: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.background.paper, 0.96),
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            position: 'sticky',
            top: { xs: 72, sm: 84 },
            zIndex: 4,
          }}
        >
          <Tabs
            value={piSectionTab}
            onChange={handlePiSectionTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{
              minHeight: 44,
              '& .MuiTab-root': {
                minHeight: 44,
                py: 0.75,
                fontSize: '0.8125rem',
                textTransform: 'none',
                fontWeight: 600,
              },
            }}
          >
            {PI_FORM_SECTIONS.map((s) => (
              <Tab key={s.id} label={s.label} />
            ))}
          </Tabs>
        </Paper>

        {/* Header segment */}
        <Box
          id="pi-section-header"
          sx={{
            ...segmentPanel(theme, theme.palette.primary.main),
            scrollMarginTop: { xs: '100px', sm: '108px' },
          }}
        >
            <Box sx={segmentHeaderSx(theme)}>
              <AutoAwesome sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography {...segmentHeaderTitleProps}>PI header &amp; buyer</Typography>
              <Chip label="Section 1" size="small" sx={sectionChipSx(theme.palette.primary.main)} />
            </Box>
            <Box sx={segmentContentSx}>
        <Grid container spacing={3.5}>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              label="PI number / Ref"
              inputProps={{ autoComplete: 'off' }}
              value={formData.pi_number}
              onChange={(e) => setFormData({ ...formData, pi_number: e.target.value })}
              disabled={!isCreate}
              helperText={isCreate ? '' : 'PI number cannot be changed after create.'}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Buyer PO number"
              value={formData.buyer_po_number}
              onChange={(e) => setFormData({ ...formData, buyer_po_number: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              required
              select
              label="Customer"
              value={formData.customer}
              onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
            >
              <MenuItem value="" disabled>
                Select customer
              </MenuItem>
              {customersList.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.customer_code} — {c.company_legal_name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          {selectedCustomer ? (
            <Grid item xs={12}>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  borderWidth: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  borderColor: alpha(theme.palette.primary.main, 0.22),
                  borderLeftWidth: 4,
                  borderLeftColor: theme.palette.primary.main,
                  boxShadow: 'none',
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  Bill to (from customer master)
                </Typography>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 0.5 }}>
                  {selectedCustomer.company_legal_name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mt: 0.5 }}>
                  {[
                    selectedCustomer.address_line1,
                    selectedCustomer.address_line2,
                    [selectedCustomer.postal_code, selectedCustomer.city].filter(Boolean).join(' '),
                    selectedCustomer.region_state,
                    selectedCustomer.country,
                  ]
                    .filter(Boolean)
                    .join('\n')}
                </Typography>
              </Paper>
            </Grid>
          ) : null}
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="PI date"
              type="date"
              value={formData.order_date}
              onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Ex-factory / delivery date"
              type="date"
              value={formData.delivery_date}
              onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            >
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="CONFIRMED">Confirmed</MenuItem>
              <MenuItem value="IN_PRODUCTION">In production</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </TextField>
          </Grid>
        </Grid>
            </Box>
        </Box>

        <PiLineItemsSection
          lines={piLines}
          onAddLine={addLine}
          onRemoveLine={removeLine}
          onLineChange={updateLine}
          onMoveLine={moveLine}
          onDuplicateLine={duplicateLine}
          onAddSizeRow={addSizeRow}
          onUpdateSizeRow={updateSizeRow}
          onRemoveSizeRow={removeSizeRow}
          onSyncQtyFromSizes={syncQtyFromSizes}
          accent={theme.palette.info.main}
        />

        {/* Totals segment */}
        <Box
          id="pi-section-totals"
          sx={{
            ...segmentPanel(theme, theme.palette.success.main),
            scrollMarginTop: { xs: '100px', sm: '108px' },
          }}
        >
            <Box sx={segmentHeaderSx(theme)}>
              <Typography {...segmentHeaderTitleProps}>
                Totals &amp; amount in words
              </Typography>
              <Chip label="Section 3" size="small" sx={sectionChipSx(theme.palette.success.main)} />
            </Box>
            <Box
              sx={{
                p: 2.5,
                bgcolor: alpha(theme.palette.success.main, 0.06),
                backgroundImage: `linear-gradient(165deg, ${alpha('#ffffff', 0.98)} 0%, ${alpha(theme.palette.success.main, 0.07)} 55%, ${alpha(theme.palette.success.light, 0.12)} 100%)`,
                borderTop: `1px solid ${theme.palette.divider}`,
              }}
            >
        <Grid container spacing={3.5} alignItems="center">
          <Grid item xs={12} md={4}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.06em' }}>
              TOTAL QUANTITY
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 800,
                color: 'success.dark',
                mt: 0.5,
              }}
            >
              {grandQty} PCS
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.06em' }}>
              TOTAL VALUE (USD)
            </Typography>
            <Typography
              variant="h3"
              sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 800,
                color: 'success.dark',
                mt: 0.5,
              }}
            >
              {grandUsd.toFixed(2)}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: '0.06em' }}>
              AMOUNT IN WORDS
            </Typography>
            <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600, lineHeight: 1.55, mt: 0.5 }}>
              {amountWords}
            </Typography>
          </Grid>
        </Grid>
            </Box>
        </Box>

        {/* Commercial terms */}
        <Box
          id="pi-section-dispatch"
          sx={{
            ...segmentPanel(theme, theme.palette.info.dark),
            scrollMarginTop: { xs: '100px', sm: '108px' },
          }}
        >
            <Box sx={segmentHeaderSx(theme)}>
              <Typography {...segmentHeaderTitleProps}>
                Dispatch, payment &amp; port
              </Typography>
              <Chip label="Section 4" size="small" sx={sectionChipSx(theme.palette.info.dark)} />
            </Box>
            <Box sx={segmentContentSx}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-end' }}>
              <TextField
                fullWidth
                size="small"
                label="DATE OF DISPATCH (display text)"
                value={formData.date_of_dispatch_display}
                onChange={(e) => setFormData({ ...formData, date_of_dispatch_display: e.target.value })}
                placeholder="20TH FEBRUARY 2026 (EX-FACTORY DATE)"
                helperText="Shown on PI after DATE OF DISPATCH :"
                FormHelperTextProps={{ sx: { m: 0, mt: 0.5 } }}
              />
              <Button variant="outlined" size="small" onClick={applyDispatchFromDelivery} sx={{ flexShrink: 0 }}>
                Generate from date
              </Button>
            </Stack>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="PAYMENT TERMS"
              value={formData.payment_terms_display}
              onChange={(e) => setFormData({ ...formData, payment_terms_display: e.target.value })}
              multiline
              minRows={2}
              maxRows={6}
              placeholder="e.g. advance + balance on documents"
              sx={piCompactMultilineSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="PORT OF DISCHARGE"
              value={formData.port_of_discharge}
              onChange={(e) => setFormData({ ...formData, port_of_discharge: e.target.value })}
            />
          </Grid>
        </Grid>
            </Box>
        </Box>

        {/* Banks */}
        <Box
          id="pi-section-banks"
          sx={{
            ...segmentPanel(theme, theme.palette.success.dark),
            scrollMarginTop: { xs: '100px', sm: '108px' },
          }}
        >
            <Box sx={segmentHeaderSx(theme)}>
              <Typography {...segmentHeaderTitleProps}>
                Banking
              </Typography>
              <Chip label="Section 5" size="small" sx={sectionChipSx(theme.palette.success.dark)} />
            </Box>
            <Box sx={segmentContentSx}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="OUR BANK"
              value={formData.our_bank_details}
              onChange={(e) => setFormData({ ...formData, our_bank_details: e.target.value })}
              multiline
              minRows={2}
              maxRows={10}
              placeholder="Bank name, branch, A/C, SWIFT…"
              sx={piCompactMultilineSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="INTERMEDIARY BANK"
              value={formData.intermediary_bank_details}
              onChange={(e) => setFormData({ ...formData, intermediary_bank_details: e.target.value })}
              multiline
              minRows={2}
              maxRows={10}
              placeholder="Intermediary / correspondent details…"
              sx={piCompactMultilineSx}
            />
          </Grid>
        </Grid>
            </Box>
        </Box>

        {/* Signatures */}
        <Box
          id="pi-section-signoff"
          sx={{
            ...segmentPanel(theme, theme.palette.primary.dark),
            scrollMarginTop: { xs: '100px', sm: '108px' },
          }}
        >
            <Box sx={segmentHeaderSx(theme)}>
              <Typography {...segmentHeaderTitleProps}>
                Signatures &amp; return instruction
              </Typography>
              <Chip label="Section 6" size="small" sx={sectionChipSx(theme.palette.primary.dark)} />
            </Box>
            <Box sx={segmentContentSx}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="FOR (seller signatory)"
              value={formData.seller_signatory_for}
              onChange={(e) => setFormData({ ...formData, seller_signatory_for: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="FOR (buyer signatory)"
              value={formData.buyer_signatory_for}
              onChange={(e) => setFormData({ ...formData, buyer_signatory_for: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Return e-mail (seal & sign instruction)"
              value={formData.return_email_instruction}
              onChange={(e) => setFormData({ ...formData, return_email_instruction: e.target.value })}
              helperText="Shown as: PLS. SEAL & SIGN ON THE ABOVE AND RETURN US BY E-MAIL ID: …"
              FormHelperTextProps={{ sx: { m: 0, mt: 0.5 } }}
            />
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {`SIGNATURE & SEAL\nFOR: ${formData.seller_signatory_for || '—'}\n\n\nSIGNATURE & SEAL\nFOR: ${formData.buyer_signatory_for || '—'}\n\nPLS. SEAL & SIGN ON THE ABOVE AND RETURN US BY E-MAIL ID: ${formData.return_email_instruction || '—'}`}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              size="small"
              label="Internal notes"
              multiline
              minRows={2}
              maxRows={8}
              placeholder="Not shown on the PI (team only)"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              sx={piCompactMultilineSx}
            />
          </Grid>
        </Grid>
            </Box>
        </Box>

        <Paper
          elevation={0}
          sx={{
            position: 'sticky',
            bottom: { xs: 8, sm: 16 },
            mt: 3,
            p: 2,
            borderRadius: '14px',
            bgcolor: alpha(theme.palette.background.paper, 0.97),
            border: `1px solid ${theme.palette.divider}`,
            borderTop: `3px solid ${theme.palette.primary.main}`,
            boxShadow: `0 -4px 24px ${alpha(theme.palette.common.black, 0.06)}, 0 8px 28px ${alpha(theme.palette.common.black, 0.06)}`,
            zIndex: 6,
          }}
        >
          <Stack direction="row" justifyContent="flex-end" spacing={2} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" color="inherit" onClick={() => navigate('/orders')}>
              Cancel
            </Button>
            <Button variant="contained" color="primary" size="large" startIcon={<Save />} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving…' : isCreate ? 'Create PI' : 'Save PI'}
            </Button>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default PiEditorPage;
