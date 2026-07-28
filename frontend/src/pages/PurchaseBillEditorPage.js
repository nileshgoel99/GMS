import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, Grid, Paper,
  IconButton, Autocomplete, CircularProgress, Table, TableHead,
  TableBody, TableRow, TableCell, Divider, FormControlLabel, Radio, RadioGroup,
  Alert, Tooltip, Chip,
} from '@mui/material';
import { ArrowBack, Save, Add, Delete, ReceiptLong, Search } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { procurementAPI, purchaseBillAPI } from '../services/api';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import BillLineParticulars from '../components/procurement/BillLineParticulars';
import PurchaseBillDocuments from '../components/procurement/PurchaseBillDocuments';
import { parseParticulars } from '../utils/parseParticulars';
import { computeBillPaymentDueDate, parsePaymentDays } from '../utils/paymentTerms';
import { formatDateDisplay } from '../utils/formatDate';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyLine = (serial = 1) => ({
  serial_no: serial,
  po_item: null,
  trim: null,
  trim_name: '',
  particulars: '',
  hsn_code: '',
  quantity_ordered: '',
  quantity_received_previous: '',
  quantity_billed: '',
  unit: 'PCS',
  unit_price: '',
});

const fmtQty = (v) => {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const catalogSearchText = (row) => {
  const parsed = parseParticulars(row.particulars);
  return [
    row.trim_name,
    parsed.name,
    row.particulars,
    row.hsn_code,
    ...(parsed.properties || []),
  ].filter(Boolean).join(' ').toLowerCase();
};

const catalogOptionLabel = (row) => {
  const parsed = parseParticulars(row.particulars);
  const name = (row.trim_name || parsed.name || row.particulars || 'Item').trim();
  const props = (parsed.properties || []).filter((p) => !p.startsWith('_pi_fabric_key:')).join(' · ');
  const pending = Math.max(
    0,
    (parseFloat(row.quantity_ordered) || 0) - (parseFloat(row.quantity_received_previous) || 0),
  );
  const pendingLabel = pending > 0 ? ` · pending ${fmtQty(pending)}` : '';
  return props ? `${name} — ${props}${pendingLabel}` : `${name}${pendingLabel}`;
};

const headCellSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: slate[600],
  py: 1.25,
  borderBottom: `2px solid ${slate[200]}`,
  whiteSpace: 'nowrap',
};

const bodyCellSx = {
  py: 1.5,
  verticalAlign: 'top',
  borderBottom: `1px solid ${slate[100]}`,
};

const mapLineFromApi = (row, i) => ({
  ...emptyLine(row.serial_no || i + 1),
  ...row,
  quantity_billed: String(row.quantity_billed ?? ''),
  quantity_ordered: row.quantity_ordered != null ? String(row.quantity_ordered) : '',
  quantity_received_previous: row.quantity_received_previous != null ? String(row.quantity_received_previous) : '',
  unit_price: String(row.unit_price ?? ''),
});

const applyRoundOff = ({ subtotal, cgst, sgst, igst }) => {
  const rawTotal = subtotal + cgst + sgst + igst;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;
  return { subtotal, cgst, sgst, igst, roundOff, total: roundedTotal };
};

const initForm = () => ({
  internal_ref: '',
  bill_number: '',
  supplier: null,
  supplier_name: '',
  purchase_order: null,
  po_number: '',
  bill_date: todayIso(),
  received_date: todayIso(),
  payment_terms: '',
  due_date: '',
  tax_mode: 'CGST_SGST',
  cgst_percent: '9',
  sgst_percent: '9',
  igst_percent: '18',
  status: 'OPEN',
  notes: '',
  items: [],
});

const syncDueDate = (prev, overrides = {}) => {
  const next = { ...prev, ...overrides };
  if (!Object.prototype.hasOwnProperty.call(overrides, 'due_date')) {
    next.due_date = computeBillPaymentDueDate({
      paymentTerms: next.payment_terms,
      billDate: next.bill_date,
      receivedDate: next.received_date || next.bill_date,
    });
  }
  return next;
};

const sectionLabelSx = { fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: slate[600] };

const formatApiError = (err, fallback = 'Something went wrong.') => {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === 'string') return data;
  if (data.detail) return String(data.detail);
  if (Array.isArray(data)) return data.map(String).join(' ');
  return Object.entries(data).map(([key, value]) => {
    const msg = Array.isArray(value) ? value.join(' ') : String(value);
    return key === 'non_field_errors' ? msg : `${key.replace(/_/g, ' ')}: ${msg}`;
  }).join(' · ');
};

export default function PurchaseBillEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const poIdFromQuery = searchParams.get('poId');

  const [form, setForm] = useState(initForm);
  const [documents, setDocuments] = useState([]);
  const [poCatalog, setPoCatalog] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [poRes, refRes] = await Promise.all([
          procurementAPI.getPending(),
          isNew ? purchaseBillAPI.getNextRef() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setPos(asList(poRes.data));
        if (isNew && refRes?.data?.internal_ref) {
          setForm((f) => ({ ...f, internal_ref: refRes.data.internal_ref }));
        }
        if (!isNew) {
          const billRes = await purchaseBillAPI.getById(id);
          if (cancelled) return;
          const b = billRes.data;
          setForm({
            ...b,
            purchase_order: b.purchase_order,
            po_number: b.po_number || '',
            payment_terms: b.payment_terms || '',
            due_date: b.due_date || b.payment_due_date || '',
            bill_date: b.bill_date || todayIso(),
            received_date: b.received_date || b.bill_date || todayIso(),
            cgst_percent: String(b.cgst_percent ?? 0),
            sgst_percent: String(b.sgst_percent ?? 0),
            igst_percent: String(b.igst_percent ?? 0),
            items: (b.items || []).map(mapLineFromApi),
          });
          setDocuments(b.documents || []);
          if (b.purchase_order) {
            try {
              const pref = await purchaseBillAPI.prefillFromPo(b.purchase_order);
              if (!cancelled) setPoCatalog((pref.data.items || []).map(mapLineFromApi));
            } catch (e) {
              console.error(e);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isNew]);

  const applyPoPrefill = useCallback(async (poId, selectedPo = null, { replaceItems = true } = {}) => {
    setCatalogLoading(true);
    setFormError('');
    try {
      const res = await purchaseBillAPI.prefillFromPo(poId);
      const d = res.data;
      const paymentTerms = String(d.payment_terms || selectedPo?.payment_terms || '').trim();
      const catalog = (d.items || []).map(mapLineFromApi);
      setPoCatalog(catalog);
      setItemSearch('');
      setForm((f) => syncDueDate(f, {
        purchase_order: d.purchase_order,
        po_number: d.po_number || '',
        supplier: d.supplier,
        supplier_name: d.supplier_name || '',
        payment_terms: paymentTerms,
        tax_mode: d.tax_mode || f.tax_mode,
        cgst_percent: String(d.cgst_percent ?? f.cgst_percent),
        sgst_percent: String(d.sgst_percent ?? f.sgst_percent),
        igst_percent: String(d.igst_percent ?? f.igst_percent),
        received_date: d.received_date || f.received_date,
        // Keep bill empty — user searches and adds only received lines
        ...(replaceItems ? { items: [] } : {}),
      }));
      setPos((prev) => {
        if (prev.some((p) => p.id === d.purchase_order)) return prev;
        return [
          ...prev,
          {
            id: d.purchase_order,
            po_number: d.po_number,
            vendor_name: d.supplier_name,
            payment_terms: paymentTerms,
          },
        ];
      });
    } catch (e) {
      console.error(e);
      setFormError(formatApiError(e, 'Could not load Supplier PO details.'));
      if (selectedPo?.payment_terms) {
        setForm((f) => syncDueDate(f, {
          purchase_order: selectedPo.id,
          po_number: selectedPo.po_number || '',
          supplier_name: selectedPo.vendor_name || f.supplier_name,
          payment_terms: String(selectedPo.payment_terms || '').trim(),
        }));
      }
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && isNew && poIdFromQuery) {
      const matched = pos.find((p) => String(p.id) === String(poIdFromQuery));
      applyPoPrefill(poIdFromQuery, matched || null);
    }
    // pos is read once when loading completes — do not re-run when pos updates after prefill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isNew, poIdFromQuery, applyPoPrefill]);

  const selectedPo = useMemo(
    () => pos.find((p) => p.id === form.purchase_order) || null,
    [pos, form.purchase_order],
  );

  const availableCatalog = useMemo(() => {
    const used = new Set(form.items.map((r) => r.po_item).filter(Boolean));
    return poCatalog.filter((r) => r.po_item && !used.has(r.po_item));
  }, [poCatalog, form.items]);

  const filterCatalogOptions = useCallback((options, { inputValue }) => {
    const q = (inputValue || '').trim().toLowerCase();
    if (!q) return options;
    const tokens = q.split(/\s+/).filter(Boolean);
    return options.filter((row) => {
      const hay = catalogSearchText(row);
      return tokens.every((t) => hay.includes(t));
    });
  }, []);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((s, row) => {
      const q = parseFloat(row.quantity_billed) || 0;
      const p = parseFloat(row.unit_price) || 0;
      return s + q * p;
    }, 0);
    const sub = Math.round(subtotal * 100) / 100;
    if (form.tax_mode === 'IGST') {
      const pct = parseFloat(form.igst_percent) || 0;
      const igst = Math.round(sub * pct) / 100;
      return applyRoundOff({ subtotal: sub, cgst: 0, sgst: 0, igst });
    }
    const cgstPct = parseFloat(form.cgst_percent) || 0;
    const sgstPct = parseFloat(form.sgst_percent) || 0;
    const cgst = Math.round(sub * cgstPct) / 100;
    const sgst = Math.round(sub * sgstPct) / 100;
    return applyRoundOff({ subtotal: sub, cgst, sgst, igst: 0 });
  }, [form.items, form.tax_mode, form.cgst_percent, form.sgst_percent, form.igst_percent]);

  const updateLine = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const addLine = () => setForm((f) => ({ ...f, items: [...f.items, emptyLine(f.items.length + 1)] }));
  const removeLine = (idx) => setForm((f) => ({
    ...f,
    items: f.items.filter((_, i) => i !== idx).map((row, i) => ({ ...row, serial_no: i + 1 })),
  }));

  const addCatalogLine = (row) => {
    if (!row?.po_item) return;
    setForm((f) => {
      if (f.items.some((r) => r.po_item === row.po_item)) return f;
      const mapped = mapLineFromApi(row, f.items.length);
      return { ...f, items: [...f.items, { ...mapped, serial_no: f.items.length + 1 }] };
    });
    setItemSearch('');
  };

  const loadAllRemaining = () => {
    if (!availableCatalog.length) return;
    setForm((f) => {
      const used = new Set(f.items.map((r) => r.po_item).filter(Boolean));
      const toAdd = poCatalog
        .filter((r) => r.po_item && !used.has(r.po_item))
        .map((row, i) => ({ ...mapLineFromApi(row, f.items.length + i), serial_no: f.items.length + i + 1 }));
      return { ...f, items: [...f.items, ...toAdd] };
    });
    setItemSearch('');
  };

  const handlePoSelect = async (_, po) => {
    if (!po) {
      setPoCatalog([]);
      setItemSearch('');
      setForm((f) => ({ ...f, purchase_order: null, po_number: '', items: [] }));
      return;
    }
    // Prefill payment terms immediately from the PO option, then refresh from API
    setForm((f) => syncDueDate(f, {
      purchase_order: po.id,
      po_number: po.po_number || '',
      supplier_name: po.vendor_name || f.supplier_name,
      payment_terms: String(po.payment_terms || '').trim() || f.payment_terms,
      items: [],
    }));
    await applyPoPrefill(po.id, po, { replaceItems: true });
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.bill_number.trim()) {
      setFormError('Supplier bill / invoice number is required.');
      return;
    }
    if (!form.supplier_name.trim()) {
      setFormError('Supplier name is required.');
      return;
    }
    const items = form.items.filter((r) => r.particulars?.trim() || r.trim);
    if (!items.length) {
      setFormError('Add at least one line item.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        internal_ref: form.internal_ref,
        bill_number: form.bill_number.trim(),
        supplier: form.supplier,
        supplier_name: form.supplier_name,
        purchase_order: form.purchase_order,
        bill_date: form.bill_date,
        received_date: form.bill_date || null,
        payment_terms: form.payment_terms,
        due_date: form.due_date || null,
        tax_mode: form.tax_mode,
        cgst_percent: parseFloat(form.cgst_percent) || 0,
        sgst_percent: parseFloat(form.sgst_percent) || 0,
        igst_percent: parseFloat(form.igst_percent) || 0,
        status: form.status === 'DRAFT' ? 'DRAFT' : 'OPEN',
        notes: form.notes,
        items: items.map((row, i) => ({
          serial_no: row.serial_no || i + 1,
          po_item: row.po_item,
          trim: row.trim,
          particulars: row.particulars,
          hsn_code: row.hsn_code,
          quantity_billed: parseFloat(row.quantity_billed) || 0,
          unit: row.unit || 'PCS',
          unit_price: parseFloat(row.unit_price) || 0,
        })),
      };
      if (isNew) {
        await purchaseBillAPI.create(payload);
      } else {
        await purchaseBillAPI.update(id, payload);
      }
      navigate('/purchase-bills');
    } catch (e) {
      setFormError(formatApiError(e, 'Save failed.'));
    } finally {
      setSaving(false);
    }
  };

  const sxInput = {
    '& .MuiInputBase-root': { borderRadius: 1.25, fontSize: '0.82rem' },
    '& .MuiInputBase-input': { py: 0.85, px: 1 },
  };
  const compactInputSx = {
    ...sxInput,
    '& .MuiInputBase-root': { ...sxInput['& .MuiInputBase-root'], height: 34 },
    '& .MuiInputBase-input': { ...sxInput['& .MuiInputBase-input'], textAlign: 'right', fontWeight: 700 },
  };

  if (loading) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      {formError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setFormError('')}>
          {formError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/purchase-bills')} size="small"><ArrowBack /></IconButton>
        <ReceiptLong sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', flex: 1 }}>
          {isNew ? 'Purchase Bill' : `Bill: ${form.internal_ref}`}
        </Typography>
        <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          disabled={saving} onClick={handleSave}
          sx={{ fontWeight: 800, textTransform: 'none', px: 3 }}>
          {saving ? 'Saving…' : 'Save Bill'}
        </Button>
      </Box>

      <Paper elevation={0} sx={sectionPaperSxByIndex(0)}>
        <Typography sx={{ ...sectionLabelSx, mb: 2, fontSize: '0.75rem' }}>Bill Details</Typography>

        <Typography
          sx={{
            ...sectionLabelSx,
            mb: 1,
            mt: 0.5,
            fontSize: '0.65rem',
            color: slate[500],
            borderBottom: `1px solid ${slate[100]}`,
            pb: 0.75,
          }}
        >
          Supplier & PO
        </Typography>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              size="small"
              options={pos}
              value={selectedPo}
              onChange={handlePoSelect}
              getOptionLabel={(o) => `${o.po_number} — ${o.vendor_name || ''}`}
              renderInput={(params) => <TextField {...params} label="Link Supplier PO" sx={sxInput} />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth size="small" label="Supplier *" value={form.supplier_name}
              onChange={(e) => setForm((f) => ({ ...f, supplier_name: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Payment Terms"
              value={form.payment_terms}
              onChange={(e) => setForm((f) => syncDueDate(f, { payment_terms: e.target.value }))}
              placeholder="e.g. Net 30 days"
              helperText={
                parsePaymentDays(form.payment_terms) != null
                  ? `${parsePaymentDays(form.payment_terms)} days from bill date`
                  : 'Copied from Supplier PO when linked'
              }
              sx={sxInput}
            />
          </Grid>
        </Grid>

        <Typography
          sx={{
            ...sectionLabelSx,
            mb: 1,
            mt: 0.5,
            fontSize: '0.65rem',
            color: slate[500],
            borderBottom: `1px solid ${slate[100]}`,
            pb: 0.75,
          }}
        >
          Document
        </Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Internal Ref" value={form.internal_ref} InputProps={{ readOnly: true }} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Supplier Bill No. *" value={form.bill_number}
              onChange={(e) => setForm((f) => ({ ...f, bill_number: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Bill Date"
              InputLabelProps={{ shrink: true }}
              value={form.bill_date}
              onChange={(e) => setForm((f) => syncDueDate(f, {
                bill_date: e.target.value,
                received_date: e.target.value,
              }))}
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Payment Due Date"
              InputLabelProps={{ shrink: true }}
              value={form.due_date || ''}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              helperText={
                form.due_date
                  ? `Due ${formatDateDisplay(form.due_date)}`
                  : 'Auto from payment terms + bill date'
              }
              sx={sxInput}
            />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(1), mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ ...sectionLabelSx, fontSize: '0.75rem' }}>Line Items</Typography>
          {!form.purchase_order && (
            <Button size="small" startIcon={<Add />} onClick={addLine} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Add Line
            </Button>
          )}
          {form.purchase_order && availableCatalog.length > 0 && (
            <Button
              size="small"
              onClick={loadAllRemaining}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Add all remaining ({availableCatalog.length})
            </Button>
          )}
        </Box>

        {form.purchase_order && (
          <Box sx={{ mb: 1.5 }}>
            <Autocomplete
              size="small"
              options={availableCatalog}
              filterOptions={filterCatalogOptions}
              value={null}
              inputValue={itemSearch}
              onInputChange={(_, v) => setItemSearch(v)}
              onChange={(_, row) => { if (row) addCatalogLine(row); }}
              getOptionLabel={catalogOptionLabel}
              isOptionEqualToValue={(a, b) => a?.po_item === b?.po_item}
              loading={catalogLoading}
              noOptionsText={
                catalogLoading
                  ? 'Loading PO items…'
                  : availableCatalog.length === 0
                    ? 'All PO lines are already on this bill'
                    : 'No matching trim / properties'
              }
              renderOption={(props, option) => {
                const parsed = parseParticulars(option.particulars);
                const name = (option.trim_name || parsed.name || 'Item').trim();
                const propsLines = (parsed.properties || []).filter((p) => !p.startsWith('_pi_fabric_key:'));
                const pending = Math.max(
                  0,
                  (parseFloat(option.quantity_ordered) || 0) - (parseFloat(option.quantity_received_previous) || 0),
                );
                return (
                  <Box component="li" {...props} key={option.po_item} sx={{ alignItems: 'flex-start !important', py: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.84rem', lineHeight: 1.3 }}>{name}</Typography>
                      {propsLines.length > 0 && (
                        <Typography sx={{ fontSize: '0.72rem', color: slate[600], mt: 0.25, lineHeight: 1.4 }}>
                          {propsLines.join(' · ')}
                        </Typography>
                      )}
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                        {option.hsn_code && (
                          <Chip size="small" label={`HSN ${option.hsn_code}`} sx={{ height: 20, fontSize: '0.65rem' }} />
                        )}
                        <Chip
                          size="small"
                          label={`Rate ₹${fmtQty(option.unit_price)}`}
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                        <Chip
                          size="small"
                          color={pending > 0 ? 'warning' : 'default'}
                          label={`Pending ${fmtQty(pending)} ${option.unit || ''}`}
                          sx={{ height: 20, fontSize: '0.65rem' }}
                        />
                      </Box>
                    </Box>
                  </Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search trim or properties to add"
                  placeholder="e.g. button black 18L"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <Search sx={{ color: slate[400], ml: 0.5, mr: 0.5, fontSize: 18 }} />
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                  sx={sxInput}
                />
              )}
            />
            <Typography sx={{ mt: 0.75, fontSize: '0.72rem', color: slate[500] }}>
              Type trim name or property values from the PO — only add the lines you received.
              {poCatalog.length > 0 && (
                <> · {availableCatalog.length} of {poCatalog.length} PO lines remaining</>
              )}
            </Typography>
          </Box>
        )}

        <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
          <Table size="small" sx={{ minWidth: 880 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(slate[50], 0.9) }}>
                <TableCell sx={{ ...headCellSx, width: 36 }}>#</TableCell>
                <TableCell sx={{ ...headCellSx, width: 220, maxWidth: 220 }}>Item</TableCell>
                <TableCell sx={{ ...headCellSx, width: 72 }}>HSN</TableCell>
                <TableCell sx={{ ...headCellSx, width: 130 }} align="right">Quantity</TableCell>
                <TableCell sx={{ ...headCellSx, width: 56 }}>Unit</TableCell>
                <TableCell sx={{ ...headCellSx, width: 88 }} align="right">Rate</TableCell>
                <TableCell sx={{ ...headCellSx, width: 96 }} align="right">Amount</TableCell>
                <TableCell sx={{ ...headCellSx, width: 40 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {form.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 3, textAlign: 'center' }}>
                    <Typography sx={{ fontSize: '0.85rem', color: slate[500] }}>
                      {form.purchase_order
                        ? 'No lines yet — search above and pick the items you received.'
                        : 'Link a Supplier PO, then search and add received items.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {form.items.map((row, idx) => {
                const amt = (parseFloat(row.quantity_billed) || 0) * (parseFloat(row.unit_price) || 0);
                const ordered = parseFloat(row.quantity_ordered);
                const prev = parseFloat(row.quantity_received_previous) || 0;
                const billed = parseFloat(row.quantity_billed) || 0;
                const pending = row.po_item
                  ? (Number.isNaN(ordered) ? 0 : ordered) - prev - billed
                  : null;
                const fromPo = Boolean(row.po_item);

                return (
                  <TableRow key={row.po_item || idx} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ ...bodyCellSx, color: slate[500], fontWeight: 700, fontSize: '0.8rem' }}>
                      {row.serial_no || idx + 1}
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, width: 220, maxWidth: 220 }}>
                      {fromPo || row.trim || row.particulars?.trim() ? (
                        <BillLineParticulars row={row} />
                      ) : (
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', fontStyle: 'italic' }}>
                          Empty line
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, fontSize: '0.78rem', fontWeight: 600, color: slate[700] }}>
                      {row.hsn_code || '—'}
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, textAlign: 'right' }}>
                      <Box sx={{ display: 'inline-block', minWidth: 108, textAlign: 'right' }}>
                        {fromPo && !Number.isNaN(ordered) && (
                          <Typography sx={{ fontSize: '0.68rem', color: slate[500], mb: 0.35 }}>
                            Ordered{' '}
                            <Box component="span" sx={{ fontWeight: 700, color: slate[800] }}>
                              {fmtQty(ordered)}
                            </Box>
                          </Typography>
                        )}
                        <TextField
                          size="small"
                          type="number"
                          placeholder="0"
                          value={row.quantity_billed}
                          onChange={(e) => updateLine(idx, 'quantity_billed', e.target.value)}
                          sx={{ width: '100%', ...compactInputSx }}
                        />
                        {fromPo && (
                          <Typography sx={{ fontSize: '0.62rem', color: slate[500], mt: 0.5, lineHeight: 1.35 }}>
                            {pending != null && (
                              <>
                                Pending{' '}
                                <Box
                                  component="span"
                                  sx={{
                                    fontWeight: 700,
                                    color: pending < 0 ? 'error.main' : pending > 0 ? '#b45309' : slate[700],
                                  }}
                                >
                                  {fmtQty(pending)}
                                </Box>
                              </>
                            )}
                            {prev > 0 && (
                              <>
                                {pending != null ? ' · ' : ''}
                                Received earlier{' '}
                                <Box component="span" sx={{ fontWeight: 600 }}>{fmtQty(prev)}</Box>
                              </>
                            )}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, fontSize: '0.78rem', fontWeight: 600 }}>
                      {row.unit || '—'}
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <TextField
                        size="small"
                        type="number"
                        value={row.unit_price}
                        onChange={(e) => updateLine(idx, 'unit_price', e.target.value)}
                        sx={{ width: '100%', ...compactInputSx }}
                      />
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, fontWeight: 700, whiteSpace: 'nowrap', fontSize: '0.82rem' }} align="right" className="font-numeric">
                      ₹ {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Tooltip title="Remove line">
                        <IconButton size="small" color="error" onClick={() => removeLine(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(2), mt: 2 }}>
        <Typography sx={{ ...sectionLabelSx, mb: 1.5, fontSize: '0.75rem' }}>Tax & Totals</Typography>
        <RadioGroup row value={form.tax_mode} onChange={(e) => setForm((f) => ({ ...f, tax_mode: e.target.value }))}>
          <FormControlLabel value="CGST_SGST" control={<Radio size="small" />} label="CGST + SGST" />
          <FormControlLabel value="IGST" control={<Radio size="small" />} label="IGST" />
        </RadioGroup>
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          {form.tax_mode === 'IGST' ? (
            <Grid item xs={6} sm={3}>
              <TextField fullWidth size="small" label="IGST %" value={form.igst_percent}
                onChange={(e) => setForm((f) => ({ ...f, igst_percent: e.target.value }))} sx={sxInput} />
            </Grid>
          ) : (
            <>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="CGST %" value={form.cgst_percent}
                  onChange={(e) => setForm((f) => ({ ...f, cgst_percent: e.target.value }))} sx={sxInput} />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField fullWidth size="small" label="SGST %" value={form.sgst_percent}
                  onChange={(e) => setForm((f) => ({ ...f, sgst_percent: e.target.value }))} sx={sxInput} />
              </Grid>
            </>
          )}
        </Grid>
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" multiline minRows={2} label="Notes" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: slate[50], border: `1px solid ${slate[200]}` }}>
              {[
                ['Subtotal', totals.subtotal],
                ...(form.tax_mode === 'IGST'
                  ? [[`IGST (${form.igst_percent}%)`, totals.igst]]
                  : [[`CGST (${form.cgst_percent}%)`, totals.cgst], [`SGST (${form.sgst_percent}%)`, totals.sgst]]),
                ['Round Off', totals.roundOff],
                ['Bill Total', totals.total],
              ].map(([label, val]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: label === 'Bill Total' ? 700 : 500 }}>{label}</Typography>
                  <Typography className="font-numeric" sx={{ fontWeight: 700, color: label === 'Bill Total' ? slate[900] : slate[800] }}>
                    ₹ {Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(3), mt: 2 }}>
        <Typography sx={{ ...sectionLabelSx, mb: 1.5, fontSize: '0.75rem' }}>Invoice Documents</Typography>
        <PurchaseBillDocuments
          billId={isNew ? null : Number(id)}
          documents={documents}
          onChange={setDocuments}
          onError={setFormError}
        />
      </Paper>
    </Box>
  );
}
