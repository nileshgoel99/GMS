import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, MenuItem, Grid, Paper,
  IconButton, Chip, Autocomplete, CircularProgress, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack, Save, Print, Add, Delete, CheckCircle,
  AutoAwesome, ContentCopy,
} from '@mui/icons-material';
import { ordersAPI } from '../services/api';
import { slate } from '../theme/appTheme';

// ── Print styles ─────────────────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body > * { visibility: hidden !important; }
  #indent-print-root, #indent-print-root * { visibility: visible !important; }
  #indent-print-root { position: fixed; top: 0; left: 0; width: 100%; }
  @page { margin: 12mm; size: A4; }
}
`;

// ── Unit helpers ──────────────────────────────────────────────────────────────
const UNITS = ['MTRS', 'PCS', 'CONES', 'KG', 'SET', 'PAIR', 'ROLL', 'GMS'];

// ── Empty row factories ───────────────────────────────────────────────────────
const emptyFabric = () => ({ material: '', color: '', consumption_per_pc: '', unit: 'MTRS', total_consumption: '', remarks: '' });
const emptyTrim   = () => ({ trim: null, trim_name: '', category: '', color_variant: '', size_variant: '', consumption_per_pc: '', unit: 'PCS', total_consumption: '', total_unit: '', remarks: '' });

// ── Helper: compute total from consumption × qty ──────────────────────────────
const calcTotal = (consumption, qty) => {
  const c = parseFloat(consumption);
  const q = parseFloat(qty);
  if (isNaN(c) || isNaN(q) || q === 0) return '';
  return (c * q).toFixed(4).replace(/\.?0+$/, '');
};

// ── Color→qty map from PI lines ───────────────────────────────────────────────
const buildColorQty = (piLines) => {
  const map = {};
  (piLines || []).forEach((l) => {
    if (l.color) map[l.color] = (map[l.color] || 0) + (l.quantity_pcs || 0);
  });
  return map;
};

// ── Table cell sx ─────────────────────────────────────────────────────────────
const cellSx = { border: '1px solid #000', p: '4px 6px', fontSize: '8.5pt', fontFamily: 'inherit', verticalAlign: 'middle' };
const thSx   = { ...cellSx, fontWeight: 700, bgcolor: '#e8e8e8', textAlign: 'center' };

// ── Printed Indent Document ───────────────────────────────────────────────────
function IndentDocument({ pi, indent, fabricLines, trimLines, company }) {
  const piLines = pi?.lines || [];
  const colorQty = buildColorQty(piLines);
  const colors = Object.keys(colorQty);
  const totalQty = Object.values(colorQty).reduce((s, v) => s + v, 0);

  const itemName = [...new Set(piLines.map((l) => l.item_name))].join(' / ');
  const sizeBreakdown = piLines.reduce((acc, line) => {
    if (line.size_breakdown?.length) {
      line.size_breakdown.forEach(({ size, qty }) => {
        if (!acc[size]) acc[size] = {};
        acc[size][line.color || 'Total'] = (acc[size][line.color || 'Total'] || 0) + (qty || 0);
      });
    }
    return acc;
  }, {});
  const sizes = Object.keys(sizeBreakdown);

  const companyName = company?.company_legal_name || 'JB INTERNATIONAL';

  return (
    <Box sx={{ fontFamily: 'Arial, sans-serif', fontSize: '9.5pt', color: '#000', bgcolor: '#fff', p: 0 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 900, fontSize: '13pt', fontFamily: 'inherit', textTransform: 'uppercase' }}>
          {companyName}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: '9.5pt' }}>
            INDENT NO:- {indent?.indent_number || '___'}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: '9.5pt' }}>
            DATE - {indent?.indent_date || '___'}
          </Typography>
        </Box>
      </Box>

      {/* Item header */}
      <Box sx={{ mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontFamily: 'inherit', fontSize: '9.5pt', textTransform: 'uppercase' }}>
          ITEM NO. 1 : {itemName}
        </Typography>
      </Box>

      {/* Color × Qty table */}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: 1.5 }}>
        <Box component="tbody">
          <Box component="tr">
            <Box component="td" sx={thSx}>COLOUR</Box>
            {colors.map((c) => <Box component="td" key={c} sx={{ ...thSx, width: 70 }}>{c}</Box>)}
            <Box component="td" sx={{ ...thSx, width: 70 }}>TOTAL</Box>
          </Box>
          <Box component="tr">
            <Box component="td" sx={{ ...cellSx, fontWeight: 700 }}>QTY</Box>
            {colors.map((c) => <Box component="td" key={c} sx={{ ...cellSx, textAlign: 'center', fontWeight: 600 }}>{colorQty[c]}</Box>)}
            <Box component="td" sx={{ ...cellSx, textAlign: 'center', fontWeight: 700 }}>{totalQty}</Box>
          </Box>
        </Box>
      </Box>

      {/* BOM Table */}
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: 1.5 }}>
        <Box component="thead">
          <Box component="tr">
            {['MATERIAL', 'COLOR / VARIANT', 'CONSUM.', 'UNIT', 'TOT CON.', 'UNIT', 'REMARKS'].map((h) => (
              <Box component="th" key={h} sx={thSx}>{h}</Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {fabricLines.filter((r) => r.material).map((row, i) => (
            <Box component="tr" key={`f${i}`}>
              <Box component="td" sx={{ ...cellSx, fontWeight: 600 }}>{row.material}</Box>
              <Box component="td" sx={cellSx}>{row.color}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'right' }}>{row.consumption_per_pc}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'center' }}>{row.unit}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'right', fontWeight: 700 }}>{row.total_consumption}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'center' }}>{row.unit}</Box>
              <Box component="td" sx={cellSx}>{row.remarks}</Box>
            </Box>
          ))}
          {trimLines.filter((r) => r.trim_name).map((row, i) => (
            <Box component="tr" key={`t${i}`}>
              <Box component="td" sx={cellSx}>{row.trim_name}</Box>
              <Box component="td" sx={cellSx}>{[row.color_variant, row.size_variant].filter(Boolean).join(' / ')}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'right' }}>{row.consumption_per_pc}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'center' }}>{row.unit}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'right', fontWeight: 700 }}>{row.total_consumption}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'center' }}>{row.total_unit || row.unit}</Box>
              <Box component="td" sx={cellSx}>{row.remarks}</Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Size breakdown */}
      {sizes.length > 0 && (
        <>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mb: 1.5 }}>
            <Box component="thead">
              <Box component="tr">
                <Box component="th" sx={thSx}>ITEM / SIZE DETAILS</Box>
                {sizes.map((s) => <Box component="th" key={s} sx={{ ...thSx, width: 48 }}>{s}</Box>)}
                <Box component="th" sx={{ ...thSx, width: 60 }}>TOTAL</Box>
              </Box>
            </Box>
            <Box component="tbody">
              {piLines.map((line, li) => {
                if (!line.size_breakdown?.length) return null;
                const sizeMap = {};
                line.size_breakdown.forEach(({ size, qty }) => { sizeMap[size] = qty; });
                const lineTotal = line.quantity_pcs;
                return (
                  <Box component="tr" key={li}>
                    <Box component="td" sx={{ ...cellSx, fontWeight: 600 }}>{line.color}</Box>
                    {sizes.map((s) => <Box component="td" key={s} sx={{ ...cellSx, textAlign: 'center' }}>{sizeMap[s] || ''}</Box>)}
                    <Box component="td" sx={{ ...cellSx, textAlign: 'center', fontWeight: 700 }}>{lineTotal}</Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        </>
      )}

      {/* Carton info */}
      {(indent?.pcs_per_carton || indent?.carton_ply || indent?.carton_dimensions) && (
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontFamily: 'inherit', fontSize: '8.5pt', fontWeight: 600 }}>
            Carton Size:&nbsp;&nbsp;
            {indent.pcs_per_carton ? `${indent.pcs_per_carton} pcs/box` : ''}
            {indent.carton_ply ? `  ${indent.carton_ply}` : ''}
            {indent.carton_dimensions ? `  ${indent.carton_dimensions} (L*W*H)` : ''}
          </Typography>
        </Box>
      )}

      {/* Sign-off */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3, borderTop: '1px solid #999', pt: 1.5 }}>
        {[
          ['Prepared By :-', indent?.prepared_by],
          ['Received By :-', indent?.received_by],
          ['Approved By :-', indent?.approved_by],
        ].map(([label, val]) => (
          <Box key={label} sx={{ textAlign: 'center', minWidth: 140 }}>
            <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '8.5pt' }}>{label}</Typography>
            {val && <Typography sx={{ fontFamily: 'inherit', fontSize: '8.5pt', mt: 0.5 }}>{val}</Typography>}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Main Editor Page ──────────────────────────────────────────────────────────
export default function IndentEditorPage() {
  const navigate    = useNavigate();
  const { id }      = useParams();
  const [searchParams] = useSearchParams();
  const isNew       = id === 'new';
  const piIdFromUrl = searchParams.get('piId');

  const [loading,  setLoading]  = useState(!isNew);
  const [saving,   setSaving]   = useState(false);
  const [pi,       setPi]       = useState(null);
  const [company,  setCompany]  = useState(null);
  const [piList,   setPiList]   = useState([]);
  const [trimsList, setTrimsList] = useState([]);
  const [showPrint, setShowPrint] = useState(false);

  // Form state
  const [indent,       setIndent]      = useState(null);
  const [indentNumber, setIndentNumber] = useState('');
  const [indentDate,   setIndentDate]  = useState(new Date().toISOString().split('T')[0]);
  const [status,       setStatus]      = useState('DRAFT');
  const [pcsPerCarton, setPcsPerCarton] = useState('');
  const [cartonPly,    setCartonPly]   = useState('');
  const [cartonDims,   setCartonDims]  = useState('');
  const [preparedBy,   setPreparedBy]  = useState('');
  const [receivedBy,   setReceivedBy]  = useState('');
  const [approvedBy,   setApprovedBy]  = useState('');
  const [notes,        setNotes]       = useState('');
  const [fabricLines,  setFabricLines] = useState([emptyFabric()]);
  const [trimLines,    setTrimLines]   = useState([emptyTrim()]);
  const [autoFilled,   setAutoFilled]  = useState(false);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [trimRes] = await Promise.all([ordersAPI.getTrimsMaster()]);
        setTrimsList(Array.isArray(trimRes.data) ? trimRes.data : trimRes.data?.results || []);

        if (isNew) {
          // Load PI list for selector
          const piRes = await ordersAPI.getPIs({ page_size: 200 });
          const piArr = Array.isArray(piRes.data) ? piRes.data : piRes.data?.results || [];
          setPiList(piArr);

          // Auto-select PI from URL param
          if (piIdFromUrl) {
            const full = await ordersAPI.getPI(piIdFromUrl);
            setPi(full.data);
            // Try to auto-fill from template
            await tryAutoFill(full.data);
          }
          // Generate indent number
          const numRes = await ordersAPI.getNextIndentNumber();
          setIndentNumber(numRes.data.indent_number);
        } else {
          // Load existing indent
          const res = await ordersAPI.getIndent(id);
          const data = res.data;
          setIndent(data);
          setIndentNumber(data.indent_number);
          setIndentDate(data.indent_date);
          setStatus(data.status);
          setPcsPerCarton(data.pcs_per_carton || '');
          setCartonPly(data.carton_ply || '');
          setCartonDims(data.carton_dimensions || '');
          setPreparedBy(data.prepared_by || '');
          setReceivedBy(data.received_by || '');
          setApprovedBy(data.approved_by || '');
          setNotes(data.notes || '');
          setFabricLines(data.fabric_lines?.length ? data.fabric_lines : [emptyFabric()]);
          setTrimLines(data.trim_lines?.length ? data.trim_lines : [emptyTrim()]);

          // Load the linked PI
          const piRes = await ordersAPI.getPI(data.pi);
          setPi(piRes.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew, piIdFromUrl]); // eslint-disable-line

  const tryAutoFill = async (piData) => {
    if (!piData) return;
    const names = [...new Set((piData.lines || []).map((l) => l.item_name))];
    for (const name of names) {
      try {
        const res = await ordersAPI.getIndentTemplate(name);
        if (res.data) {
          const tmpl = res.data;
          if (tmpl.fabric_lines?.length) setFabricLines(tmpl.fabric_lines.map((r) => ({ ...emptyFabric(), ...r })));
          if (tmpl.trim_lines?.length) setTrimLines(tmpl.trim_lines.map((r) => ({ ...emptyTrim(), ...r })));
          setAutoFilled(true);
          break;
        }
      } catch (_) {
        // no template — that's fine
      }
    }
  };

  const handlePiSelect = async (piData) => {
    setPi(piData);
    if (piData) {
      setAutoFilled(false);
      await tryAutoFill(piData);
    }
  };

  // ── Color qty helper ───────────────────────────────────────────────────────
  const colorQty = buildColorQty(pi?.lines);
  const totalQty = Object.values(colorQty).reduce((s, v) => s + v, 0);

  // ── Fabric row helpers ─────────────────────────────────────────────────────
  const setFabricField = (i, field, value) => {
    setFabricLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      // Recompute total when consumption or color changes
      if (field === 'consumption_per_pc' || field === 'color') {
        const row = next[i];
        const qty = colorQty[row.color] || totalQty;
        next[i].total_consumption = calcTotal(
          field === 'consumption_per_pc' ? value : row.consumption_per_pc,
          qty,
        );
      }
      return next;
    });
  };

  const addFabricRow = () => setFabricLines((p) => [...p, emptyFabric()]);
  const removeFabricRow = (i) => setFabricLines((p) => p.filter((_, idx) => idx !== i));

  // ── Trim row helpers ───────────────────────────────────────────────────────
  const setTrimField = (i, field, value) => {
    setTrimLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'consumption_per_pc' || field === 'color_variant') {
        const row = next[i];
        const qty = colorQty[row.color_variant] || totalQty;
        next[i].total_consumption = calcTotal(
          field === 'consumption_per_pc' ? value : row.consumption_per_pc,
          qty,
        );
      }
      return next;
    });
  };

  const addTrimRow = () => setTrimLines((p) => [...p, emptyTrim()]);
  const removeTrimRow = (i) => setTrimLines((p) => p.filter((_, idx) => idx !== i));

  const selectTrimFromLibrary = (i, trim) => {
    setTrimLines((prev) => {
      const next = [...prev];
      next[i] = {
        ...next[i],
        trim: trim?.id || null,
        trim_name: trim?.name || '',
        category: trim?.category || '',
        unit: trim?.default_unit || 'PCS',
        total_unit: trim?.default_unit || 'PCS',
      };
      return next;
    });
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (nextStatus) => {
    if (!pi) { alert('Please select a PI first.'); return; }
    if (!indentNumber.trim()) { alert('Indent number is required.'); return; }

    setSaving(true);
    try {
      const payload = {
        pi: pi.id,
        indent_number: indentNumber,
        indent_date: indentDate,
        status: nextStatus || status,
        pcs_per_carton: pcsPerCarton || 0,
        carton_ply: cartonPly,
        carton_dimensions: cartonDims,
        prepared_by: preparedBy,
        received_by: receivedBy,
        approved_by: approvedBy,
        notes,
        fabric_lines: fabricLines.filter((r) => r.material.trim()),
        trim_lines: trimLines.filter((r) => r.trim_name.trim()),
      };

      let res;
      if (isNew) {
        res = await ordersAPI.createIndent(payload);
        navigate(`/indents/${res.data.id}`, { replace: true });
      } else {
        res = await ordersAPI.updateIndent(id, payload);
        setIndent(res.data);
        setStatus(res.data.status);
      }
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert('Save failed: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const sxInput = { '& .MuiInputBase-root': { fontSize: '0.82rem' } };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  }

  const colorChips = Object.entries(colorQty);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1300, mx: 'auto' }}>
      <style>{PRINT_STYLE}</style>

      {/* ── Toolbar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/indents')} size="small"><ArrowBack /></IconButton>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', flex: 1 }}>
          {isNew ? 'New Indent' : `Indent: ${indentNumber}`}
        </Typography>
        {!isNew && (
          <Button startIcon={<Print />} variant="outlined" size="small"
            onClick={() => { setShowPrint(true); setTimeout(() => window.print(), 200); }}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Print
          </Button>
        )}
        {status !== 'CONFIRMED' && (
          <Button variant="outlined" size="small" color="success"
            startIcon={<CheckCircle />} onClick={() => handleSave('CONFIRMED')} disabled={saving}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Confirm
          </Button>
        )}
        <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          disabled={saving} onClick={() => handleSave()}
          sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5, px: 3 }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        {/* ── Left: header fields ── */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Indent Details
            </Typography>

            {/* PI selector (new only) */}
            {isNew ? (
              <Autocomplete
                options={piList}
                getOptionLabel={(o) => `${o.pi_number} — ${o.client_name || ''}`}
                value={pi}
                onChange={(_, v) => handlePiSelect(v)}
                renderInput={(params) => <TextField {...params} size="small" label="Proforma Invoice *" sx={{ mb: 2, ...sxInput }} />}
              />
            ) : (
              <Box sx={{ mb: 2, p: 1.5, bgcolor: alpha(slate[900], 0.04), borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase' }}>PI</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{pi?.pi_number}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{pi?.client_name}</Typography>
              </Box>
            )}

            <TextField size="small" fullWidth label="Indent Number *" value={indentNumber}
              onChange={(e) => setIndentNumber(e.target.value)} sx={{ mb: 2, ...sxInput }} />
            <TextField size="small" fullWidth label="Date" type="date" value={indentDate}
              onChange={(e) => setIndentDate(e.target.value)} InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, ...sxInput }} />
            <TextField size="small" fullWidth select label="Status" value={status}
              onChange={(e) => setStatus(e.target.value)} sx={{ mb: 2, ...sxInput }}>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="CONFIRMED">Confirmed</MenuItem>
            </TextField>

            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1.5, color: 'text.secondary' }}>Carton Info</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={4}>
                <TextField size="small" fullWidth label="Pcs/Box" type="number" value={pcsPerCarton}
                  onChange={(e) => setPcsPerCarton(e.target.value)} sx={sxInput} />
              </Grid>
              <Grid item xs={4}>
                <TextField size="small" fullWidth label="PLY" value={cartonPly}
                  onChange={(e) => setCartonPly(e.target.value)} placeholder="5 PLY" sx={sxInput} />
              </Grid>
              <Grid item xs={4}>
                <TextField size="small" fullWidth label="Dimensions" value={cartonDims}
                  onChange={(e) => setCartonDims(e.target.value)} placeholder="L*W*H" sx={sxInput} />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1.5, color: 'text.secondary' }}>Sign-off</Typography>
            <TextField size="small" fullWidth label="Prepared By" value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)} sx={{ mb: 1.5, ...sxInput }} />
            <TextField size="small" fullWidth label="Received By" value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)} sx={{ mb: 1.5, ...sxInput }} />
            <TextField size="small" fullWidth label="Approved By" value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)} sx={{ mb: 1.5, ...sxInput }} />
            <TextField size="small" fullWidth label="Notes" multiline minRows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} sx={sxInput} />
          </Paper>

          {/* Item summary */}
          {pi && (
            <Paper elevation={0} sx={{ p: 2.5, mt: 2, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', mb: 1.5, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Item Summary
              </Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 1 }}>
                {[...new Set((pi.lines || []).map((l) => l.item_name))].join(' / ')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
                {colorChips.map(([color, qty]) => (
                  <Chip key={color} label={`${color}: ${qty}`} size="small"
                    sx={{ fontWeight: 700, fontSize: '0.72rem', bgcolor: alpha('#6366f1', 0.1), color: '#4338ca' }} />
                ))}
              </Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem' }}>Total: {totalQty.toLocaleString()} pcs</Typography>
              {autoFilled && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AutoAwesome sx={{ fontSize: 14, color: '#f59e0b' }} />
                  <Typography sx={{ fontSize: '0.72rem', color: '#92400e', fontWeight: 600 }}>Auto-filled from previous indent</Typography>
                </Box>
              )}
            </Paper>
          )}
        </Grid>

        {/* ── Right: BOM tables ── */}
        <Grid item xs={12} md={8}>

          {/* ── FABRIC ── */}
          <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', flex: 1 }}>Fabric</Typography>
              <Button size="small" startIcon={<Add />} onClick={addFabricRow}
                sx={{ fontWeight: 700, textTransform: 'none' }}>Add Row</Button>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 600 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(slate[900], 0.04) }}>
                    {['Material *', 'Color', 'Cons./pc', 'Unit', 'Total', 'Remarks', ''].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', py: 0.75, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fabricLines.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ py: 0.5, minWidth: 180 }}>
                        <TextField size="small" fullWidth value={row.material}
                          onChange={(e) => setFabricField(i, 'material', e.target.value)}
                          placeholder="e.g. 80% Polyester 20% Cotton" sx={sxInput} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, minWidth: 110 }}>
                        <Autocomplete freeSolo options={Object.keys(colorQty)} value={row.color}
                          onInputChange={(_, v) => setFabricField(i, 'color', v)}
                          renderInput={(params) => <TextField {...params} size="small" placeholder="Color" sx={sxInput} />} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 90 }}>
                        <TextField size="small" type="number" value={row.consumption_per_pc}
                          onChange={(e) => setFabricField(i, 'consumption_per_pc', e.target.value)}
                          inputProps={{ step: '0.0001' }} sx={sxInput} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 90 }}>
                        <TextField size="small" select value={row.unit}
                          onChange={(e) => setFabricField(i, 'unit', e.target.value)} sx={sxInput}>
                          {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 90 }}>
                        <TextField size="small" value={row.total_consumption}
                          onChange={(e) => setFabricField(i, 'total_consumption', e.target.value)}
                          sx={{ ...sxInput, '& input': { fontWeight: 700 } }} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, minWidth: 110 }}>
                        <TextField size="small" fullWidth value={row.remarks}
                          onChange={(e) => setFabricField(i, 'remarks', e.target.value)}
                          placeholder="e.g. in stock" sx={sxInput} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 36 }}>
                        <IconButton size="small" color="error" onClick={() => removeFabricRow(i)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Paper>

          {/* ── TRIMS ── */}
          <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', flex: 1 }}>Trims & Accessories</Typography>
              <Button size="small" startIcon={<Add />} onClick={addTrimRow}
                sx={{ fontWeight: 700, textTransform: 'none' }}>Add Row</Button>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 850 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(slate[900], 0.04) }}>
                    {['Trim Name *', 'Color/Variant', 'Size', 'Cons./pc', 'Unit', 'Total', 'Total Unit', 'Remarks', ''].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem', py: 0.75, whiteSpace: 'nowrap' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trimLines.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={{ py: 0.5, minWidth: 200 }}>
                        <Autocomplete
                          freeSolo
                          options={trimsList}
                          getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                          inputValue={row.trim_name}
                          onInputChange={(_, v) => setTrimField(i, 'trim_name', v)}
                          onChange={(_, v) => { if (v && typeof v === 'object') selectTrimFromLibrary(i, v); }}
                          renderOption={(props, o) => (
                            <Box component="li" {...props}>
                              <Box>
                                <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{o.name}</Typography>
                                {o.category && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{o.category}</Typography>}
                              </Box>
                            </Box>
                          )}
                          renderInput={(params) => (
                            <TextField {...params} size="small" placeholder="Type or pick from library" sx={sxInput} />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, minWidth: 110 }}>
                        <Autocomplete freeSolo options={Object.keys(colorQty)} value={row.color_variant}
                          onInputChange={(_, v) => setTrimField(i, 'color_variant', v)}
                          renderInput={(params) => <TextField {...params} size="small" placeholder="Color" sx={sxInput} />} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, minWidth: 90 }}>
                        <TextField size="small" fullWidth value={row.size_variant}
                          onChange={(e) => setTrimField(i, 'size_variant', e.target.value)}
                          placeholder="e.g. 6.5\"" sx={sxInput} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 80 }}>
                        <TextField size="small" type="number" value={row.consumption_per_pc}
                          onChange={(e) => setTrimField(i, 'consumption_per_pc', e.target.value)}
                          inputProps={{ step: '0.0001' }} sx={sxInput} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 90 }}>
                        <TextField size="small" select value={row.unit}
                          onChange={(e) => setTrimField(i, 'unit', e.target.value)} sx={sxInput}>
                          {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 90 }}>
                        <TextField size="small" value={row.total_consumption}
                          onChange={(e) => setTrimField(i, 'total_consumption', e.target.value)}
                          sx={{ ...sxInput, '& input': { fontWeight: 700 } }} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 90 }}>
                        <TextField size="small" select value={row.total_unit || row.unit}
                          onChange={(e) => setTrimField(i, 'total_unit', e.target.value)} sx={sxInput}>
                          {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell sx={{ py: 0.5, minWidth: 100 }}>
                        <TextField size="small" fullWidth value={row.remarks}
                          onChange={(e) => setTrimField(i, 'remarks', e.target.value)}
                          placeholder="in stock…" sx={sxInput} />
                      </TableCell>
                      <TableCell sx={{ py: 0.5, width: 36 }}>
                        <IconButton size="small" color="error" onClick={() => removeTrimRow(i)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Hidden print root ── */}
      <Box id="indent-print-root" sx={{ display: 'none' }}>
        <IndentDocument
          pi={pi}
          indent={{ indent_number: indentNumber, indent_date: indentDate, pcs_per_carton: pcsPerCarton, carton_ply: cartonPly, carton_dimensions: cartonDims, prepared_by: preparedBy, received_by: receivedBy, approved_by: approvedBy }}
          fabricLines={fabricLines}
          trimLines={trimLines}
          company={company}
        />
      </Box>
    </Box>
  );
}
