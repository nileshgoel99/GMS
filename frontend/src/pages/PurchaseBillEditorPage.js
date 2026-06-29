import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, MenuItem, Grid, Paper,
  IconButton, Autocomplete, CircularProgress, Table, TableHead,
  TableBody, TableRow, TableCell, Divider, FormControlLabel, Radio, RadioGroup,
} from '@mui/material';
import { ArrowBack, Save, Add, Delete, ReceiptLong } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { procurementAPI, purchaseBillAPI } from '../services/api';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import BillLineParticulars from '../components/procurement/BillLineParticulars';

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

const initForm = () => ({
  internal_ref: '',
  bill_number: '',
  supplier: null,
  supplier_name: '',
  purchase_order: null,
  po_number: '',
  bill_date: todayIso(),
  received_date: todayIso(),
  due_date: '',
  payment_terms: '',
  tax_mode: 'CGST_SGST',
  cgst_percent: '9',
  sgst_percent: '9',
  igst_percent: '18',
  amount_paid: '0',
  status: 'OPEN',
  notes: '',
  items: [emptyLine()],
});

const sectionLabelSx = { fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: slate[600] };

export default function PurchaseBillEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const poIdFromQuery = searchParams.get('poId');

  const [form, setForm] = useState(initForm);
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            cgst_percent: String(b.cgst_percent ?? 0),
            sgst_percent: String(b.sgst_percent ?? 0),
            igst_percent: String(b.igst_percent ?? 0),
            amount_paid: String(b.amount_paid ?? 0),
            items: (b.items || []).map(mapLineFromApi),
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isNew]);

  useEffect(() => {
    if (!loading && isNew && poIdFromQuery) {
      applyPoPrefill(poIdFromQuery);
    }
  }, [loading, isNew, poIdFromQuery]);

  const applyPoPrefill = async (poId) => {
    const res = await purchaseBillAPI.prefillFromPo(poId);
    const d = res.data;
    const poObj = pos.find((p) => p.id === Number(poId)) || { id: Number(poId), po_number: d.po_number };
    setForm((f) => ({
      ...f,
      purchase_order: d.purchase_order,
      po_number: d.po_number,
      supplier: d.supplier,
      supplier_name: d.supplier_name,
      payment_terms: d.payment_terms,
      tax_mode: d.tax_mode,
      cgst_percent: d.cgst_percent,
      sgst_percent: d.sgst_percent,
      igst_percent: d.igst_percent,
      received_date: d.received_date || f.received_date,
      items: (d.items || []).map(mapLineFromApi),
    }));
    if (!poObj.po_number && d.po_number) {
      setPos((prev) => [...prev, { id: d.purchase_order, po_number: d.po_number, vendor_name: d.supplier_name }]);
    }
  };

  const selectedPo = useMemo(
    () => pos.find((p) => p.id === form.purchase_order) || null,
    [pos, form.purchase_order],
  );

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
      return { subtotal: sub, cgst: 0, sgst: 0, igst, total: sub + igst };
    }
    const cgstPct = parseFloat(form.cgst_percent) || 0;
    const sgstPct = parseFloat(form.sgst_percent) || 0;
    const cgst = Math.round(sub * cgstPct) / 100;
    const sgst = Math.round(sub * sgstPct) / 100;
    return { subtotal: sub, cgst, sgst, igst: 0, total: sub + cgst + sgst };
  }, [form.items, form.tax_mode, form.cgst_percent, form.sgst_percent, form.igst_percent]);

  const balanceDue = Math.max(0, totals.total - (parseFloat(form.amount_paid) || 0));

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

  const handlePoSelect = async (_, po) => {
    if (!po) {
      setForm((f) => ({ ...f, purchase_order: null, po_number: '' }));
      return;
    }
    setForm((f) => ({ ...f, purchase_order: po.id, po_number: po.po_number }));
    await applyPoPrefill(po.id);
  };

  const handleSave = async () => {
    if (!form.bill_number.trim()) { alert('Supplier bill / invoice number is required.'); return; }
    if (!form.supplier_name.trim()) { alert('Supplier name is required.'); return; }
    const items = form.items.filter((r) => r.particulars?.trim() || r.trim);
    if (!items.length) { alert('Add at least one line item.'); return; }

    for (const row of items) {
      const billed = parseFloat(row.quantity_billed) || 0;
      const ordered = parseFloat(row.quantity_ordered) || 0;
      const prev = parseFloat(row.quantity_received_previous) || 0;
      if (row.po_item && ordered > 0 && billed > ordered - prev) {
        alert(`Qty received (${billed}) exceeds pending (${Math.max(0, ordered - prev)}) for "${row.particulars || 'line item'}".`);
        return;
      }
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
        received_date: form.received_date || null,
        due_date: form.due_date || null,
        payment_terms: form.payment_terms,
        tax_mode: form.tax_mode,
        cgst_percent: parseFloat(form.cgst_percent) || 0,
        sgst_percent: parseFloat(form.sgst_percent) || 0,
        igst_percent: parseFloat(form.igst_percent) || 0,
        amount_paid: parseFloat(form.amount_paid) || 0,
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
      if (isNew) await purchaseBillAPI.create(payload);
      else await purchaseBillAPI.update(id, payload);
      navigate('/purchase-bills');
    } catch (e) {
      alert('Save failed: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
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
        <Typography sx={{ ...sectionLabelSx, mb: 1.5, fontSize: '0.75rem' }}>Bill Details</Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Internal Ref" value={form.internal_ref} InputProps={{ readOnly: true }} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Supplier Bill No. *" value={form.bill_number}
              onChange={(e) => setForm((f) => ({ ...f, bill_number: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" type="date" label="Bill Date" InputLabelProps={{ shrink: true }}
              value={form.bill_date} onChange={(e) => setForm((f) => ({ ...f, bill_date: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" type="date" label="Material Received" InputLabelProps={{ shrink: true }}
              value={form.received_date || ''} onChange={(e) => setForm((f) => ({ ...f, received_date: e.target.value }))} sx={sxInput} />
          </Grid>
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
            <TextField fullWidth size="small" label="Payment Terms" value={form.payment_terms}
              onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" type="date" label="Payment Due" InputLabelProps={{ shrink: true }}
              value={form.due_date || ''} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Amount Paid (₹)" value={form.amount_paid}
              onChange={(e) => setForm((f) => ({ ...f, amount_paid: e.target.value }))} sx={sxInput} />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(1), mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ ...sectionLabelSx, fontSize: '0.75rem' }}>Material Received — Line Items</Typography>
          {!form.purchase_order && (
            <Button size="small" startIcon={<Add />} onClick={addLine} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Add Line
            </Button>
          )}
        </Box>
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
              {form.items.map((row, idx) => {
                const amt = (parseFloat(row.quantity_billed) || 0) * (parseFloat(row.unit_price) || 0);
                const ordered = parseFloat(row.quantity_ordered);
                const prev = parseFloat(row.quantity_received_previous) || 0;
                const pending = row.po_item
                  ? Math.max(0, (Number.isNaN(ordered) ? 0 : ordered) - prev)
                  : null;
                const fromPo = Boolean(row.po_item);

                return (
                  <TableRow key={idx} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ ...bodyCellSx, color: slate[500], fontWeight: 700, fontSize: '0.8rem' }}>
                      {row.serial_no || idx + 1}
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, width: 220, maxWidth: 220 }}>
                      {fromPo || row.trim || row.particulars?.trim() ? (
                        <BillLineParticulars row={row} />
                      ) : (
                        <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', fontStyle: 'italic' }}>
                          Link a supplier PO to load items
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
                                <Box component="span" sx={{ fontWeight: 700, color: pending > 0 ? '#b45309' : slate[700] }}>
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
                      {!form.purchase_order && (
                        <IconButton size="small" color="error" onClick={() => removeLine(idx)} disabled={form.items.length <= 1}>
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
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
                ['Bill Total', totals.total],
                ['Amount Paid', parseFloat(form.amount_paid) || 0],
                ['Balance Due', balanceDue],
              ].map(([label, val]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: label.includes('Balance') || label.includes('Total') ? 700 : 500 }}>{label}</Typography>
                  <Typography className="font-numeric" sx={{ fontWeight: 700, color: label === 'Balance Due' ? 'error.dark' : slate[800] }}>
                    ₹ {Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
