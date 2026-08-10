import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Autocomplete, Box, Button, Chip, CircularProgress, Grid,
  IconButton, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Add, ArrowBack, ContentCut, Delete, History, Save } from '@mui/icons-material';
import { format } from 'date-fns';
import { sectionPaperSx, sectionPaperSxByIndex, slate } from '../theme/appTheme';
import { ordersAPI, productionAPI } from '../services/api';
import { useUnsavedDraft, useMarkSavedWhenReady } from '../hooks/useUnsavedChanges';
import RollHistoryModal from '../components/production/RollHistoryModal';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const emptyRoll = () => ({ roll_no: '', total_meters: '', used_meters: '', rejected_meters: '', from_registry: false });

const parseDec = (v) => {
  const n = parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

const rollBalance = (roll) => (
  parseDec(roll.total_meters) - parseDec(roll.used_meters) - parseDec(roll.rejected_meters)
);

const totalUsedFromRolls = (rolls) => (
  (rolls || []).reduce((sum, r) => sum + parseDec(r.used_meters), 0)
);

const normalizeRollFromApi = (entry) => {
  if (typeof entry === 'string') {
    return { roll_no: entry, total_meters: '', used_meters: '', rejected_meters: '', from_registry: false };
  }
  return {
    roll_no: entry?.roll_no || entry?.roll_number || '',
    total_meters: entry?.total_meters != null ? String(entry.total_meters) : '',
    used_meters: entry?.used_meters != null ? String(entry.used_meters) : '',
    rejected_meters: entry?.rejected_meters != null ? String(entry.rejected_meters) : '',
    from_registry: false,
  };
};

const emptyForm = () => ({
  cutting_number: '',
  cutting_date: format(new Date(), 'yyyy-MM-dd'),
  buyer_po: null,
  pi: null,
  pi_line: null,
  buyer_po_line: null,
  item_code: '',
  item_name: '',
  fabric: '',
  color: '',
  roll_width: '',
  roll_numbers: [emptyRoll()],
  size_qty: {},
  consumption_per_pc: '',
  consumption_unit: 'MTRS',
  notes: '',
  status: 'RECORDED',
});

const fmtNum = (n, digits = 4) => {
  const num = Number(n);
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const sectionLabelSx = {
  fontWeight: 800,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: slate[600],
  mb: 1,
  position: 'relative',
  zIndex: 1,
};

/** Textured panel — matches app linen + dot grid (Order & item, Cut by size). */
const texturedSectionSx = (accent = 'brand', overrides = {}) => {
  const accentColor = accent === 'cutting' ? '#0891b2' : undefined;
  const base = sectionPaperSx('alt', overrides);
  if (!accentColor) return base;
  return {
    ...base,
    backgroundImage: `
      radial-gradient(ellipse 85% 65% at 4% 0%, ${alpha(accentColor, 0.07)}, transparent 58%),
      radial-gradient(ellipse 75% 55% at 96% 100%, ${alpha(accentColor, 0.04)}, transparent 52%),
      repeating-linear-gradient(
        -11deg,
        ${alpha(slate[800], 0.018)} 0px,
        ${alpha(slate[800], 0.018)} 1px,
        transparent 1px,
        transparent 6px
      ),
      radial-gradient(circle at 1px 1px, ${alpha(slate[600], 0.055)} 1px, transparent 0)
    `,
    backgroundSize: 'auto, auto, auto, 20px 20px',
  };
};

const panelContentSx = { position: 'relative', zIndex: 1 };

const rollCardPalette = [
  { bg: alpha('#0891b2', 0.08), border: alpha('#0891b2', 0.22) },
  { bg: alpha('#6366f1', 0.08), border: alpha('#6366f1', 0.22) },
  { bg: alpha('#10b981', 0.08), border: alpha('#10b981', 0.2) },
  { bg: alpha('#f59e0b', 0.09), border: alpha('#f59e0b', 0.22) },
];

const rollCardSx = (idx) => {
  const tone = rollCardPalette[idx % rollCardPalette.length];
  return {
    p: 1.25,
    borderRadius: 1.25,
    border: `1px solid ${tone.border}`,
    bgcolor: tone.bg,
    boxShadow: `inset 0 1px 0 ${alpha('#fff', 0.65)}`,
  };
};

const sxInput = { '& .MuiInputBase-root': { fontSize: '0.82rem' } };

const StatPill = ({ label, value, accent }) => (
  <Box sx={{
    px: 1.25,
    py: 0.75,
    borderRadius: 1,
    bgcolor: accent ? alpha(accent, 0.08) : slate[50],
    border: `1px solid ${accent ? alpha(accent, 0.2) : slate[200]}`,
    minWidth: 0,
  }}>
    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: slate[500], lineHeight: 1.1 }}>
      {label}
    </Typography>
    <Typography sx={{
      fontSize: '0.82rem',
      fontWeight: 700,
      color: slate[800],
      lineHeight: 1.25,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {value || '—'}
    </Typography>
  </Box>
);

export default function CuttingEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [buyerPos, setBuyerPos] = useState([]);
  const [context, setContext] = useState(null);
  const [selectedItemKey, setSelectedItemKey] = useState('');
  const [sizeRows, setSizeRows] = useState([]); // sizes user opened for cutting (persist as rows)
  const [focusedSize, setFocusedSize] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadingContext, setLoadingContext] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRolls, setSavedRolls] = useState([]);
  const [historyRollNo, setHistoryRollNo] = useState(null);

  const { markSaved } = useUnsavedDraft(form);
  useMarkSavedWhenReady(markSaved, { ready: !loading, loadKey: id || 'new' });

  const itemOptions = useMemo(() => context?.items || [], [context]);

  const selectedItem = useMemo(() => {
    if (!selectedItemKey) return null;
    return itemOptions.find((it) => {
      const key = it.pi_line_id ? `pi:${it.pi_line_id}` : `bpo:${it.buyer_po_line_id}`;
      return key === selectedItemKey;
    }) || null;
  }, [itemOptions, selectedItemKey]);

  const orderedSizes = useMemo(() => {
    const rows = selectedItem?.size_breakdown || [];
    return rows.map((r) => ({
      size: r.size,
      ordered: Number(r.qty) || 0,
    }));
  }, [selectedItem]);

  const totalPcs = useMemo(() => (
    Object.values(form.size_qty).reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
  ), [form.size_qty]);

  const consumptionPerPc = parseFloat(form.consumption_per_pc) || 0;
  const idealConsumption = consumptionPerPc * totalPcs;
  const actualConsumption = totalUsedFromRolls(form.roll_numbers);
  const consumptionVariance = actualConsumption - idealConsumption;
  const fromIndent = Boolean(selectedItem?.indent_number);
  const sizesWithCut = Object.entries(form.size_qty).filter(([, q]) => (parseInt(q, 10) || 0) > 0).length;

  const orderedBySize = useMemo(() => {
    const map = {};
    orderedSizes.forEach(({ size, ordered }) => { map[size] = ordered; });
    return map;
  }, [orderedSizes]);

  const priorBySize = useMemo(() => selectedItem?.prior_cut_by_size || {}, [selectedItem]);

  const addSizeRow = (size) => {
    setSizeRows((prev) => (prev.includes(size) ? prev : [...prev, size]));
    setFocusedSize(size);
  };

  const removeSizeRow = (size) => {
    setSizeRows((prev) => prev.filter((s) => s !== size));
    setForm((f) => {
      const next = { ...f.size_qty };
      delete next[size];
      return { ...f, size_qty: next };
    });
    if (focusedSize === size) setFocusedSize(null);
  };

  useEffect(() => {
    ordersAPI.getBuyerPOs({ page_size: 500 })
      .then((res) => setBuyerPos(asList(res.data)))
      .catch(console.error);
    productionAPI.getFabricRolls({ limit: 500 })
      .then((res) => setSavedRolls(asList(res.data)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isNew) {
      productionAPI.getNextCuttingNumber()
        .then((res) => setForm((f) => ({ ...f, cutting_number: res.data.cutting_number || '' })))
        .catch(console.error);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await productionAPI.getCutting(id);
        if (cancelled) return;
        const d = res.data;
        const sizeQty = {};
        (d.size_breakdown || []).forEach((row) => {
          if ((Number(row.qty) || 0) > 0) sizeQty[row.size] = String(row.qty);
        });
        const rolls = Array.isArray(d.roll_numbers) && d.roll_numbers.length
          ? d.roll_numbers.map(normalizeRollFromApi)
          : [emptyRoll()];
        setForm({
          cutting_number: d.cutting_number || '',
          cutting_date: d.cutting_date || format(new Date(), 'yyyy-MM-dd'),
          buyer_po: d.buyer_po,
          pi: d.pi,
          pi_line: d.pi_line,
          buyer_po_line: d.buyer_po_line,
          item_code: d.item_code || '',
          item_name: d.item_name || '',
          fabric: d.fabric || '',
          color: d.color || '',
          roll_width: d.roll_width || '',
          roll_numbers: rolls,
          size_qty: sizeQty,
          consumption_per_pc: d.consumption_per_pc != null ? String(d.consumption_per_pc) : '',
          consumption_unit: d.consumption_unit || 'MTRS',
          notes: d.notes || '',
          status: d.status || 'RECORDED',
        });
        setSizeRows(Object.keys(sizeQty));
        setFocusedSize(Object.keys(sizeQty)[0] || null);
        if (d.pi_line) setSelectedItemKey(`pi:${d.pi_line}`);
        else if (d.buyer_po_line) setSelectedItemKey(`bpo:${d.buyer_po_line}`);
        if (d.buyer_po) {
          const ctx = await productionAPI.getCuttingContext(d.buyer_po, { exclude_cutting: id });
          if (!cancelled) setContext(ctx.data);
        }
      } catch (e) {
        console.error(e);
        alert('Failed to load cutting record.');
        navigate('/production/cutting');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, isNew, navigate]);

  const loadContext = useCallback(async (buyerPoId, excludeCuttingId = null) => {
    if (!buyerPoId) {
      setContext(null);
      return;
    }
    setLoadingContext(true);
    try {
      const params = excludeCuttingId ? { exclude_cutting: excludeCuttingId } : {};
      const res = await productionAPI.getCuttingContext(buyerPoId, params);
      setContext(res.data);
    } catch (e) {
      console.error(e);
      setContext(null);
      alert('Failed to load PI details for this Buyer PO.');
    } finally {
      setLoadingContext(false);
    }
  }, []);

  const handleBuyerPoChange = async (_e, value) => {
    const poId = value?.id || null;
    setSelectedItemKey('');
    setSizeRows([]);
    setFocusedSize(null);
    setForm((f) => ({
      ...f,
      buyer_po: poId,
      pi: value?.pi_id || null,
      pi_line: null,
      buyer_po_line: null,
      item_code: '',
      item_name: '',
      fabric: '',
      color: '',
      roll_width: '',
      size_qty: {},
      consumption_per_pc: '',
      consumption_unit: 'MTRS',
    }));
    await loadContext(poId);
  };

  const applyIndentFabric = (value) => ({
    consumption_per_pc: value?.consumption_per_pc != null ? String(value.consumption_per_pc) : '',
    consumption_unit: value?.consumption_unit || 'MTRS',
    roll_width: value?.roll_width || '',
  });

  const handleItemChange = (_e, value) => {
    if (!value) {
      setSelectedItemKey('');
      setSizeRows([]);
      setFocusedSize(null);
      setForm((f) => ({
        ...f,
        pi_line: null,
        buyer_po_line: null,
        item_code: '',
        item_name: '',
        fabric: '',
        color: '',
        roll_width: '',
        size_qty: {},
        consumption_per_pc: '',
        consumption_unit: 'MTRS',
      }));
      return;
    }
    const key = value.pi_line_id ? `pi:${value.pi_line_id}` : `bpo:${value.buyer_po_line_id}`;
    setSelectedItemKey(key);
    setSizeRows([]);
    setFocusedSize(null);
    setForm((f) => ({
      ...f,
      pi: context?.pi?.id || f.pi,
      pi_line: value.pi_line_id || null,
      buyer_po_line: value.buyer_po_line_id || null,
      item_code: value.item_code || '',
      item_name: value.item_name || '',
      fabric: value.fabric || '',
      color: value.color || '',
      size_qty: {},
      ...applyIndentFabric(value),
    }));
  };

  const updateRoll = (idx, field, value) => {
    setForm((f) => {
      const next = f.roll_numbers.map((r, i) => (
        i === idx ? { ...r, [field]: value } : r
      ));
      return { ...f, roll_numbers: next };
    });
  };

  const applySavedRoll = async (idx, rollOptionOrString) => {
    const rollNo = typeof rollOptionOrString === 'string'
      ? rollOptionOrString.trim()
      : (rollOptionOrString?.roll_no || '').trim();
    if (!rollNo) {
      updateRoll(idx, 'roll_no', '');
      return;
    }

    const known = typeof rollOptionOrString === 'object' && rollOptionOrString?.roll_no
      ? rollOptionOrString
      : savedRolls.find((r) => r.roll_no.toLowerCase() === rollNo.toLowerCase());

    if (!known) {
      setForm((f) => {
        const next = f.roll_numbers.map((r, i) => (
          i === idx
            ? { ...r, roll_no: rollNo, from_registry: false }
            : r
        ));
        return { ...f, roll_numbers: next };
      });
      return;
    }

    let suggested = known.current_balance;
    try {
      const params = !isNew && id ? { exclude_cutting: id } : {};
      const res = await productionAPI.getFabricRoll(rollNo, params);
      if (res.data?.suggested_total != null) suggested = res.data.suggested_total;
      else if (res.data?.current_balance != null) suggested = res.data.current_balance;
    } catch (e) {
      // keep list balance
    }

    setForm((f) => {
      const next = f.roll_numbers.map((r, i) => (
        i === idx
          ? {
            ...r,
            roll_no: known.roll_no || rollNo,
            total_meters: suggested != null && suggested !== '' ? String(suggested) : r.total_meters,
            from_registry: true,
          }
          : r
      ));
      return { ...f, roll_numbers: next };
    });
  };

  const addRoll = () => setForm((f) => ({ ...f, roll_numbers: [...f.roll_numbers, emptyRoll()] }));
  const removeRoll = (idx) => setForm((f) => ({
    ...f,
    roll_numbers: f.roll_numbers.length <= 1 ? [emptyRoll()] : f.roll_numbers.filter((_, i) => i !== idx),
  }));

  const setSizeQty = (size, value) => {
    setForm((f) => ({
      ...f,
      size_qty: { ...f.size_qty, [size]: value.replace(/[^\d]/g, '') },
    }));
  };

  const handleSave = async () => {
    if (!form.buyer_po) { alert('Select a Buyer PO.'); return; }
    if (!form.item_name && !selectedItemKey) { alert('Select an item to cut.'); return; }
    const rolls = form.roll_numbers
      .map((r) => ({
        roll_no: r.roll_no.trim(),
        total_meters: r.total_meters.trim() || undefined,
        used_meters: r.used_meters.trim() || undefined,
        rejected_meters: r.rejected_meters.trim() || '0',
      }))
      .filter((r) => r.roll_no);
    if (!rolls.length) { alert('Add at least one roll number.'); return; }
    if (totalUsedFromRolls(form.roll_numbers) <= 0) {
      alert('Enter meters used on at least one roll.');
      return;
    }
    if (totalPcs <= 0) { alert('Select a size and enter cut quantity.'); return; }

    const size_breakdown = Object.entries(form.size_qty)
      .map(([size, qty]) => ({ size, qty: parseInt(qty, 10) || 0 }))
      .filter((r) => r.qty > 0);

    const payload = {
      cutting_number: form.cutting_number.trim(),
      cutting_date: form.cutting_date,
      buyer_po: form.buyer_po,
      pi: form.pi || context?.pi?.id || null,
      pi_line: form.pi_line,
      buyer_po_line: form.buyer_po_line,
      item_code: form.item_code,
      item_name: form.item_name,
      fabric: form.fabric,
      color: form.color,
      roll_width: form.roll_width || '',
      roll_numbers: rolls,
      size_breakdown,
      consumption_per_pc: consumptionPerPc,
      consumption_unit: form.consumption_unit || 'MTRS',
      notes: form.notes,
      status: form.status || 'RECORDED',
    };

    setSaving(true);
    try {
      if (isNew) {
        await productionAPI.createCutting(payload);
      } else {
        await productionAPI.updateCutting(id, payload);
      }
      markSaved(form);
      navigate('/production/cutting');
    } catch (e) {
      const detail = e.response?.data
        ? JSON.stringify(e.response.data)
        : e.message;
      alert('Save failed: ' + detail);
    } finally {
      setSaving(false);
    }
  };

  const selectedBuyerPo = buyerPos.find((p) => p.id === form.buyer_po) || null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 1.5 }, maxWidth: 1400, mx: 'auto' }}>
      {/* Toolbar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mb: 1.5,
        flexWrap: 'wrap',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        py: 0.75,
        bgcolor: 'background.default',
      }}>
        <IconButton onClick={() => navigate('/production/cutting')} size="small"><ArrowBack /></IconButton>
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mr: 'auto' }}>
          {isNew ? 'Record Cutting' : form.cutting_number}
        </Typography>
        {totalPcs > 0 ? (
          <Chip
            size="small"
            label={`${fmtNum(totalPcs, 0)} pcs cut`}
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        ) : null}
        {actualConsumption > 0 ? (
          <Chip
            size="small"
            icon={<ContentCut sx={{ fontSize: '0.9rem !important' }} />}
            label={`Used ${fmtNum(actualConsumption)} ${form.consumption_unit || 'MTRS'}`}
            color="secondary"
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        ) : null}
        {idealConsumption > 0 ? (
          <Chip
            size="small"
            label={`Ideal ${fmtNum(idealConsumption)} ${form.consumption_unit || 'MTRS'}`}
            variant="outlined"
            sx={{ fontWeight: 700 }}
          />
        ) : null}
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          disabled={saving}
          onClick={handleSave}
          sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5, px: 2.5 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>

      {/* Order strip — one compact card */}
      <Paper elevation={0} sx={texturedSectionSx('brand', { p: { xs: 1.5, sm: 2 }, mb: 1.5 })}>
        <Box sx={panelContentSx}>
        <Typography sx={sectionLabelSx}>Order & item</Typography>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="Cutting #"
              fullWidth
              size="small"
              value={form.cutting_number}
              onChange={(e) => setForm((f) => ({ ...f, cutting_number: e.target.value }))}
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <TextField
              label="Date"
              type="date"
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              value={form.cutting_date}
              onChange={(e) => setForm((f) => ({ ...f, cutting_date: e.target.value }))}
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              options={buyerPos}
              value={selectedBuyerPo}
              onChange={handleBuyerPoChange}
              getOptionLabel={(o) => `${o.po_number}${o.buyer_name ? ` — ${o.buyer_name}` : ''}`}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => (
                <TextField {...params} label="Buyer PO *" size="small" sx={sxInput} />
              )}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={itemOptions}
              value={selectedItem}
              onChange={handleItemChange}
              disabled={!form.buyer_po || loadingContext}
              getOptionLabel={(o) => [o.item_name, o.color, o.item_code].filter(Boolean).join(' · ')}
              isOptionEqualToValue={(a, b) => (
                (a.pi_line_id && a.pi_line_id === b.pi_line_id)
                || (a.buyer_po_line_id && a.buyer_po_line_id === b.buyer_po_line_id)
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.pi_line_id || option.buyer_po_line_id}>
                  <Box sx={{ py: 0.25 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {option.item_name}{option.color ? ` · ${option.color}` : ''}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                      {[option.item_code, `${option.ordered_qty || 0} ord.`].filter(Boolean).join(' · ')}
                    </Typography>
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Item *"
                  size="small"
                  sx={sxInput}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingContext ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>
        </Grid>

        {/* PI + fabric stats — single dense row */}
        {(context?.pi || selectedItem || form.fabric) ? (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${slate[100]}` }}>
            <Grid container spacing={1}>
              {context?.pi ? (
                <Grid item xs={12} sm={6} md={3}>
                  <StatPill
                    label="PI"
                    value={`${context.pi.pi_number}${context.pi.client_name ? ` · ${context.pi.client_name}` : ''}`}
                    accent="#0ea5e9"
                  />
                </Grid>
              ) : null}
              <Grid item xs={12} sm={6} md={context?.pi ? 3 : 4}>
                <StatPill label="Fabric" value={form.fabric} />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <StatPill label="Color" value={form.color} accent="#6366f1" />
              </Grid>
              <Grid item xs={6} sm={3} md={1.5}>
                <TextField
                  label="Roll W"
                  fullWidth
                  size="small"
                  value={form.roll_width}
                  onChange={(e) => setForm((f) => ({ ...f, roll_width: e.target.value }))}
                  InputProps={{ readOnly: fromIndent && Boolean(selectedItem?.roll_width) }}
                  sx={sxInput}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={1.5}>
                <TextField
                  label="Cons/pc"
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ step: '0.0001', min: 0 }}
                  value={form.consumption_per_pc}
                  onChange={(e) => setForm((f) => ({ ...f, consumption_per_pc: e.target.value }))}
                  InputProps={{ readOnly: fromIndent && consumptionPerPc > 0 }}
                  sx={sxInput}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={1}>
                <TextField
                  label="Unit"
                  fullWidth
                  size="small"
                  value={form.consumption_unit}
                  onChange={(e) => setForm((f) => ({ ...f, consumption_unit: e.target.value }))}
                  InputProps={{ readOnly: fromIndent }}
                  sx={sxInput}
                />
              </Grid>
            </Grid>
            {fromIndent ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                Roll width & cons/pc from indent {selectedItem.indent_number}
              </Typography>
            ) : null}
          </Box>
        ) : context && !context.pi ? (
          <Typography variant="caption" color="warning.main" sx={{ mt: 1, display: 'block' }}>
            No linked PI — indent rates unavailable.
          </Typography>
        ) : null}
        </Box>
      </Paper>

      {/* Main work area — rolls left, sizes right */}
      <Grid container spacing={1.5}>
        <Grid item xs={12} md={5} lg={4}>
          <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(1), p: { xs: 1.5, sm: 2 }, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography sx={sectionLabelSx}>Roll numbers</Typography>
              <IconButton size="small" onClick={addRoll} aria-label="Add roll"><Add fontSize="small" /></IconButton>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Pick a saved roll (balance becomes Total) or type a new roll no.
            </Typography>
            <Stack spacing={1}>
              {form.roll_numbers.map((roll, idx) => {
                const balance = rollBalance(roll);
                const hasTotal = parseDec(roll.total_meters) > 0;
                const selectedOption = savedRolls.find(
                  (r) => r.roll_no.toLowerCase() === (roll.roll_no || '').toLowerCase()
                ) || null;
                return (
                  <Box key={idx} sx={rollCardSx(idx)}>
                    <Typography sx={{
                      fontSize: '0.65rem',
                      fontWeight: 800,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: slate[500],
                      mb: 0.75,
                    }}>
                      Roll {idx + 1}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', mb: 0.75 }}>
                      <Autocomplete
                        freeSolo
                        fullWidth
                        size="small"
                        options={savedRolls}
                        value={selectedOption}
                        inputValue={roll.roll_no}
                        onInputChange={(_e, value, reason) => {
                          if (reason === 'input' || reason === 'clear') {
                            updateRoll(idx, 'roll_no', value || '');
                            if (reason === 'clear') {
                              setForm((f) => {
                                const next = f.roll_numbers.map((r, i) => (
                                  i === idx ? { ...emptyRoll() } : r
                                ));
                                return { ...f, roll_numbers: next };
                              });
                            }
                          }
                        }}
                        onChange={(_e, value) => {
                          if (value == null) {
                            setForm((f) => {
                              const next = f.roll_numbers.map((r, i) => (
                                i === idx ? { ...emptyRoll() } : r
                              ));
                              return { ...f, roll_numbers: next };
                            });
                            return;
                          }
                          applySavedRoll(idx, value);
                        }}
                        getOptionLabel={(o) => (typeof o === 'string' ? o : o.roll_no)}
                        isOptionEqualToValue={(a, b) => a.roll_no === b.roll_no}
                        filterOptions={(opts, state) => {
                          const q = state.inputValue.trim().toLowerCase();
                          if (!q) return opts.slice(0, 50);
                          return opts.filter((o) => (
                            o.roll_no.toLowerCase().includes(q)
                            || (o.fabric || '').toLowerCase().includes(q)
                            || (o.color || '').toLowerCase().includes(q)
                          )).slice(0, 50);
                        }}
                        renderOption={(props, option) => (
                          <li {...props} key={option.id || option.roll_no}>
                            <Box sx={{ py: 0.25 }}>
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
                                {option.roll_no}
                              </Typography>
                              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                Bal {fmtNum(option.current_balance)} {option.unit || 'MTRS'}
                                {option.color ? ` · ${option.color}` : ''}
                              </Typography>
                            </Box>
                          </li>
                        )}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Roll no."
                            placeholder="Select or type new"
                            sx={{
                              ...sxInput,
                              '& .MuiInputBase-root': {
                                fontSize: '0.82rem',
                                bgcolor: alpha('#fff', 0.72),
                              },
                            }}
                          />
                        )}
                      />
                      <Tooltip title={roll.roll_no ? 'Where this roll was used' : 'Enter a roll no. first'}>
                        <span>
                          <IconButton
                            size="small"
                            disabled={!roll.roll_no.trim()}
                            onClick={() => setHistoryRollNo(roll.roll_no.trim())}
                            sx={{ flexShrink: 0, mt: 0.5 }}
                          >
                            <History fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <IconButton
                        size="small"
                        onClick={() => removeRoll(idx)}
                        disabled={form.roll_numbers.length <= 1}
                        sx={{ flexShrink: 0, mt: 0.5 }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                    <Grid container spacing={0.75}>
                      <Grid item xs={4}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Total m"
                          type="number"
                          inputProps={{ step: '0.01', min: 0 }}
                          value={roll.total_meters}
                          onChange={(e) => updateRoll(idx, 'total_meters', e.target.value)}
                          helperText={roll.from_registry ? 'From prior balance' : undefined}
                          FormHelperTextProps={{ sx: { mx: 0, mt: 0.25, fontSize: '0.62rem' } }}
                          sx={{
                            ...sxInput,
                            '& .MuiInputBase-root': { fontSize: '0.82rem', bgcolor: alpha('#fff', 0.72) },
                          }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Used m"
                          type="number"
                          inputProps={{ step: '0.01', min: 0 }}
                          value={roll.used_meters}
                          onChange={(e) => updateRoll(idx, 'used_meters', e.target.value)}
                          sx={{
                            ...sxInput,
                            '& .MuiInputBase-root': { fontSize: '0.82rem', bgcolor: alpha('#fff', 0.72) },
                          }}
                        />
                      </Grid>
                      <Grid item xs={4}>
                        <TextField
                          size="small"
                          fullWidth
                          label="Rejected m"
                          type="number"
                          inputProps={{ step: '0.01', min: 0 }}
                          value={roll.rejected_meters}
                          onChange={(e) => updateRoll(idx, 'rejected_meters', e.target.value)}
                          sx={{
                            ...sxInput,
                            '& .MuiInputBase-root': { fontSize: '0.82rem', bgcolor: alpha('#fff', 0.72) },
                          }}
                        />
                      </Grid>
                    </Grid>
                    {hasTotal ? (
                      <Typography variant="caption" sx={{
                        mt: 0.75,
                        display: 'block',
                        fontWeight: 700,
                        color: balance < 0 ? 'error.main' : slate[600],
                      }}>
                        Balance: {fmtNum(balance)} {form.consumption_unit || 'MTRS'}
                        {' '}(next Total)
                      </Typography>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>

            <Box sx={{
              mt: 2,
              p: 1.25,
              borderRadius: 1,
              bgcolor: alpha('#0891b2', 0.06),
              border: `1px solid ${alpha('#0891b2', 0.15)}`,
            }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: slate[500], mb: 0.5 }}>
                CONSUMPTION
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Actual (rolls)</Typography>
                <Typography sx={{ fontWeight: 800, color: '#0891b2' }}>
                  {fmtNum(actualConsumption)} {form.consumption_unit || 'MTRS'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Ideal (cons × pcs)</Typography>
                <Typography sx={{ fontWeight: 700 }}>
                  {fmtNum(idealConsumption)} {form.consumption_unit || 'MTRS'}
                </Typography>
              </Box>
              {actualConsumption > 0 && idealConsumption > 0 ? (
                <Typography variant="caption" color="text.secondary">
                  Variance: {consumptionVariance >= 0 ? '+' : ''}{fmtNum(consumptionVariance)} {form.consumption_unit || 'MTRS'}
                  {' · '}{fmtNum(consumptionPerPc)} × {totalPcs} pcs
                </Typography>
              ) : (
                <Typography variant="caption" color="text.secondary">
                  {fmtNum(consumptionPerPc)} cons/pc × {totalPcs} pcs cut
                </Typography>
              )}
            </Box>

            <TextField
              label="Notes"
              fullWidth
              size="small"
              multiline
              minRows={2}
              sx={{ ...sxInput, mt: 1.5 }}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </Paper>
        </Grid>

        <Grid item xs={12} md={7} lg={8}>
          <Paper elevation={0} sx={texturedSectionSx('cutting', { p: { xs: 1.5, sm: 2 }, minHeight: 280 })}>
            <Box sx={panelContentSx}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={sectionLabelSx}>Cut by size</Typography>
              {selectedItem ? (
                <Typography variant="caption" color="text.secondary">
                  {sizesWithCut || 0} size(s) · {totalPcs} pcs total
                </Typography>
              ) : null}
            </Box>

            {!selectedItem ? (
              <Box sx={{
                py: 6,
                textAlign: 'center',
                color: 'text.secondary',
                border: `1px dashed ${slate[200]}`,
                borderRadius: 1.5,
              }}>
                <ContentCut sx={{ fontSize: 32, opacity: 0.35, mb: 1 }} />
                <Typography variant="body2">Select Buyer PO and item to enter cut quantities</Typography>
              </Box>
            ) : orderedSizes.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No size breakdown on this item.</Typography>
            ) : (
              <>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: sizeRows.length ? 1.5 : 0 }}>
                  {orderedSizes.map(({ size }) => {
                    const inRows = sizeRows.includes(size);
                    const focused = focusedSize === size;
                    const priorQty = priorBySize[size]?.qty || 0;
                    return (
                      <Button
                        key={size}
                        size="small"
                        variant={focused ? 'contained' : inRows ? 'outlined' : 'outlined'}
                        color={inRows ? 'primary' : 'inherit'}
                        onClick={() => addSizeRow(size)}
                        sx={{
                          minWidth: 44,
                          px: 1.25,
                          py: 0.5,
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          flexDirection: 'column',
                          borderColor: inRows || focused ? undefined : slate[300],
                          color: focused ? undefined : inRows ? 'primary.main' : slate[700],
                        }}
                      >
                        {size}
                        {priorQty > 0 ? (
                          <Typography component="span" sx={{
                            display: 'block',
                            fontSize: '0.58rem',
                            fontWeight: 600,
                            lineHeight: 1.2,
                            mt: 0.25,
                            opacity: 0.9,
                          }}>
                            {priorQty} cut
                          </Typography>
                        ) : null}
                      </Button>
                    );
                  })}
                </Box>

                {sizeRows.length > 0 ? (
                  <Table size="small" sx={{
                    tableLayout: 'fixed',
                    width: '100%',
                    '& .MuiTableCell-root': {
                      py: 1,
                      px: 1,
                      fontSize: '0.82rem',
                      borderColor: slate[100],
                      verticalAlign: 'middle',
                    },
                    '& .MuiTableCell-head': {
                      fontWeight: 800,
                      color: slate[600],
                      bgcolor: slate[50],
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      py: 1,
                    },
                  }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 72 }}>Size</TableCell>
                        <TableCell align="right" sx={{ width: 88 }}>Ordered</TableCell>
                        <TableCell sx={{ width: '38%' }}>Already cut</TableCell>
                        <TableCell align="right" sx={{ width: 120 }}>Cut pcs</TableCell>
                        <TableCell sx={{ width: 44 }} />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sizeRows.map((size) => {
                        const ordered = orderedBySize[size] ?? 0;
                        const prior = priorBySize[size];
                        const priorQty = prior?.qty || 0;
                        const priorRolls = (prior?.rolls || []).join(', ');
                        const priorCuttingNos = Array.from(new Set(
                          (prior?.entries || []).map((e) => e.cutting_number).filter(Boolean)
                        )).join(', ');
                        return (
                          <TableRow
                            key={size}
                            sx={{
                              bgcolor: focusedSize === size ? alpha('#0891b2', 0.04) : undefined,
                              '&:last-child td': { borderBottom: 0 },
                            }}
                            onClick={() => setFocusedSize(size)}
                          >
                            <TableCell>
                              <Chip size="small" label={size} color="primary" variant="outlined" sx={{ fontWeight: 800 }} />
                            </TableCell>
                            <TableCell align="right">{ordered}</TableCell>
                            <TableCell>
                              {priorQty > 0 ? (
                                <Box>
                                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'warning.dark', lineHeight: 1.25 }}>
                                    {priorQty} pcs
                                  </Typography>
                                  {priorRolls ? (
                                    <Typography sx={{ fontSize: '0.72rem', color: slate[600], lineHeight: 1.3, mt: 0.2 }}>
                                      Rolls: {priorRolls}
                                    </Typography>
                                  ) : null}
                                  {priorCuttingNos ? (
                                    <Typography sx={{ fontSize: '0.7rem', color: slate[500], lineHeight: 1.3, mt: 0.15, fontFamily: 'monospace' }}>
                                      Ref: {priorCuttingNos}
                                    </Typography>
                                  ) : null}
                                </Box>
                              ) : (
                                <Typography sx={{ color: 'text.secondary' }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">
                              <TextField
                                size="small"
                                value={form.size_qty[size] ?? ''}
                                onChange={(e) => setSizeQty(size, e.target.value)}
                                onFocus={() => setFocusedSize(size)}
                                inputProps={{ inputMode: 'numeric', style: { textAlign: 'right' } }}
                                placeholder="0"
                                sx={{ ...sxInput, width: 96 }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); removeSizeRow(size); }}
                                aria-label={`Remove size ${size}`}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow sx={{ bgcolor: slate[50] }}>
                        <TableCell sx={{ fontWeight: 800 }}>Total</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {sizeRows.reduce((s, sz) => s + (orderedBySize[sz] ?? 0), 0)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, color: 'warning.dark' }}>
                          {(() => {
                            const n = sizeRows.reduce((s, sz) => s + (Number(priorBySize[sz]?.qty) || 0), 0);
                            return n > 0 ? `${n} pcs` : '—';
                          })()}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>{totalPcs}</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Click a size above to add a cut row.
                  </Typography>
                )}
              </>
            )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <RollHistoryModal
        open={Boolean(historyRollNo)}
        rollNo={historyRollNo}
        onClose={() => setHistoryRollNo(null)}
      />
    </Box>
  );
}
