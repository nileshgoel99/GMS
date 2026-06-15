import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Chip,
  Paper,
  Divider,
  IconButton,
  Tooltip,
  InputAdornment,
  LinearProgress,
  Tabs,
  Tab,
  Collapse,
  Autocomplete,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  ArrowBack,
  Save,
  AddCircleOutline,
  RemoveCircleOutline,
  Add,
  ExpandMore,
  ExpandLess,
  DeleteOutline,
  AttachFile,
  OpenInNew,
  ReceiptLong,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { ordersAPI, customersAPI } from '../services/api';
import { slate, warm, spectrum } from '../theme/appTheme';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'RECEIVED',     label: 'Received',      color: 'default' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged',   color: 'info' },
  { value: 'IN_PRODUCTION',label: 'In Production',  color: 'warning' },
  { value: 'SHIPPED',      label: 'Shipped',        color: 'secondary' },
  { value: 'COMPLETED',    label: 'Completed',      color: 'success' },
  { value: 'CANCELLED',    label: 'Cancelled',      color: 'error' },
];
const statusColor = (v) => STATUS_OPTIONS.find((s) => s.value === v)?.color ?? 'default';
const statusLabel = (v) => STATUS_OPTIONS.find((s) => s.value === v)?.label ?? v;

// ── Section jump config ───────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'po-section-header', label: 'Buyer & PO header' },
  { id: 'po-section-lines',  label: 'Line items' },
  { id: 'po-section-terms',  label: 'Terms & notes' },
];

// ── Default structures ────────────────────────────────────────────────────────
const emptyLine = (exFactoryDate = '') => ({
  _key: Date.now() + Math.random(),
  item_code: '',
  item_name: '',
  fabric: '',
  color: '',
  customer_ref: '',
  size_breakdown: [
    { size: '', qty: '' },
  ],
  uom: 'PCS',
  unit_price: '',
  discount: '',
  delivery_date: exFactoryDate,
  notes: '',
});

const emptyForm = () => ({
  po_number: '',
  po_date: new Date().toISOString().slice(0, 10),
  customer: '',
  buyer_name: '',
  buyer_address: '',
  buyer_contact: '',
  supplier_code: '',
  currency: 'USD',
  delivery_terms: 'FOB-FREE ON BOARD',
  payment_terms: '60 DAYS FROM B/L DATE, D/A',
  delivery_method: 'THROUGH CARRIER - BY SEA',
  freight_terms: 'CARRIER',
  packaging_terms: 'STANDARD PACKAGING',
  ex_factory_date: '',
  status: 'RECEIVED',
  notes: '',
  inco_terms: '',
  port_of_loading: '',
  port_of_discharge: '',
  pi_ref: '',
  pi: null,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const lineQty = (line) =>
  (line.size_breakdown || []).reduce((s, r) => s + (parseInt(r.qty) || 0), 0);

const lineAmt = (line) => {
  const qty   = lineQty(line);
  const price = parseFloat(line.unit_price);
  if (!qty || !price) return null;
  const disc = parseFloat(line.discount) || 0;
  return qty * price * (1 - disc / 100);
};

const fmtNum   = (n) => (n == null || n === '' ? '—' : Number(n).toLocaleString());
const fmtMoney = (n, ccy = 'USD') =>
  n == null ? '—' : `${ccy} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Style helpers ─────────────────────────────────────────────────────────────
const canvasSx = (theme) => ({
  mx: { xs: -2, sm: -3, md: -4 },
  mt: { xs: -2, sm: -2.5 },
  mb: { xs: -4, md: -5 },
  px: { xs: 2, sm: 2.5, md: 3 },
  py: { xs: 2, sm: 2.5, md: 3 },
  borderRadius: { xs: 0, md: '20px' },
  bgcolor: '#f1f5f9', // Slate 100 background for the canvas
  backgroundImage: `
    radial-gradient(ellipse 100% 72% at 6% 0%, ${alpha(theme.palette.primary.main, 0.08)}, transparent 54%),
    radial-gradient(ellipse 85% 55% at 100% 0%, ${alpha('#b45309', 0.05)}, transparent 50%),
    linear-gradient(to bottom, ${alpha('#fff', 0.6)}, transparent),
    radial-gradient(circle at 1px 1px, ${alpha('#64748b', 0.08)} 1px, transparent 0),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")
  `,
  backgroundSize: 'auto, auto, auto, 24px 24px, 150px 150px',
  backgroundBlendMode: 'normal, normal, normal, normal, overlay',
  boxShadow: `inset 0 1px 0 ${alpha('#fff', 0.9)}, 0 1px 0 ${alpha(theme.palette.divider, 0.9)}`,
});

const sectionPanelSx = (accent, theme) => ({
  position: 'relative',
  zIndex: 1,
  mt: 3,
  borderRadius: '16px',
  bgcolor: alpha(accent || '#f8fafc', 0.04),
  border: `1px solid ${alpha(accent || slate[300], 0.2)}`,
  boxShadow: `0 8px 32px ${alpha(slate[900], 0.08)}, 0 2px 8px ${alpha(accent || slate[900], 0.06)}`,
  overflow: 'hidden',
});

const sectionHeaderSx = (theme, accent) => ({
  px: 3,
  py: 2,
  bgcolor: alpha(accent || '#f8fafc', 0.08),
  backgroundImage: `
    linear-gradient(135deg, ${alpha(accent || '#f8fafc', 0.12)} 0%, transparent 60%),
    repeating-linear-gradient(
      -55deg,
      ${alpha(accent || '#64748b', 0.04)} 0px,
      ${alpha(accent || '#64748b', 0.04)} 1px,
      transparent 1px,
      transparent 12px
    )
  `,
  borderBottom: `1px solid ${alpha(accent || slate[300], 0.2)}`,
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  flexWrap: 'wrap',
});

const fieldSx = {
  '& .MuiOutlinedInput-root': { 
    borderRadius: 1.5,
    bgcolor: '#fff',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      bgcolor: '#fafafa',
    },
    '&.Mui-focused': {
      bgcolor: '#fff',
      boxShadow: `0 0 0 4px ${alpha('#0f766e', 0.1)}`,
    }
  },
  '& .MuiInputBase-input': { fontSize: '0.875rem', fontWeight: 600 },
  '& .MuiInputLabel-root': { fontSize: '0.875rem', fontWeight: 500, color: slate[500] },
};

const groupLabelSx = {
  color: slate[400],
  fontWeight: 700,
  letterSpacing: '0.1em',
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  mb: 1.5,
  display: 'block',
};

// Shared sx for inputs sitting inside the dark calculation strip
const darkInputSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: alpha('#fff', 0.08),
    borderRadius: 1,
    '& fieldset': { borderColor: alpha('#fff', 0.15) },
    '&:hover fieldset': { borderColor: alpha('#fff', 0.35) },
    '&.Mui-focused': {
      bgcolor: alpha('#fff', 0.14),
      '& fieldset': { borderColor: alpha('#fff', 0.5) },
    },
  },
  '& .MuiInputBase-input': {
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.85rem',
    py: 0.5,
    px: 1,
    // Override browser autofill white background
    WebkitTextFillColor: '#fff',
    caretColor: '#fff',
  },
  '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': { display: 'none' },
  '& input[type=number]': { MozAppearance: 'textfield' },
};

// ── Single line item card ─────────────────────────────────────────────────────
function PoLineCard({ line, idx, onChange, onRemove, canRemove, theme, itemCatalogue, exFactoryDate }) {
  const [showNotes, setShowNotes] = useState(false);

  const setSizeQty  = (si, val) =>
    onChange({ size_breakdown: line.size_breakdown.map((r, i) => i === si ? { ...r, qty: val } : r) });
  const setSizeName = (si, val) =>
    onChange({ size_breakdown: line.size_breakdown.map((r, i) => i === si ? { ...r, size: val } : r) });
  const addSize   = () => onChange({ size_breakdown: [...line.size_breakdown, { size: '', qty: '' }] });
  const removeSize = (si) =>
    onChange({ size_breakdown: line.size_breakdown.filter((_, i) => i !== si) });

  const qty = lineQty(line);
  const amt = lineAmt(line);

  const cellInputProps = {
    style: { textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', padding: '6px 4px' },
  };

  return (
    <Paper
      elevation={0}
      sx={{
        borderRadius: 3,
        border: `1px solid ${slate[200]}`,
        overflow: 'hidden',
        mb: 3,
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: `0 10px 30px ${alpha(slate[900], 0.06)}`,
        }
      }}
    >
      {/* ── Card header bar ─── */}
      <Box
        sx={{
          px: 3,
          py: 1.75,
          bgcolor: slate[50],
          borderBottom: `1px solid ${slate[200]}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '0.7rem',
            fontWeight: 800,
            letterSpacing: '0.1em',
            color: '#fff',
            bgcolor: slate[800],
            px: 1.25,
            py: 0.5,
            borderRadius: 1.5,
            boxShadow: `0 2px 4px ${alpha(slate[900], 0.2)}`,
          }}
        >
          LINE {idx + 1}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1.5, overflow: 'hidden' }}>
          {line.item_code && (
            <Typography
              noWrap
              sx={{
                fontFamily: '"IBM Plex Mono", monospace',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                px: 1,
                py: 0.25,
                borderRadius: 1,
              }}
            >
              {line.item_code}
            </Typography>
          )}
          {line.item_name && (
            <Typography noWrap sx={{ fontWeight: 700, fontSize: '0.95rem', color: slate[800] }}>
              {line.item_name}
            </Typography>
          )}
          {line.color && (
            <Chip
              label={line.color}
              size="small"
              sx={{ 
                fontWeight: 700, 
                bgcolor: '#fff', 
                border: `1px solid ${slate[200]}`,
                color: slate[600],
                height: 24,
                '& .MuiChip-label': { px: 1 }
              }}
            />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, ml: 2 }}>
          {qty > 0 && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: slate[400], fontWeight: 700, textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>Qty</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: slate[700], fontVariantNumeric: 'tabular-nums' }}>
                {fmtNum(qty)}
              </Typography>
            </Box>
          )}
          {amt != null && (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="caption" sx={{ color: slate[400], fontWeight: 700, textTransform: 'uppercase', display: 'block', lineHeight: 1 }}>Value</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: theme.palette.primary.dark, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMoney(amt)}
              </Typography>
            </Box>
          )}
          {canRemove && (
            <Tooltip title="Remove line">
              <IconButton 
                size="small" 
                onClick={onRemove} 
                sx={{ 
                  color: slate[300], 
                  '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.08) } 
                }}
              >
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* ── Card body ─── */}
      <Box sx={{ p: 3 }}>
        {/* Row 1: code, name, colour */}
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid item xs={12} sm={3}>
            <Autocomplete
              freeSolo
              options={itemCatalogue}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.item_code)}
              filterOptions={(opts, { inputValue }) =>
                opts.filter((o) =>
                  o.item_code.toLowerCase().includes(inputValue.toLowerCase())
                )
              }
              value={line.item_code}
              inputValue={line.item_code}
              onInputChange={(_, val) => onChange({ item_code: val })}
              onChange={(_, selected) => {
                if (selected && typeof selected === 'object') {
                  onChange({
                    item_code:  selected.item_code,
                    item_name:  line.item_name  || selected.item_name,
                    fabric:     line.fabric     || selected.fabric,
                  });
                }
              }}
              renderOption={(props, opt) => (
                <Box component="li" {...props} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 1 }}>
                  <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700, fontSize: '0.85rem', color: theme.palette.primary.main }}>
                    {opt.item_code}
                  </Typography>
                  {opt.item_name && (
                    <Typography sx={{ fontSize: '0.75rem', color: slate[500] }}>{opt.item_name}</Typography>
                  )}
                  {opt.fabric && (
                    <Typography sx={{ fontSize: '0.68rem', color: slate[400] }}>{opt.fabric}</Typography>
                  )}
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  fullWidth
                  label="Item Code"
                  placeholder="e.g. V181-0-02A"
                  sx={fieldSx}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              size="small"
              fullWidth
              required
              label="Item Name"
              value={line.item_name}
              onChange={(e) => onChange({ item_name: e.target.value })}
              placeholder='e.g. TROUSERS "RABAT"'
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              size="small"
              fullWidth
              label="Colour"
              value={line.color}
              onChange={(e) => onChange({ color: e.target.value })}
              placeholder="e.g. NAVY BLUE"
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              size="small"
              fullWidth
              label="Fabric / Composition"
              value={line.fabric}
              onChange={(e) => onChange({ fabric: e.target.value })}
              placeholder="e.g. 65% polyester / 35% cotton 245gr./sqm"
              helperText="Auto-filled from item code history — edit freely"
              FormHelperTextProps={{ sx: { display: line.fabric ? 'block' : 'none', fontSize: '0.68rem', color: slate[400] } }}
              sx={fieldSx}
            />
          </Grid>
        </Grid>

        {/* Row 2: customer ref + delivery date */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              size="small"
              fullWidth
              label="Customer Ref / OdL No."
              value={line.customer_ref}
              onChange={(e) => onChange({ customer_ref: e.target.value })}
              placeholder="e.g. 5 OR 37087"
              sx={fieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              size="small"
              fullWidth
              label="Delivery Date"
              type="date"
              value={line.delivery_date}
              onChange={(e) => onChange({ delivery_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText={exFactoryDate && line.delivery_date === exFactoryDate ? 'Pre-filled from Ex-Factory date' : ' '}
              FormHelperTextProps={{ sx: { fontSize: '0.68rem', color: slate[400] } }}
              sx={fieldSx}
            />
          </Grid>
        </Grid>

        {/* Size breakdown — horizontal chips */}
        <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2.5, border: `1px solid ${slate[200]}`, p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1.5 }}>
            <Box sx={{ width: 4, height: 14, bgcolor: theme.palette.primary.main, borderRadius: 1 }} />
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: slate[500] }}>
              Size breakdown
            </Typography>
            {qty > 0 && (
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: slate[400] }}>
                · {fmtNum(qty)} pcs total
              </Typography>
            )}
          </Box>

          {/* Horizontal wrapping pairs */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}>
            {line.size_breakdown.map((r, si) => (
              <Box
                key={si}
                sx={{
                  display: 'flex',
                  alignItems: 'stretch',
                  border: `1px solid ${slate[200]}`,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: '#fff',
                  boxShadow: `0 1px 3px ${alpha(slate[900], 0.04)}`,
                }}
              >
                {/* Size name */}
                <Box sx={{ borderRight: `1px solid ${slate[200]}` }}>
                  <input
                    value={r.size}
                    onChange={(e) => setSizeName(si, e.target.value)}
                    placeholder="Size"
                    style={{
                      width: 72,
                      height: '100%',
                      border: 'none',
                      outline: 'none',
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: slate[700],
                      background: 'transparent',
                      padding: '10px 6px',
                      fontFamily: 'inherit',
                    }}
                  />
                </Box>
                {/* Qty */}
                <input
                  type="number"
                  value={r.qty}
                  onChange={(e) => setSizeQty(si, e.target.value)}
                  placeholder="Qty"
                  min={0}
                  style={{
                    width: 76,
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: slate[900],
                    background: 'transparent',
                    padding: '10px 6px',
                    fontFamily: 'inherit',
                    MozAppearance: 'textfield',
                  }}
                />
                {/* Remove */}
                {line.size_breakdown.length > 1 && (
                  <Box
                    onClick={() => removeSize(si)}
                    sx={{
                      display: 'flex', alignItems: 'center', px: 0.5,
                      borderLeft: `1px solid ${slate[100]}`,
                      cursor: 'pointer', color: slate[300],
                      '&:hover': { color: 'error.main', bgcolor: alpha('#ef4444', 0.06) },
                    }}
                  >
                    <RemoveCircleOutline sx={{ fontSize: 13 }} />
                  </Box>
                )}
              </Box>
            ))}

            {/* Add size */}
            <Box
              onClick={addSize}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                border: `1px dashed ${alpha(theme.palette.primary.main, 0.35)}`,
                borderRadius: 1.5, px: 1.5, py: '6px',
                cursor: 'pointer', color: theme.palette.primary.main,
                fontSize: '0.75rem', fontWeight: 700,
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05), borderColor: theme.palette.primary.main },
              }}
            >
              <AddCircleOutline sx={{ fontSize: 14 }} /> Add
            </Box>
          </Box>
        </Box>

        {/* ── Calculation strip ─── */}
        <Box
          sx={{
            mt: 2.5,
            borderRadius: 2,
            bgcolor: slate[900],
            px: 2.5,
            py: 1.75,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: { xs: 1.5, sm: 0 },
          }}
        >
          {/* Qty (read-only from sizes) */}
          <Box sx={{ minWidth: 80, borderRight: `1px solid ${alpha('#fff', 0.1)}`, pr: 2, mr: 2 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha('#fff', 0.45), mb: 0.3 }}>Total Qty</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: qty > 0 ? '#fff' : alpha('#fff', 0.25), fontVariantNumeric: 'tabular-nums' }}>
              {qty > 0 ? fmtNum(qty) : '—'}
            </Typography>
          </Box>

          {/* UOM */}
          <Box sx={{ width: 80, borderRight: `1px solid ${alpha('#fff', 0.1)}`, pr: 2, mr: 2 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha('#fff', 0.45), mb: 0.3 }}>UOM</Typography>
            <TextField
              size="small"
              value={line.uom}
              onChange={(e) => onChange({ uom: e.target.value })}
              sx={darkInputSx}
            />
          </Box>

          {/* Unit Price */}
          <Box sx={{ width: 120, borderRight: `1px solid ${alpha('#fff', 0.1)}`, pr: 2, mr: 2 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha('#fff', 0.45), mb: 0.3 }}>Unit Price</Typography>
            <TextField
              size="small"
              type="number"
              value={line.unit_price}
              onChange={(e) => onChange({ unit_price: e.target.value })}
              InputProps={{
                startAdornment: <InputAdornment position="start"><Typography sx={{ color: alpha('#fff', 0.45), fontSize: '0.8rem', fontWeight: 700 }}>$</Typography></InputAdornment>,
              }}
              sx={darkInputSx}
            />
          </Box>

          {/* Discount */}
          <Box sx={{ width: 100, borderRight: `1px solid ${alpha('#fff', 0.1)}`, pr: 2, mr: 2 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha('#fff', 0.45), mb: 0.3 }}>Disc %</Typography>
            <TextField
              size="small"
              type="number"
              value={line.discount}
              onChange={(e) => onChange({ discount: e.target.value })}
              placeholder="0"
              InputProps={{
                endAdornment: <InputAdornment position="end"><Typography sx={{ color: alpha('#fff', 0.45), fontSize: '0.8rem' }}>%</Typography></InputAdornment>,
              }}
              sx={darkInputSx}
            />
          </Box>

          {/* Line Amount (calculated) */}
          <Box sx={{ flex: 1, textAlign: 'right' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: alpha('#fff', 0.45), mb: 0.3 }}>Line Amount</Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.3rem', fontVariantNumeric: 'tabular-nums', color: amt != null ? theme.palette.primary.light : alpha('#fff', 0.2) }}>
              {amt != null ? fmtMoney(amt) : '—'}
            </Typography>
          </Box>
        </Box>

        {/* Optional notes */}
        <Box sx={{ mt: 2 }}>
          <Button
            size="small"
            onClick={() => setShowNotes((v) => !v)}
            endIcon={showNotes ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
            sx={{ 
              textTransform: 'none', 
              fontSize: '0.78rem', 
              color: slate[500], 
              fontWeight: 700,
              px: 1,
              borderRadius: 1,
              '&:hover': { bgcolor: slate[50] }
            }}
          >
            {showNotes ? 'Hide internal notes' : 'Add internal notes'}
          </Button>
          <Collapse in={showNotes}>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              value={line.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Internal remarks for this line (won't show on buyer documents)…"
              sx={{ mt: 1.5, ...fieldSx }}
            />
          </Collapse>
        </Box>
      </Box>
    </Paper>
  );
}

// ── Summary footer bar ────────────────────────────────────────────────────────
function SummaryBar({ lines, currency }) {
  const theme = useTheme();
  const totalQty = lines.reduce((s, l) => s + lineQty(l), 0);
  const totalAmt = lines.reduce((s, l) => s + (lineAmt(l) ?? 0), 0);

  return (
    <Box
      sx={{
        mt: 4,
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow: `0 12px 30px ${alpha(slate[900], 0.25)}`,
        display: 'flex',
        flexWrap: 'wrap',
      }}
    >
      {/* Styles tile */}
      <Box sx={{ flex: '1 1 120px', bgcolor: '#1e293b', p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: `1px solid ${alpha('#fff', 0.06)}` }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', mb: 0.75 }}>
          Styles
        </Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: '#f1f5f9', lineHeight: 1 }}>
          {lines.length}
        </Typography>
      </Box>

      {/* Total Qty tile */}
      <Box sx={{ flex: '2 1 180px', bgcolor: '#0f172a', p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: `1px solid ${alpha('#fff', 0.06)}` }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', mb: 0.75 }}>
          Total Quantity
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: '#f8fafc', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {fmtNum(totalQty)}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#64748b' }}>pcs</Typography>
        </Box>
      </Box>

      {/* Order Value tile */}
      <Box sx={{ flex: '3 1 240px', bgcolor: slate[900], p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#94a3b8', mb: 0.75 }}>
          Order Value
        </Typography>
        <Typography sx={{ fontWeight: 900, fontSize: '1.75rem', fontVariantNumeric: 'tabular-nums', color: theme.palette.primary.light, lineHeight: 1 }}>
          {fmtMoney(totalAmt, currency || 'USD')}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main editor page ──────────────────────────────────────────────────────────
export default function BuyerPOEditorPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const isCreate = id === 'new';

  const [loading, setLoading]       = useState(!isCreate);
  const [saving, setSaving]         = useState(false);
  const [customers, setCustomers]   = useState([]);
  const [itemCatalogue, setItemCatalogue] = useState([]);
  const [poDocument, setPoDocument] = useState(null);   // URL of uploaded doc
  const [uploading, setUploading]   = useState(false);
  const [sectionTab, setSectionTab] = useState(0);
  const [formData, setFormData]     = useState(emptyForm());
  const [lines, setLines]           = useState([emptyLine('')]);
  
  // Section expansion state
  const [expanded, setExpanded] = useState({
    header: true,
    lines: true,
    terms: true,
  });

  // Accordion: opening one section collapses the others
  const toggleSection = (key) =>
    setExpanded(prev => ({
      header: key === 'header' ? !prev.header : false,
      lines:  key === 'lines'  ? !prev.lines  : false,
      terms:  key === 'terms'  ? !prev.terms  : false,
    }));

  const numericId = useMemo(() => {
    if (isCreate) return null;
    const n = parseInt(id, 10);
    return Number.isNaN(n) ? null : n;
  }, [id, isCreate]);

  // Load customers
  useEffect(() => {
    customersAPI.getAll({ page_size: 500 })
      .then((r) => setCustomers(r.data.results ?? r.data))
      .catch(() => {});
  }, []);

  // Reload item catalogue whenever the customer changes (codes are buyer-specific)
  useEffect(() => {
    ordersAPI.getItemCatalogue(formData.customer || null)
      .then((r) => setItemCatalogue(r.data))
      .catch(() => {});
  }, [formData.customer]);

  // Load PO if editing
  useEffect(() => {
    if (isCreate) { setLoading(false); return; }
    if (!numericId) { navigate('/buyer-pos'); return; }
    (async () => {
      setLoading(true);
      try {
        const res = await ordersAPI.getBuyerPO(numericId);
        const po = res.data;
        setFormData({
          po_number:       po.po_number || '',
          po_date:         po.po_date || '',
          customer:        po.customer || '',
          buyer_name:      po.buyer_name || '',
          buyer_address:   po.buyer_address || '',
          buyer_contact:   po.buyer_contact || '',
          supplier_code:   po.supplier_code || '',
          currency:        po.currency || 'USD',
          delivery_terms:  po.delivery_terms || '',
          payment_terms:   po.payment_terms || '',
          delivery_method: po.delivery_method || '',
          freight_terms:   po.freight_terms || '',
          packaging_terms: po.packaging_terms || '',
          ex_factory_date: po.ex_factory_date || '',
          status:          po.status || 'RECEIVED',
          notes:           po.notes || '',
          inco_terms:      po.inco_terms || '',
          port_of_loading: po.port_of_loading || '',
          port_of_discharge: po.port_of_discharge || '',
          pi_ref:          po.pi_ref || '',
          pi:              po.pi || null,
        });
        setPoDocument(po.po_document || null);
        setLines(
          (po.lines || []).map((l) => ({
            _key: l.id,
            item_code:      l.item_code || '',
            item_name:      l.item_name || '',
            fabric:         l.fabric || '',
            color:          l.color || '',
            customer_ref:   l.customer_ref || '',
            size_breakdown: l.size_breakdown?.length
              ? l.size_breakdown.map((s) => ({ size: s.size, qty: s.qty != null ? String(s.qty) : '' }))
              : [{ size: '', qty: '' }],
            uom:           l.uom || 'PCS',
            unit_price:    l.unit_price != null ? String(l.unit_price) : '',
            discount:      l.discount != null ? String(l.discount) : '',
            delivery_date: l.delivery_date || '',
            notes:         l.notes || '',
          })),
        );
      } catch (e) {
        console.error(e);
        navigate('/buyer-pos');
      } finally {
        setLoading(false);
      }
    })();
  }, [isCreate, numericId, navigate]);

  // Section scroll
  const scrollTo = useCallback((idx) => {
    const el = document.getElementById(SECTIONS[idx]?.id);
    if (el) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }, []);

  const handleTabChange = useCallback((_, v) => {
    setSectionTab(v);
    scrollTo(v);
    const keys = ['header', 'lines', 'terms'];
    setExpanded({ header: v === 0, lines: v === 1, terms: v === 2 });
  }, [scrollTo]);

  // Form field helpers
  const setField = (key, val) => {
    setFormData((f) => ({ ...f, [key]: val }));
    // When ex_factory_date changes, pre-fill any line that still has no delivery date
    if (key === 'ex_factory_date' && val) {
      setLines((ls) => ls.map((l) => l.delivery_date ? l : { ...l, delivery_date: val }));
    }
  };

  const updateLine = (idx, patch) =>
    setLines((ls) => ls.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const addLine    = () => setLines((ls) => [...ls, emptyLine(formData.ex_factory_date)]);
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx));

  // Save — returns the saved PO id (used by both save buttons)
  const handleSave = async ({ generatePI = false } = {}) => {
    if (!formData.po_number.trim()) return alert('PO Number is required.');
    if (!formData.po_date)          return alert('PO Date is required.');
    if (lines.some((l) => !l.item_name.trim())) return alert('Every line needs an Item Name.');

    const payload = {
      ...formData,
      customer:        formData.customer || null,
      ex_factory_date: formData.ex_factory_date || null,
      lines: lines.map((l) => ({
        item_code:      l.item_code,
        item_name:      l.item_name,
        fabric:         l.fabric,
        color:          l.color,
        customer_ref:   l.customer_ref,
        size_breakdown: l.size_breakdown
          .filter((r) => r.size)
          .map((r) => ({ size: r.size, qty: parseInt(r.qty) || 0 })),
        uom:           l.uom || 'PCS',
        unit_price:    l.unit_price !== '' ? parseFloat(l.unit_price) : null,
        discount:      l.discount !== '' ? parseFloat(l.discount) : null,
        delivery_date: l.delivery_date || null,
        notes:         l.notes,
      })),
    };

    setSaving(true);
    try {
      let savedId;
      if (isCreate) {
        const res = await ordersAPI.createBuyerPO(payload);
        savedId = res.data.id;
      } else {
        await ordersAPI.updateBuyerPO(numericId, payload);
        savedId = numericId;
      }
      if (generatePI) {
        navigate(`/buyer-pos/${savedId}/generate-pi`);
      } else {
        navigate('/buyer-pos');
      }
    } catch (e) {
      console.error(e);
      const msg = e.response?.data ? JSON.stringify(e.response.data, null, 2) : e.message;
      alert('Error saving:\n' + msg);
    } finally {
      setSaving(false);
    }
  };

  // Upload PO document (only available after PO is saved)
  const handleUploadDoc = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !numericId) return;
    setUploading(true);
    try {
      const res = await ordersAPI.uploadPoDocument(numericId, file);
      setPoDocument(res.data.po_document);
    } catch (err) {
      alert('Upload failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveDoc = async () => {
    if (!numericId || !window.confirm('Remove the attached document?')) return;
    await ordersAPI.removePoDocument(numericId);
    setPoDocument(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const accentBlue  = '#0369a1'; // Sky 700
  const accentGreen = '#0f766e'; // Teal 700
  const accentAmber = '#b45309'; // Amber 700

  return (
    <Box sx={canvasSx(theme)}>
      {loading && <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, height: 3, borderRadius: 2 }} />}

      {/* ── Sticky toolbar ─── */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: { xs: 1.5, sm: 2 },
          borderRadius: '20px',
          bgcolor: alpha('#ffffff', 0.95),
          border: `1px solid ${slate[200]}`,
          boxShadow: `0 12px 40px ${alpha(slate[900], 0.08)}`,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 12,
          zIndex: 100,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Tooltip title="Back to list">
            <IconButton 
              size="small" 
              onClick={() => navigate('/buyer-pos')}
              sx={{ bgcolor: slate[50], '&:hover': { bgcolor: slate[100] } }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ flexShrink: 0 }}>
            <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.1, color: slate[900], letterSpacing: '-0.01em' }}>
              {isCreate ? 'New Buyer PO' : `PO ${formData.po_number || '…'}`}
            </Typography>
            {!isCreate && formData.buyer_name && (
              <Typography sx={{ fontSize: '0.75rem', color: slate[500], fontWeight: 600 }}>{formData.buyer_name}</Typography>
            )}
          </Box>
          
          <Box sx={{ flex: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <Tabs
              value={sectionTab}
              onChange={handleTabChange}
              sx={{
                minHeight: 40,
                bgcolor: slate[50],
                borderRadius: '12px',
                p: 0.5,
                '& .MuiTabs-indicator': { 
                  height: '100%', 
                  borderRadius: '8px', 
                  bgcolor: '#fff', 
                  boxShadow: `0 2px 8px ${alpha(slate[900], 0.08)}`,
                  zIndex: 0 
                },
                '& .MuiTab-root': { 
                  minHeight: 32, 
                  py: 0, 
                  px: 2.5, 
                  fontSize: '0.8rem', 
                  fontWeight: 700, 
                  textTransform: 'none',
                  zIndex: 1,
                  color: slate[500],
                  transition: 'color 0.2s',
                  '&.Mui-selected': { color: theme.palette.primary.main }
                },
              }}
            >
              {SECTIONS.map((s, i) => <Tab key={i} label={s.label} />)}
            </Tabs>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
            {!isCreate && (
              <Chip 
                label={statusLabel(formData.status)} 
                color={statusColor(formData.status)} 
                size="small" 
                sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.65rem', letterSpacing: '0.05em' }}
              />
            )}
            {!isCreate && (
              formData.pi ? (
                <Button
                  variant="outlined"
                  startIcon={<ReceiptLong />}
                  onClick={() => navigate(`/orders/pi/${formData.pi}/view`)}
                  sx={{ borderRadius: 2, px: 2.5, fontWeight: 700, textTransform: 'none', borderColor: '#0f766e', color: '#0f766e' }}
                >
                  View PI
                </Button>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<ReceiptLong />}
                  onClick={() => navigate(`/buyer-pos/${numericId}/generate-pi`)}
                  sx={{ borderRadius: 2, px: 2.5, fontWeight: 700, textTransform: 'none' }}
                >
                  Generate PI
                </Button>
              )
            )}
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={() => handleSave()}
              disabled={saving || loading}
              sx={{ 
                borderRadius: 2, 
                px: 3, 
                fontWeight: 800, 
                textTransform: 'none',
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': {
                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                }
              }}
            >
              {saving ? 'Saving…' : isCreate ? 'Create PO' : 'Save changes'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* ══ SECTION 1: Buyer & PO header ══════════════════════════════════════ */}
      <Box id="po-section-header" sx={sectionPanelSx(accentBlue, theme)}>
        <Box 
          sx={{ ...sectionHeaderSx(theme, accentBlue), cursor: 'pointer' }}
          onClick={() => toggleSection('header')}
        >
          <Box sx={{ bgcolor: accentBlue, color: '#fff', p: 0.75, borderRadius: 1.25, display: 'flex' }}>
            <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', lineHeight: 1 }}>H</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, color: slate[800], fontSize: '1rem' }}>Buyer & PO header</Typography>
          <IconButton size="small" sx={{ ml: 1, color: slate[400] }}>
            {expanded.header ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
          <Chip
            label="Section 01"
            size="small"
            sx={{ ml: 'auto', fontWeight: 800, bgcolor: alpha(accentBlue, 0.1), color: accentBlue, border: 'none', fontSize: '0.65rem', textTransform: 'uppercase' }}
          />
        </Box>
        <Collapse in={expanded.header}>
          <Box sx={{
            p: { xs: 3, sm: 4 },
            bgcolor: alpha(accentBlue, 0.03),
            backgroundImage: `radial-gradient(circle, ${alpha(accentBlue, 0.09)} 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
          }}>
          {/* PO meta */}
          <Typography sx={groupLabelSx}>PO identity & logistics</Typography>
          <Grid container spacing={3} sx={{ mb: 5 }}>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="PO Number *"
                value={formData.po_number} onChange={(e) => setField('po_number', e.target.value)}
                placeholder="e.g. 1112673" sx={fieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="PO Date *" type="date"
                value={formData.po_date} onChange={(e) => setField('po_date', e.target.value)}
                InputLabelProps={{ shrink: true }} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="Ex-Factory Date" type="date"
                value={formData.ex_factory_date} onChange={(e) => setField('ex_factory_date', e.target.value)}
                InputLabelProps={{ shrink: true }} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="Currency"
                value={formData.currency} onChange={(e) => setField('currency', e.target.value)} sx={fieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="Supplier Code"
                value={formData.supplier_code} onChange={(e) => setField('supplier_code', e.target.value)}
                placeholder="e.g. 004724" sx={fieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth select label="Status"
                value={formData.status} onChange={(e) => setField('status', e.target.value)} sx={fieldSx}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>

          <Divider sx={{ mb: 4, borderStyle: 'dashed' }} />

          {/* Buyer info */}
          <Typography sx={groupLabelSx}>Buyer details</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth select label="Link to customer master"
                value={formData.customer}
                onChange={(e) => {
                    const cust = customers.find((c) => c.id === e.target.value);
                    const addrParts = cust ? [
                      cust.address_line1,
                      cust.address_line2,
                      [cust.city, cust.region_state, cust.postal_code].filter(Boolean).join(', '),
                      cust.country,
                    ].filter(Boolean) : [];
                    const derivedAddress = addrParts.join('\n');
                    setFormData((f) => ({
                      ...f,
                      customer: e.target.value,
                      buyer_name: cust ? (cust.company_legal_name || f.buyer_name) : f.buyer_name,
                      buyer_contact: cust?.primary_contact_name || f.buyer_contact,
                      buyer_address: cust ? (derivedAddress || f.buyer_address) : f.buyer_address,
                    }));
                  }}
                sx={fieldSx}
              >
                <MenuItem value="">— Select Customer —</MenuItem>
                {customers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.company_legal_name} {c.customer_code ? `(${c.customer_code})` : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="Buyer / Company Name"
                value={formData.buyer_name} onChange={(e) => setField('buyer_name', e.target.value)}
                placeholder="e.g. COFRA S.R.L." sx={fieldSx} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField size="small" fullWidth label="Buyer Contact Person"
                value={formData.buyer_contact} onChange={(e) => setField('buyer_contact', e.target.value)}
                placeholder="Contact name" sx={fieldSx} />
            </Grid>
              <Grid item xs={12}>
                <TextField size="small" fullWidth multiline minRows={1} maxRows={4}
                  label="Buyer Address"
                  value={formData.buyer_address} onChange={(e) => setField('buyer_address', e.target.value)}
                  placeholder="Auto-filled from customer master — edit freely…"
                  helperText="Auto-filled when customer selected. Click to expand."
                  sx={{
                    ...fieldSx,
                    '& .MuiInputBase-root': { bgcolor: '#fcfcfc' },
                    '& .MuiFormHelperText-root': { fontSize: '0.7rem', color: slate[400], mt: 0.5 },
                  }} />
              </Grid>
          </Grid>
        </Box>
      </Collapse>
    </Box>

      {/* ══ SECTION 2: Line items ═════════════════════════════════════════════ */}
      <Box id="po-section-lines" sx={sectionPanelSx(accentGreen, theme)}>
        <Box 
          sx={{ ...sectionHeaderSx(theme, accentGreen), cursor: 'pointer' }}
          onClick={() => toggleSection('lines')}
        >
          <Box sx={{ bgcolor: accentGreen, color: '#fff', p: 0.75, borderRadius: 1.25, display: 'flex' }}>
            <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', lineHeight: 1 }}>L</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, color: slate[800], fontSize: '1rem' }}>Line items</Typography>
          <IconButton size="small" sx={{ ml: 1, color: slate[400] }}>
            {expanded.lines ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
          <Chip
            label={`${lines.length} Style${lines.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{ ml: 2, fontWeight: 700, bgcolor: alpha(accentGreen, 0.08), color: accentGreen, border: 'none', height: 24 }}
          />
          <Chip
            label="Section 02"
            size="small"
            sx={{ ml: 'auto', fontWeight: 800, bgcolor: alpha(accentGreen, 0.1), color: accentGreen, border: 'none', fontSize: '0.65rem', textTransform: 'uppercase' }}
          />
        </Box>
        <Collapse in={expanded.lines}>
          <Box sx={{
            p: { xs: 2.5, sm: 4 },
            bgcolor: alpha(accentGreen, 0.03),
            backgroundImage: `repeating-linear-gradient(45deg, ${alpha(accentGreen, 0.05)} 0px, ${alpha(accentGreen, 0.05)} 1px, transparent 1px, transparent 18px)`,
          }}>
            {lines.map((line, idx) => (
              <PoLineCard
                key={line._key}
                line={line}
                idx={idx}
                theme={theme}
                itemCatalogue={itemCatalogue}
                exFactoryDate={formData.ex_factory_date}
                onChange={(patch) => updateLine(idx, patch)}
                onRemove={() => removeLine(idx)}
                canRemove={lines.length > 1}
              />
            ))}
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={addLine}
              sx={{
                py: 1.5,
                px: 6,
                borderRadius: 2.5,
                bgcolor: '#fff',
                color: theme.palette.primary.main,
                borderColor: alpha(theme.palette.primary.main, 0.4),
                borderWidth: 2,
                borderStyle: 'dashed',
                fontWeight: 800,
                textTransform: 'none',
                fontSize: '0.9rem',
                '&:hover': { 
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                  borderColor: theme.palette.primary.main,
                  borderWidth: 2,
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                },
              }}
            >
              Add another style line
            </Button>
          </Box>
          
          <SummaryBar lines={lines} currency={formData.currency} />
        </Box>
      </Collapse>
    </Box>

      {/* ══ SECTION 3: Terms & notes ══════════════════════════════════════════ */}
      <Box id="po-section-terms" sx={{ ...sectionPanelSx(accentAmber, theme), mb: 6 }}>
        <Box 
          sx={{ ...sectionHeaderSx(theme, accentAmber), cursor: 'pointer' }}
          onClick={() => toggleSection('terms')}
        >
          <Box sx={{ bgcolor: accentAmber, color: '#fff', p: 0.75, borderRadius: 1.25, display: 'flex' }}>
            <Typography sx={{ fontWeight: 900, fontSize: '0.8rem', lineHeight: 1 }}>T</Typography>
          </Box>
          <Typography sx={{ fontWeight: 800, color: slate[800], fontSize: '1rem' }}>Terms & notes</Typography>
          <IconButton size="small" sx={{ ml: 1, color: slate[400] }}>
            {expanded.terms ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
          </IconButton>
          <Chip
            label="Section 03"
            size="small"
            sx={{ ml: 'auto', fontWeight: 800, bgcolor: alpha(accentAmber, 0.1), color: accentAmber, border: 'none', fontSize: '0.65rem', textTransform: 'uppercase' }}
          />
        </Box>
        <Collapse in={expanded.terms}>
          <Box sx={{
            p: { xs: 3, sm: 4 },
            bgcolor: '#fffbf0',
            backgroundImage: `
              repeating-linear-gradient(0deg,   ${alpha(accentAmber, 0.06)} 0px, ${alpha(accentAmber, 0.06)} 1px, transparent 1px, transparent 22px),
              repeating-linear-gradient(90deg,  ${alpha(accentAmber, 0.06)} 0px, ${alpha(accentAmber, 0.06)} 1px, transparent 1px, transparent 22px)
            `,
          }}>
            <Typography sx={groupLabelSx}>Commercial terms</Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={6}>
                <TextField size="small" fullWidth label="Terms of Delivery"
                  value={formData.delivery_terms} onChange={(e) => setField('delivery_terms', e.target.value)}
                  placeholder="e.g. FOB-FREE ON BOARD" sx={fieldSx} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField size="small" fullWidth label="Terms of Payment"
                  value={formData.payment_terms} onChange={(e) => setField('payment_terms', e.target.value)}
                  placeholder="e.g. 60 DAYS FROM B/L DATE, D/A" sx={fieldSx} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField size="small" fullWidth label="Delivery Method"
                  value={formData.delivery_method} onChange={(e) => setField('delivery_method', e.target.value)}
                  placeholder="e.g. BY SEA CARRIER" sx={fieldSx} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField size="small" fullWidth label="Terms of Freight"
                  value={formData.freight_terms} onChange={(e) => setField('freight_terms', e.target.value)} sx={fieldSx} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField size="small" fullWidth label="Packaging Terms"
                  value={formData.packaging_terms} onChange={(e) => setField('packaging_terms', e.target.value)}
                  placeholder="e.g. STANDARD PACKAGING" sx={fieldSx} />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3, borderStyle: 'dashed' }} />

            <Typography sx={groupLabelSx}>Port & Inco Terms</Typography>
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid item xs={12} sm={4}>
                <TextField size="small" fullWidth label="Inco Terms"
                  value={formData.inco_terms} onChange={(e) => setField('inco_terms', e.target.value)}
                  placeholder="e.g. FOB NHAVA SHEVA" sx={fieldSx} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField size="small" fullWidth label="Port of Loading"
                  value={formData.port_of_loading} onChange={(e) => setField('port_of_loading', e.target.value)}
                  placeholder="e.g. NHAVA SHEVA PORT" sx={fieldSx} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField size="small" fullWidth label="Port of Discharge"
                  value={formData.port_of_discharge} onChange={(e) => setField('port_of_discharge', e.target.value)}
                  placeholder="e.g. KHIDIRPUR PORT" sx={fieldSx} />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3, borderStyle: 'dashed' }} />

            <Typography sx={groupLabelSx}>Internal remarks</Typography>
            <TextField size="small" fullWidth label="Internal notes"
              value={formData.notes} onChange={(e) => setField('notes', e.target.value)}
              placeholder="Any internal remarks about this PO (won't be printed)…" 
              sx={{ ...fieldSx, '& .MuiInputBase-root': { bgcolor: '#fcfcfc' } }} />

            <Divider sx={{ my: 4, borderStyle: 'dashed' }} />

            {/* PO Document upload */}
            <Typography sx={groupLabelSx}>Original PO Document</Typography>
            <Box
              sx={{
                border: `2px dashed ${poDocument ? alpha(accentGreen, 0.4) : slate[200]}`,
                borderRadius: 2,
                p: 2.5,
                bgcolor: poDocument ? alpha(accentGreen, 0.03) : '#fcfcfc',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <AttachFile sx={{ color: poDocument ? accentGreen : slate[400], fontSize: 28 }} />
              <Box sx={{ flex: 1 }}>
                {poDocument ? (
                  <>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: slate[800] }}>
                      Document attached
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: slate[400], wordBreak: 'break-all' }}>
                      {poDocument.split('/').pop()}
                    </Typography>
                  </>
                ) : (
                  <>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: slate[600] }}>
                      {isCreate ? 'Save the PO first, then upload the document' : 'No document attached yet'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: slate[400] }}>
                      PDF, image or any file from the buyer
                    </Typography>
                  </>
                )}
              </Box>
              {poDocument && (
                <>
                  <Tooltip title="Open document">
                    <IconButton size="small" component="a" href={poDocument} target="_blank" rel="noopener noreferrer"
                      sx={{ color: accentGreen, '&:hover': { bgcolor: alpha(accentGreen, 0.08) } }}>
                      <OpenInNew fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove document">
                    <IconButton size="small" onClick={handleRemoveDoc}
                      sx={{ color: slate[400], '&:hover': { color: 'error.main', bgcolor: alpha('#ef4444', 0.08) } }}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )}
              {!isCreate && (
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  disabled={uploading}
                  startIcon={<AttachFile />}
                  sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, borderColor: slate[300], color: slate[600], '&:hover': { borderColor: accentGreen, color: accentGreen } }}
                >
                  {uploading ? 'Uploading…' : poDocument ? 'Replace' : 'Upload'}
                  <input type="file" hidden onChange={handleUploadDoc} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
                </Button>
              )}
            </Box>
          </Box>
        </Collapse>
      </Box>

      {/* ── Bottom save bar ──────────────────────────────────────────────────── */}
      <Box
        sx={{
          mt: 4,
          mb: 2,
          p: 3,
          borderRadius: 3,
          bgcolor: slate[900],
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexWrap: 'wrap',
          boxShadow: `0 8px 32px ${alpha(slate[900], 0.2)}`,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#fff' }}>
            {isCreate ? 'Ready to create this PO?' : `Save changes to PO ${formData.po_number || '…'}?`}
          </Typography>
          <Typography sx={{ fontSize: '0.78rem', color: alpha('#fff', 0.45), mt: 0.3 }}>
            {lines.length} line{lines.length !== 1 ? 's' : ''} · make sure all item names are filled in
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => navigate('/buyer-pos')}
          sx={{
            borderColor: alpha('#fff', 0.2),
            color: alpha('#fff', 0.6),
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: 2,
            '&:hover': { borderColor: alpha('#fff', 0.4), color: '#fff', bgcolor: alpha('#fff', 0.05) },
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          size="large"
          startIcon={<Save />}
          onClick={() => handleSave()}
          disabled={saving || loading}
          sx={{
            py: 1.5,
            px: 4,
            borderRadius: 2,
            fontWeight: 900,
            fontSize: '1rem',
            textTransform: 'none',
            bgcolor: theme.palette.primary.main,
            boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.5)}`,
            '&:hover': {
              bgcolor: theme.palette.primary.dark,
              boxShadow: `0 6px 24px ${alpha(theme.palette.primary.main, 0.6)}`,
            },
          }}
        >
          {saving ? 'Saving…' : isCreate ? 'Create PO' : 'Save Changes'}
        </Button>
        {!isCreate && formData.pi ? (
          <Button
            variant="contained"
            size="large"
            startIcon={<ReceiptLong />}
            onClick={() => navigate(`/orders/pi/${formData.pi}/view`)}
            disabled={saving || loading}
            sx={{
              py: 1.5, px: 4, borderRadius: 2, fontWeight: 900, fontSize: '1rem', textTransform: 'none',
              bgcolor: '#0f766e', boxShadow: `0 4px 20px ${alpha('#0f766e', 0.5)}`,
              '&:hover': { bgcolor: '#0d6560', boxShadow: `0 6px 24px ${alpha('#0f766e', 0.6)}` },
            }}
          >
            View PI
          </Button>
        ) : (
          <Button
            variant="contained"
            size="large"
            startIcon={<ReceiptLong />}
            onClick={() => handleSave({ generatePI: true })}
            disabled={saving || loading}
            sx={{
              py: 1.5, px: 4, borderRadius: 2, fontWeight: 900, fontSize: '1rem', textTransform: 'none',
              bgcolor: '#0f766e', boxShadow: `0 4px 20px ${alpha('#0f766e', 0.5)}`,
              '&:hover': { bgcolor: '#0d6560', boxShadow: `0 6px 24px ${alpha('#0f766e', 0.6)}` },
            }}
          >
            {saving ? 'Saving…' : isCreate ? 'Create PO & Generate PI' : 'Save & Generate PI'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
