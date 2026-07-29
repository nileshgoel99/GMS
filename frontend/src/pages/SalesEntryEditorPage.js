import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, Grid, Paper,
  IconButton, Autocomplete, CircularProgress, Table, TableHead,
  TableBody, TableRow, TableCell, Divider,
} from '@mui/material';
import { ArrowBack, Save, Add, Delete, PointOfSale } from '@mui/icons-material';
import { ordersAPI, salesEntryAPI } from '../services/api';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import { useUnsavedDraft, useMarkSavedWhenReady } from '../hooks/useUnsavedChanges';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const todayIso = () => new Date().toISOString().slice(0, 10);

const emptyLine = (serial = 1) => ({
  serial_no: serial,
  buyer_po_line: null,
  item_code: '',
  item_name: '',
  quantity: '',
  unit: 'PCS',
  unit_price: '',
});

const initForm = () => ({
  internal_ref: '',
  invoice_number: '',
  customer: null,
  customer_name: '',
  buyer_po: null,
  po_number: '',
  pi: null,
  currency: 'USD',
  sale_date: todayIso(),
  due_date: '',
  payment_terms: '',
  amount_received: '0',
  status: 'OPEN',
  notes: '',
  items: [emptyLine()],
});

const sectionLabelSx = { fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: slate[600] };

export default function SalesEntryEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === 'new';
  const poIdFromQuery = searchParams.get('poId');

  const [form, setForm] = useState(initForm);
  const [buyerPos, setBuyerPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { markSaved } = useUnsavedDraft(form);
  useMarkSavedWhenReady(markSaved, { ready: !loading, loadKey: id });

  const applyBuyerPoPrefill = async (poId) => {
    const res = await salesEntryAPI.prefillFromBuyerPo(poId);
    const d = res.data;
    setForm((f) => ({
      ...f,
      buyer_po: d.buyer_po,
      po_number: d.po_number,
      customer: d.customer,
      customer_name: d.customer_name,
      pi: d.pi,
      currency: d.currency || 'USD',
      payment_terms: d.payment_terms,
      sale_date: d.sale_date || f.sale_date,
      items: (d.items || []).map((row, i) => ({
        ...row,
        serial_no: row.serial_no || i + 1,
        quantity: String(row.quantity ?? ''),
        unit_price: String(row.unit_price ?? ''),
      })),
    }));
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [poRes, refRes] = await Promise.all([
          ordersAPI.getBuyerPOs(),
          isNew ? salesEntryAPI.getNextRef() : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setBuyerPos(asList(poRes.data));
        if (isNew && refRes?.data?.internal_ref) {
          setForm((f) => ({ ...f, internal_ref: refRes.data.internal_ref }));
        }
        if (!isNew) {
          const entryRes = await salesEntryAPI.getById(id);
          if (cancelled) return;
          const e = entryRes.data;
          setForm({
            ...e,
            po_number: e.buyer_po_number || '',
            amount_received: String(e.amount_received ?? 0),
            items: (e.items || []).map((row, i) => ({
              ...row,
              serial_no: row.serial_no || i + 1,
              quantity: String(row.quantity ?? ''),
              unit_price: String(row.unit_price ?? ''),
            })),
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isNew]);

  useEffect(() => {
    if (!loading && isNew && poIdFromQuery) {
      applyBuyerPoPrefill(poIdFromQuery);
    }
  }, [loading, isNew, poIdFromQuery]);

  const selectedPo = useMemo(
    () => buyerPos.find((p) => p.id === form.buyer_po) || null,
    [buyerPos, form.buyer_po],
  );

  const total = useMemo(() => form.items.reduce((s, row) => {
    const q = parseFloat(row.quantity) || 0;
    const p = parseFloat(row.unit_price) || 0;
    return s + q * p;
  }, 0), [form.items]);

  const balanceDue = Math.max(0, total - (parseFloat(form.amount_received) || 0));

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
      setForm((f) => ({ ...f, buyer_po: null, po_number: '' }));
      return;
    }
    setForm((f) => ({ ...f, buyer_po: po.id, po_number: po.po_number }));
    await applyBuyerPoPrefill(po.id);
  };

  const handleSave = async () => {
    if (!form.invoice_number.trim()) { alert('Invoice number is required.'); return; }
    if (!form.customer_name.trim()) { alert('Buyer name is required.'); return; }
    const items = form.items.filter((r) => r.item_name?.trim() || r.item_code?.trim());
    if (!items.length) { alert('Add at least one line item.'); return; }

    setSaving(true);
    try {
      const payload = {
        internal_ref: form.internal_ref,
        invoice_number: form.invoice_number.trim(),
        customer: form.customer,
        customer_name: form.customer_name,
        buyer_po: form.buyer_po,
        pi: form.pi,
        currency: form.currency || 'USD',
        sale_date: form.sale_date,
        due_date: form.due_date || null,
        payment_terms: form.payment_terms,
        amount_received: parseFloat(form.amount_received) || 0,
        status: form.status === 'DRAFT' ? 'DRAFT' : 'OPEN',
        notes: form.notes,
        items: items.map((row, i) => ({
          serial_no: row.serial_no || i + 1,
          buyer_po_line: row.buyer_po_line,
          item_code: row.item_code,
          item_name: row.item_name,
          quantity: parseFloat(row.quantity) || 0,
          unit: row.unit || 'PCS',
          unit_price: parseFloat(row.unit_price) || 0,
        })),
      };
      if (isNew) await salesEntryAPI.create(payload);
      else await salesEntryAPI.update(id, payload);
      markSaved(form);
      navigate('/sales');
    } catch (e) {
      alert('Save failed: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setSaving(false);
    }
  };

  const sxInput = { '& .MuiInputBase-root': { borderRadius: 1.5 } };

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
        <IconButton onClick={() => navigate('/sales')} size="small"><ArrowBack /></IconButton>
        <PointOfSale sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', flex: 1 }}>
          {isNew ? 'New Sales Entry' : `Sales: ${form.internal_ref}`}
        </Typography>
        <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          disabled={saving} onClick={handleSave}
          sx={{ fontWeight: 800, textTransform: 'none', px: 3 }}>
          {saving ? 'Saving…' : 'Save Entry'}
        </Button>
      </Box>

      <Paper elevation={0} sx={sectionPaperSxByIndex(0)}>
        <Typography sx={{ ...sectionLabelSx, mb: 1.5, fontSize: '0.75rem' }}>Sales Details</Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Internal Ref" value={form.internal_ref} InputProps={{ readOnly: true }} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Invoice No. *" value={form.invoice_number}
              onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" type="date" label="Sale / Dispatch Date" InputLabelProps={{ shrink: true }}
              value={form.sale_date} onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Currency" value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              size="small"
              options={buyerPos}
              value={selectedPo}
              onChange={handlePoSelect}
              getOptionLabel={(o) => `${o.po_number} — ${o.buyer_name || ''}`}
              renderInput={(params) => <TextField {...params} label="Link Buyer PO" sx={sxInput} />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth size="small" label="Buyer *" value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth size="small" label="Payment Terms" value={form.payment_terms}
              onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" type="date" label="Collection Due" InputLabelProps={{ shrink: true }}
              value={form.due_date || ''} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Amount Received" value={form.amount_received}
              onChange={(e) => setForm((f) => ({ ...f, amount_received: e.target.value }))} sx={sxInput} />
          </Grid>
        </Grid>
      </Paper>

      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(1), mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ ...sectionLabelSx, fontSize: '0.75rem' }}>Goods Sold / Dispatched</Typography>
          <Button size="small" startIcon={<Add />} onClick={addLine} sx={{ textTransform: 'none', fontWeight: 700 }}>Add Line</Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: slate[50] }}>
                {['#', 'Item', 'Code', 'Qty', 'Unit', 'Rate', 'Amount', ''].map((h) => (
                  <TableCell key={h || 'x'} sx={{ fontWeight: 700, fontSize: '0.72rem' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {form.items.map((row, idx) => {
                const amt = (parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0);
                return (
                  <TableRow key={idx}>
                    <TableCell>{row.serial_no || idx + 1}</TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <TextField size="small" fullWidth value={row.item_name}
                        onChange={(e) => updateLine(idx, 'item_name', e.target.value)} sx={sxInput} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" value={row.item_code} onChange={(e) => updateLine(idx, 'item_code', e.target.value)} sx={{ width: 100, ...sxInput }} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" value={row.quantity}
                        onChange={(e) => updateLine(idx, 'quantity', e.target.value)} sx={{ width: 90, ...sxInput }} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" value={row.unit} onChange={(e) => updateLine(idx, 'unit', e.target.value)} sx={{ width: 70, ...sxInput }} />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" type="number" value={row.unit_price}
                        onChange={(e) => updateLine(idx, 'unit_price', e.target.value)} sx={{ width: 100, ...sxInput }} />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} className="font-numeric">
                      {form.currency} {amt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => removeLine(idx)} disabled={form.items.length <= 1}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(2), mt: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" multiline minRows={2} label="Notes" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: slate[50], border: `1px solid ${slate[200]}` }}>
              {[
                ['Total', total],
                ['Amount Received', parseFloat(form.amount_received) || 0],
                ['Balance Due', balanceDue],
              ].map(([label, val]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', fontWeight: label === 'Balance Due' ? 700 : 500 }}>{label}</Typography>
                  <Typography className="font-numeric" sx={{ fontWeight: 700, color: label === 'Balance Due' ? 'error.dark' : slate[800] }}>
                    {form.currency} {Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        </Grid>
        <Divider sx={{ mt: 2, display: 'none' }} />
      </Paper>
    </Box>
  );
}
