import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, MenuItem, Grid, Paper,
  IconButton, Chip, Autocomplete, CircularProgress, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Tooltip,
  Checkbox, FormControlLabel, Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack, Save, Print, Add, Delete, CheckCircle,
  AutoAwesome, LibraryAdd, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { ordersAPI } from '../services/api';
import { slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import AddTrimModal from '../components/trims/AddTrimModal';
import { formatTrimPropertyLabel, isGarmentSizeTrimProperty, isNumericTrimProperty } from '../components/trims/trimConstants';

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
const UNITS = ['MTRS', 'PCS', 'CONES', 'KG', 'SET', 'PAIR', 'ROLL', 'GROSS', 'GMS', 'CMS'];

// ── Empty row factories ───────────────────────────────────────────────────────
const emptyFabric = () => ({ material: '', color: '', gsm: '', roll_width: '', consumption_per_pc: '', unit: 'MTRS', total_consumption: '', remarks: '' });
const emptyTrim = () => ({
  trim: null, trim_name: '', category: '', color_variant: '', size_variant: '',
  property_values: {}, consumption_per_pc: '', unit: 'PCS', total_consumption: '', total_unit: '', remarks: '',
});

const formatTrimVariant = (row) => {
  const pv = row.property_values || {};
  const fromProps = Object.entries(pv)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  if (fromProps) return fromProps;
  return [row.color_variant, row.size_variant].filter(Boolean).join(' / ');
};

const initPropertyValues = (properties) => {
  const vals = {};
  (properties || []).forEach((p) => { if (p.name) vals[p.name] = ''; });
  return vals;
};

// ── Helper: compute total from consumption × qty ──────────────────────────────
const calcTotal = (consumption, qty) => {
  const c = parseFloat(consumption);
  const q = parseFloat(qty);
  if (isNaN(c) || isNaN(q) || q <= 0) return '';
  return (c * q).toFixed(4).replace(/\.?0+$/, '');
};

const rowQtyForColor = (color, colorQty, totalQty) => {
  if (color && colorQty[color] != null) return colorQty[color];
  const key = Object.keys(colorQty).find((k) => k.toLowerCase() === String(color || '').trim().toLowerCase());
  if (key) return colorQty[key];
  return totalQty;
};

const normalizeMatchKey = (value) => String(value || '').trim().toLowerCase();

const findTrimPropertyValue = (propertyValues, pattern) => {
  const entry = Object.entries(propertyValues || {}).find(([k]) => pattern.test(String(k).trim()));
  const raw = entry?.[1];
  return raw != null && String(raw).trim() ? String(raw).trim() : '';
};

const getTrimColorFromRow = (row) =>
  findTrimPropertyValue(row.property_values, /^colou?r$/i) || (row.color_variant?.trim() || '');

const getTrimGarmentSizeFromRow = (row) =>
  findTrimPropertyValue(row.property_values, /^garment\s*size$/i) || (row.size_variant?.trim() || '');

const piLineMatchesColor = (line, color) =>
  normalizeMatchKey(line.color) === normalizeMatchKey(color);

const sizesMatch = (a, b) => normalizeMatchKey(a) === normalizeMatchKey(b);

/** Qty from selected PI lines for a trim row's Color / Garment Size properties. */
const qtyFromPiForTrim = (row, piLines, colorQty) => {
  const color = getTrimColorFromRow(row);
  const garmentSize = getTrimGarmentSizeFromRow(row);
  const lines = piLines || [];

  if (color && garmentSize) {
    let qty = 0;
    lines.forEach((line) => {
      if (!piLineMatchesColor(line, color)) return;
      (line.size_breakdown || []).forEach(({ size: s, qty: q }) => {
        if (sizesMatch(s, garmentSize)) qty += parseInt(q, 10) || 0;
      });
    });
    if (qty > 0) return qty;
  }

  if (color) {
    const fromMap = rowQtyForColor(color, colorQty, 0);
    if (fromMap > 0) return fromMap;
    let qty = 0;
    lines.forEach((line) => {
      if (piLineMatchesColor(line, color)) qty += line.quantity_pcs || 0;
    });
    return qty;
  }

  if (garmentSize) {
    let qty = 0;
    lines.forEach((line) => {
      (line.size_breakdown || []).forEach(({ size: s, qty: q }) => {
        if (sizesMatch(s, garmentSize)) qty += parseInt(q, 10) || 0;
      });
    });
    return qty;
  }

  return null;
};

const rowQtyForTrim = (row, piLines, colorQty, totalQty) => {
  const color = getTrimColorFromRow(row);
  const garmentSize = getTrimGarmentSizeFromRow(row);
  if (!color && !garmentSize) return totalQty;
  const matched = qtyFromPiForTrim(row, piLines, colorQty);
  if (matched != null) return matched;
  return totalQty;
};

const calcRowTotal = (consumption, color, colorQty, totalQty) =>
  calcTotal(consumption, rowQtyForColor(color, colorQty, totalQty));

const fabricRowTotal = (row, colorQty, totalQty) =>
  calcRowTotal(row.consumption_per_pc, row.color, colorQty, totalQty);

const trimRowTotal = (row, piLines, colorQty, totalQty) =>
  calcTotal(row.consumption_per_pc, rowQtyForTrim(row, piLines, colorQty, totalQty));

// ── BOM table column helpers ───────────────────────────────────────────────────
const BOM_ROW_H = 46;
const BOM_ROW_TOTAL = BOM_ROW_H + 18;
const BOM_CELL_PAD_Y = (BOM_ROW_TOTAL - BOM_ROW_H) / 2;
const BOM_TABLE_MIN_W = 1420;

const FABRIC_COLS = [
  { label: 'Material *', width: 240, align: 'left' },
  { label: 'Color', width: 120, align: 'left' },
  { label: 'GSM', width: 90, align: 'right' },
  { label: 'Roll W (CMS)', width: 110, align: 'right' },
  { label: 'Cons./pc', width: 100, align: 'right' },
  { label: 'Unit', width: 90, align: 'center' },
  { label: 'Total', width: 110, align: 'right' },
  { label: 'Remarks', width: 170, align: 'left' },
  { label: '', width: 52, align: 'center' },
];

const TRIM_COLS = [
  { label: 'Trim & Properties', width: 480, align: 'left' },
  { label: 'Supplier', width: 140, align: 'left' },
  { label: 'Cons./pc', width: 105, align: 'right' },
  { label: 'Unit', width: 95, align: 'center' },
  { label: 'Total', width: 115, align: 'right' },
  { label: 'Tot. Unit', width: 95, align: 'center' },
  { label: 'Remarks', width: 160, align: 'left' },
  { label: '', width: 52, align: 'center' },
];

const TRIM_TABLE_MIN_W = 1280;
const TRIM_ROW_MIN_H = 108;
const TRIM_NAME_FIELD_H = 38;
const TRIM_PROP_FIELD_H = 34;

const bomFieldSx = (align = 'left') => ({
  width: '100%',
  m: 0,
  '& .MuiFormControl-root': { m: 0, width: '100%' },
  '& .MuiInputBase-root': {
    fontSize: '0.875rem',
    height: BOM_ROW_H,
    minHeight: BOM_ROW_H,
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  },
  '& .MuiInputBase-input': {
    py: '0 !important',
    px: '10px !important',
    height: `${BOM_ROW_H}px !important`,
    lineHeight: `${BOM_ROW_H}px !important`,
    boxSizing: 'border-box',
    textAlign: align,
  },
  '& .MuiOutlinedInput-input': {
    py: '0 !important',
    px: '10px !important',
    height: `${BOM_ROW_H}px !important`,
    lineHeight: `${BOM_ROW_H}px !important`,
  },
  '& .MuiSelect-select': {
    textAlign: align,
    py: '0 !important',
    px: '10px !important',
    height: `${BOM_ROW_H}px !important`,
    minHeight: `${BOM_ROW_H}px !important`,
    lineHeight: `${BOM_ROW_H}px !important`,
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
  },
  '& .MuiSelect-icon': {
    top: '50%',
    transform: 'translateY(-50%)',
  },
  '& .MuiAutocomplete-root': {
    m: 0,
    width: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiAutocomplete-inputRoot': {
    height: `${BOM_ROW_H}px !important`,
    minHeight: `${BOM_ROW_H}px !important`,
    py: '0 !important',
    flexWrap: 'nowrap',
    alignItems: 'center !important',
  },
  '& .MuiAutocomplete-input': {
    py: '0 !important',
    px: '0 !important',
  },
});

const bomTableBaseSx = (slateColor) => ({
  width: '100%',
  minWidth: BOM_TABLE_MIN_W,
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  '& .MuiTableBody-root .MuiTableRow-root': {
    height: BOM_ROW_TOTAL,
  },
  '& .MuiTableCell-root': {
    px: '10px !important',
    py: `${BOM_CELL_PAD_Y}px !important`,
    height: BOM_ROW_TOTAL,
    verticalAlign: 'middle !important',
    borderBottom: `1px solid ${slateColor[200]}`,
    borderRight: `1px solid ${slateColor[100]}`,
    '&:last-child': { borderRight: 'none' },
  },
  '& .MuiTableCell-sizeSmall': {
    px: '10px !important',
    py: `${BOM_CELL_PAD_Y}px !important`,
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    verticalAlign: 'middle !important',
    bgcolor: alpha(slateColor[900], 0.04),
    fontWeight: 700,
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
    height: 44,
    py: '0 !important',
    px: '10px !important',
  },
});

const bomCellInner = (align = 'left') => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
  minHeight: BOM_ROW_H,
  width: '100%',
});

const trimNameFieldSx = (align = 'left') => ({
  ...bomFieldSx(align),
  '& .MuiInputBase-root': {
    ...bomFieldSx(align)['& .MuiInputBase-root'],
    height: TRIM_NAME_FIELD_H,
    minHeight: TRIM_NAME_FIELD_H,
  },
  '& .MuiInputBase-input': {
    ...bomFieldSx(align)['& .MuiInputBase-input'],
    height: `${TRIM_NAME_FIELD_H}px !important`,
    lineHeight: `${TRIM_NAME_FIELD_H}px !important`,
  },
  '& .MuiOutlinedInput-input': {
    ...bomFieldSx(align)['& .MuiOutlinedInput-input'],
    height: `${TRIM_NAME_FIELD_H}px !important`,
    lineHeight: `${TRIM_NAME_FIELD_H}px !important`,
  },
  '& .MuiAutocomplete-inputRoot': {
    height: `${TRIM_NAME_FIELD_H}px !important`,
    minHeight: `${TRIM_NAME_FIELD_H}px !important`,
  },
});

const trimPropFieldSx = (align = 'left') => ({
  width: '100%',
  m: 0,
  '& .MuiFormControl-root': { m: 0, width: '100%' },
  '& .MuiInputBase-root': {
    fontSize: '0.8125rem',
    height: TRIM_PROP_FIELD_H,
    minHeight: TRIM_PROP_FIELD_H,
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    bgcolor: alpha('#6366f1', 0.03),
  },
  '& .MuiInputBase-input': {
    py: '0 !important',
    px: '8px !important',
    height: `${TRIM_PROP_FIELD_H}px !important`,
    lineHeight: `${TRIM_PROP_FIELD_H}px !important`,
    boxSizing: 'border-box',
    textAlign: align,
  },
  '& .MuiOutlinedInput-input': {
    py: '0 !important',
    px: '8px !important',
    height: `${TRIM_PROP_FIELD_H}px !important`,
    lineHeight: `${TRIM_PROP_FIELD_H}px !important`,
  },
  '& .MuiAutocomplete-inputRoot': {
    height: `${TRIM_PROP_FIELD_H}px !important`,
    minHeight: `${TRIM_PROP_FIELD_H}px !important`,
    py: '0 !important',
  },
});

const trimFieldLabelSx = {
  fontWeight: 700,
  fontSize: '0.65rem',
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  mb: 0.4,
  display: 'block',
  lineHeight: 1.2,
};

const trimBomTableSx = (slateColor) => ({
  ...bomTableBaseSx(slateColor),
  minWidth: TRIM_TABLE_MIN_W,
  '& .MuiTableBody-root .MuiTableRow-root': {
    height: 'auto',
    minHeight: TRIM_ROW_MIN_H,
    bgcolor: '#fff',
    transition: 'background-color 0.15s ease',
  },
  '& .MuiTableBody-root .trim-row--alt': {
    bgcolor: `${alpha('#0f766e', 0.07)} !important`,
    backgroundImage: `
      repeating-linear-gradient(
        -11deg,
        ${alpha('#0f766e', 0.045)} 0px,
        ${alpha('#0f766e', 0.045)} 1px,
        transparent 1px,
        transparent 7px
      ),
      radial-gradient(circle at 1px 1px, ${alpha('#0f766e', 0.04)} 1px, transparent 0)
    `,
    backgroundSize: 'auto, 16px 16px',
  },
  '& .MuiTableBody-root .trim-row--alt:hover': {
    bgcolor: `${alpha('#0f766e', 0.12)} !important`,
  },
  '& .MuiTableBody-root .MuiTableRow-root:hover:not(.trim-row--alt)': {
    bgcolor: `${alpha('#0f766e', 0.04)} !important`,
  },
  '& .MuiTableCell-root': {
    height: 'auto',
    minHeight: TRIM_ROW_MIN_H,
    py: '10px !important',
    verticalAlign: 'middle !important',
    bgcolor: 'inherit',
    borderBottom: `1px solid ${slateColor[200]}`,
  },
});

const BomColGroup = ({ cols }) => (
  <colgroup>
    {cols.map((col, i) => (
      <col key={i} style={{ width: col.width }} />
    ))}
  </colgroup>
);
const buildColorQty = (piLines) => {
  const map = {};
  (piLines || []).forEach((l) => {
    if (l.color) map[l.color] = (map[l.color] || 0) + (l.quantity_pcs || 0);
  });
  return map;
};

const sortSizes = (sizes) => [...sizes].sort((a, b) => {
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
});

const formatLineSizes = (line) => {
  const sb = line?.size_breakdown || [];
  if (!sb.length) return '';
  return sb
    .filter((s) => s.size && (parseInt(s.qty, 10) || 0))
    .map((s) => `${s.size}: ${Number(s.qty).toLocaleString()}`)
    .join(' · ');
};

const buildSizeTable = (piLines) => {
  const allSizes = new Set();
  const rows = [];
  (piLines || []).forEach((line) => {
    const sb = line.size_breakdown || [];
    if (!sb.length) return;
    const sizeMap = {};
    sb.forEach(({ size, qty }) => {
      if (!size) return;
      allSizes.add(size);
      sizeMap[size] = (sizeMap[size] || 0) + (parseInt(qty, 10) || 0);
    });
    rows.push({
      id: line.id,
      color: line.color || '—',
      itemName: line.item_name || '—',
      sizeMap,
      total: line.quantity_pcs || Object.values(sizeMap).reduce((s, v) => s + v, 0),
    });
  });
  return { sizes: sortSizes(allSizes), rows };
};

// ── Table cell sx ─────────────────────────────────────────────────────────────
const cellSx = { border: '1px solid #000', p: '4px 6px', fontSize: '8.5pt', fontFamily: 'inherit', verticalAlign: 'middle' };
const thSx   = { ...cellSx, fontWeight: 700, bgcolor: '#e8e8e8', textAlign: 'center' };

// ── Printed Indent Document ───────────────────────────────────────────────────
function IndentDocument({ pi, indent, fabricLines, trimLines, company, selectedLines }) {
  const piLines = selectedLines || pi?.lines || [];
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
            DATE - {formatDateDisplay(indent?.indent_date) === '—' ? '___' : formatDateDisplay(indent?.indent_date)}
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
            {['MATERIAL', 'COLOR / VARIANT', 'GSM', 'ROLL W (CMS)', 'CONSUM.', 'UNIT', 'TOT CON.', 'REMARKS'].map((h) => (
              <Box component="th" key={h} sx={thSx}>{h}</Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {fabricLines.filter((r) => r.material).map((row, i) => (
            <Box component="tr" key={`f${i}`}>
              <Box component="td" sx={{ ...cellSx, fontWeight: 600 }}>{row.material}</Box>
              <Box component="td" sx={cellSx}>{row.color}</Box>
              <Box component="td" sx={{ ...cellSx, textAlign: 'right' }}>{row.gsm ? `${row.gsm} GSM` : '—'}</Box>
              <Box component="td" sx={cellSx}>{row.roll_width ? `${row.roll_width} CMS` : '—'}</Box>
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
              <Box component="td" sx={cellSx}>{formatTrimVariant(row)}</Box>
              <Box component="td" sx={cellSx}>—</Box>
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
            {indent.carton_dimensions ? `  ${indent.carton_dimensions} (L*W*H CMS)` : ''}
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
  const [selectedLineIds, setSelectedLineIds] = useState([]);
  const [autoFilled,   setAutoFilled]  = useState(false);
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [trimModalTargetRow, setTrimModalTargetRow] = useState(null);
  const [sizeBreakdownOpen, setSizeBreakdownOpen] = useState(true);

  const activeLines = useMemo(() => {
    if (!pi?.lines) return [];
    if (!selectedLineIds.length) return pi.lines;
    return pi.lines.filter((l) => selectedLineIds.includes(l.id));
  }, [pi, selectedLineIds]);

  const selectedPiLines = useMemo(() => {
    if (!pi?.lines || !selectedLineIds.length) return [];
    return pi.lines.filter((l) => selectedLineIds.includes(l.id));
  }, [pi, selectedLineIds]);

  const colorQty = useMemo(() => buildColorQty(activeLines), [activeLines]);
  const totalQty = useMemo(() => Object.values(colorQty).reduce((s, v) => s + v, 0), [colorQty]);
  const sizeTable = useMemo(() => buildSizeTable(selectedPiLines), [selectedPiLines]);
  const sizeBreakdownSummary = useMemo(() => {
    if (!sizeTable.rows.length) return '';
    const totalPcs = sizeTable.rows.reduce((sum, row) => sum + row.total, 0);
    const lineLabel = `${sizeTable.rows.length} line${sizeTable.rows.length !== 1 ? 's' : ''}`;
    const sizeLabel = `${sizeTable.sizes.length} size${sizeTable.sizes.length !== 1 ? 's' : ''}`;
    return `${lineLabel} · ${sizeLabel} · ${totalPcs.toLocaleString()} pcs`;
  }, [sizeTable]);
  const piColorOptions = useMemo(() => Object.keys(colorQty), [colorQty]);
  const piSizeOptions = useMemo(() => {
    const sizes = new Set();
    activeLines.forEach((line) => {
      (line.size_breakdown || []).forEach(({ size }) => {
        if (size) sizes.add(size);
      });
    });
    return sortSizes(sizes);
  }, [activeLines]);

  const getTrimMaster = (row) => (row.trim ? trimsList.find((t) => t.id === row.trim) : null);

  const getTrimSchema = (row) => getTrimMaster(row)?.properties || [];

  // Recalculate totals when selected PI lines change
  useEffect(() => {
    setFabricLines((prev) => prev.map((row) => ({
      ...row,
      total_consumption: row.consumption_per_pc
        ? fabricRowTotal(row, colorQty, totalQty)
        : row.total_consumption,
    })));
    setTrimLines((prev) => prev.map((row) => ({
      ...row,
      total_consumption: row.consumption_per_pc
        ? trimRowTotal(row, activeLines, colorQty, totalQty)
        : row.total_consumption,
    })));
  }, [colorQty, totalQty, activeLines]);

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
            const piData = full.data;
            setPi(piData);
            setSelectedLineIds((piData.lines || []).map((l) => l.id));
            await tryAutoFillForLines(piData.lines || []);
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
          setTrimLines(data.trim_lines?.length ? data.trim_lines.map((r) => ({ ...emptyTrim(), ...r, property_values: r.property_values || {} })) : [emptyTrim()]);
          setSelectedLineIds(data.selected_pi_line_ids?.length ? data.selected_pi_line_ids : []);

          const piRes = await ordersAPI.getPI(data.pi);
          const piData = piRes.data;
          setPi(piData);
          if (!data.selected_pi_line_ids?.length) {
            setSelectedLineIds((piData.lines || []).map((l) => l.id));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew, piIdFromUrl]); // eslint-disable-line

  const tryAutoFillForLines = async (lines) => {
    if (!lines?.length) return;
    const names = [...new Set(lines.map((l) => l.item_name))];
    for (const name of names) {
      try {
        const res = await ordersAPI.getIndentTemplate(name);
        if (res.data) {
          const tmpl = res.data;
          if (tmpl.fabric_lines?.length) setFabricLines(tmpl.fabric_lines.map((r) => ({ ...emptyFabric(), ...r })));
          if (tmpl.trim_lines?.length) {
            setTrimLines(tmpl.trim_lines.map((r) => ({ ...emptyTrim(), ...r, property_values: r.property_values || {} })));
          }
          setAutoFilled(true);
          break;
        }
      } catch (_) { /* no template */ }
    }
  };

  const loadFullPi = async (piSummary) => {
    if (!piSummary?.id) return null;
    const res = await ordersAPI.getPI(piSummary.id);
    return res.data;
  };

  const handlePiSelect = async (piSummary) => {
    if (!piSummary) {
      setPi(null);
      setSelectedLineIds([]);
      return;
    }
    const piData = await loadFullPi(piSummary);
    setPi(piData);
    const lineIds = (piData?.lines || []).map((l) => l.id);
    setSelectedLineIds(lineIds);
    setAutoFilled(false);
    if (piData) await tryAutoFillForLines(piData.lines);
  };

  const toggleLine = (lineId) => {
    setSelectedLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId],
    );
  };

  const selectAllLines = () => setSelectedLineIds((pi?.lines || []).map((l) => l.id));
  const clearAllLines = () => setSelectedLineIds([]);

  // ── Fabric row helpers ─────────────────────────────────────────────────────
  const setFabricField = (i, field, value) => {
    setFabricLines((prev) => {
      const next = [...prev];
      const updated = { ...next[i], [field]: value };
      if (field === 'total_consumption' || field === 'remarks' || field === 'material' || field === 'unit' || field === 'gsm' || field === 'roll_width') {
        next[i] = updated;
      } else {
        updated.total_consumption = fabricRowTotal(updated, colorQty, totalQty);
        next[i] = updated;
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
      const updated = { ...next[i], [field]: value };
      if (field === 'consumption_per_pc' || field === 'color_variant' || field === 'size_variant') {
        updated.total_consumption = trimRowTotal(updated, activeLines, colorQty, totalQty);
      }
      next[i] = updated;
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
        property_values: initPropertyValues(trim?.properties),
        color_variant: '',
        size_variant: '',
      };
      if (next[i].consumption_per_pc) {
        next[i].total_consumption = trimRowTotal(next[i], activeLines, colorQty, totalQty);
      }
      return next;
    });
  };

  const setTrimPropertyValue = (i, propName, value) => {
    setTrimLines((prev) => {
      const next = [...prev];
      const row = { ...next[i], property_values: { ...(next[i].property_values || {}), [propName]: value } };
      row.total_consumption = trimRowTotal(row, activeLines, colorQty, totalQty);
      next[i] = row;
      return next;
    });
  };

  const openTrimModal = (rowIndex = null) => {
    setTrimModalTargetRow(rowIndex);
    setTrimModalOpen(true);
  };

  const handleTrimCreated = (newTrim) => {
    setTrimsList((prev) => [...prev, newTrim].sort((a, b) => a.name.localeCompare(b.name)));
    if (trimModalTargetRow != null) {
      selectTrimFromLibrary(trimModalTargetRow, newTrim);
    } else {
      setTrimLines((prev) => {
        const entry = {
          ...emptyTrim(),
          trim: newTrim.id,
          trim_name: newTrim.name,
          category: newTrim.category || '',
          unit: newTrim.default_unit || 'PCS',
          total_unit: newTrim.default_unit || 'PCS',
          property_values: initPropertyValues(newTrim.properties),
        };
        const blankIdx = prev.findIndex((r) => !r.trim_name.trim());
        if (blankIdx >= 0) {
          const next = [...prev];
          next[blankIdx] = entry;
          return next;
        }
        return [...prev, entry];
      });
    }
    setTrimModalTargetRow(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (nextStatus) => {
    if (!pi) { alert('Please select a PI first.'); return; }
    if (!selectedLineIds.length) { alert('Select at least one PI line item.'); return; }
    if (!indentNumber.trim()) { alert('Indent number is required.'); return; }

    setSaving(true);
    try {
      const payload = {
        pi: pi.id,
        selected_pi_line_ids: selectedLineIds,
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
  const bomTableSx = bomTableBaseSx(slate);
  const trimTableSx = trimBomTableSx(slate);
  const headCell = (align) => ({ textAlign: align, verticalAlign: 'middle' });
  const bodyCell = (align) => ({ textAlign: align, verticalAlign: 'middle' });

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  }

  const colorChips = Object.entries(colorQty);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
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

      {/* ── Indent Details (top, horizontal) ── */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Indent Details
        </Typography>
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} md={isNew ? 4 : 3}>
            {isNew ? (
              <Autocomplete
                options={piList}
                getOptionLabel={(o) => `${o.pi_number} — ${o.client_name || ''}`}
                isOptionEqualToValue={(a, b) => a?.id === b?.id}
                value={pi}
                onChange={(_, v) => handlePiSelect(v)}
                renderInput={(params) => <TextField {...params} size="small" label="Proforma Invoice *" sx={sxInput} />}
              />
            ) : (
              <Box sx={{ p: 1.25, bgcolor: alpha(slate[900], 0.04), borderRadius: 1.5, height: 40, display: 'flex', alignItems: 'center' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600, lineHeight: 1 }}>PI</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3 }}>{pi?.pi_number} — {pi?.client_name}</Typography>
                </Box>
              </Box>
            )}
          </Grid>
          <Grid item xs={12} sm={4} md={2}>
            <TextField size="small" fullWidth label="Indent Number *" value={indentNumber}
              onChange={(e) => setIndentNumber(e.target.value)} sx={sxInput} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField size="small" fullWidth label="Date" type="date" value={indentDate}
              onChange={(e) => setIndentDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={sxInput} />
          </Grid>
          <Grid item xs={6} sm={4} md={2}>
            <TextField size="small" fullWidth select label="Status" value={status}
              onChange={(e) => setStatus(e.target.value)} sx={sxInput}>
              <MenuItem value="DRAFT">Draft</MenuItem>
              <MenuItem value="CONFIRMED">Confirmed</MenuItem>
            </TextField>
          </Grid>
          {pi && (
            <Grid item xs={12} sm={4} md={3}>
              <Box sx={{ pb: 0.5 }}>
                <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600, mb: 0.25 }}>Total Qty</Typography>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>{totalQty.toLocaleString()} pcs</Typography>
                {autoFilled && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                    <AutoAwesome sx={{ fontSize: 12, color: '#f59e0b' }} />
                    <Typography sx={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600 }}>Auto-filled</Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          )}
        </Grid>

        {/* PI line items + size breakdown */}
        {pi?.lines?.length > 0 && (
          <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${slate[200]}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                PI Line Items ({selectedLineIds.length}/{pi.lines.length})
              </Typography>
              <Button size="small" onClick={selectAllLines} sx={{ textTransform: 'none', fontWeight: 700, minWidth: 0, py: 0 }}>All</Button>
              <Button size="small" onClick={clearAllLines} sx={{ textTransform: 'none', fontWeight: 700, minWidth: 0, py: 0 }}>None</Button>
              {colorChips.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                  {colorChips.map(([color, qty]) => (
                    <Chip key={color} label={`${color}: ${qty.toLocaleString()}`} size="small"
                      sx={{ fontWeight: 700, fontSize: '0.68rem', bgcolor: alpha('#6366f1', 0.1), color: '#4338ca' }} />
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                lg: sizeTable.rows.length > 0 ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr',
              },
              gap: 1.5,
              alignItems: 'start',
            }}>
              {/* Line selection */}
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: '1fr' },
                gap: 1,
                maxHeight: { lg: sizeTable.rows.length > 0 ? 320 : 'none' },
                overflowY: { lg: sizeTable.rows.length > 0 ? 'auto' : 'visible' },
                pr: { lg: sizeTable.rows.length > 0 ? 0.5 : 0 },
              }}>
                {pi.lines.map((line) => {
                  const selected = selectedLineIds.includes(line.id);
                  const sizeText = formatLineSizes(line);
                  return (
                    <Box
                      key={line.id}
                      onClick={() => toggleLine(line.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.75,
                        px: 1.25,
                        py: 1,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        minWidth: 0,
                        border: `1px solid ${selected ? '#6366f1' : slate[300]}`,
                        bgcolor: selected ? alpha('#6366f1', 0.08) : 'transparent',
                        '&:hover': { bgcolor: alpha('#6366f1', 0.05) },
                      }}
                    >
                      <Checkbox size="small" checked={selected} sx={{ p: 0.25, mt: 0.15 }} tabIndex={-1} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {line.item_name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: slate[500], mt: 0.25, lineHeight: 1.35 }}>
                          {[
                            line.color,
                            line.quantity_pcs != null ? `${line.quantity_pcs.toLocaleString()} pcs` : null,
                            line.item_code,
                          ].filter(Boolean).join(' · ')}
                        </Typography>
                        {sizeText && (
                          <Typography sx={{ fontSize: '0.68rem', color: slate[600], mt: 0.5, lineHeight: 1.4, fontWeight: 600 }}>
                            Sizes: {sizeText}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Size breakdown — collapsible */}
              {sizeTable.rows.length > 0 && (
                <Box sx={{
                  border: `1px solid ${slate[200]}`,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  bgcolor: '#fff',
                  minWidth: 0,
                }}>
                  <Box
                    onClick={() => setSizeBreakdownOpen((v) => !v)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      px: 1.25,
                      py: 0.85,
                      bgcolor: slate[50],
                      borderBottom: sizeBreakdownOpen ? `1px solid ${slate[200]}` : 'none',
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': { bgcolor: alpha('#6366f1', 0.04) },
                    }}
                  >
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: slate[700] }}>
                      Size breakdown
                    </Typography>
                    {!sizeBreakdownOpen && sizeBreakdownSummary && (
                      <Typography sx={{ fontSize: '0.68rem', color: slate[500], fontWeight: 600 }}>
                        {sizeBreakdownSummary}
                      </Typography>
                    )}
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); setSizeBreakdownOpen((v) => !v); }}
                      sx={{ ml: 'auto', color: slate[500] }}
                      aria-label={sizeBreakdownOpen ? 'Minimise size breakdown' : 'Expand size breakdown'}
                    >
                      {sizeBreakdownOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </IconButton>
                  </Box>

                  <Collapse in={sizeBreakdownOpen}>
                    <TableContainer sx={{ maxHeight: 280, overflow: 'auto' }}>
                      <Table size="small" stickyHeader sx={{ minWidth: 360 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              whiteSpace: 'nowrap',
                              minWidth: 100,
                              position: 'sticky',
                              left: 0,
                              zIndex: 3,
                              bgcolor: alpha('#6366f1', 0.1),
                              boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
                            }}>
                              Colour
                            </TableCell>
                            {sizeTable.sizes.map((size) => (
                              <TableCell
                                key={size}
                                align="center"
                                sx={{ fontWeight: 800, fontSize: '0.68rem', minWidth: 40, px: 0.75, py: 0.75, bgcolor: alpha('#6366f1', 0.06) }}
                              >
                                {size}
                              </TableCell>
                            ))}
                            <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.68rem', minWidth: 48, px: 0.75, bgcolor: alpha('#6366f1', 0.06) }}>
                              Total
                            </TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sizeTable.rows.map((row) => (
                            <TableRow key={row.id} hover>
                              <TableCell sx={{
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                position: 'sticky',
                                left: 0,
                                zIndex: 1,
                                bgcolor: '#fff',
                                boxShadow: '2px 0 4px rgba(0,0,0,0.04)',
                                minWidth: 100,
                                py: 0.75,
                              }}>
                                <Typography sx={{ fontSize: 'inherit', fontWeight: 'inherit', lineHeight: 1.3 }}>
                                  {row.color}
                                </Typography>
                                <Typography sx={{ fontSize: '0.62rem', color: slate[500], fontWeight: 500, lineHeight: 1.3, mt: 0.15 }}>
                                  {row.itemName}
                                </Typography>
                              </TableCell>
                              {sizeTable.sizes.map((size) => (
                                <TableCell key={size} align="center" sx={{ fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', px: 0.75, py: 0.75 }}>
                                  {row.sizeMap[size] ? row.sizeMap[size].toLocaleString() : '—'}
                                </TableCell>
                              ))}
                              <TableCell align="center" sx={{ fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', px: 0.75, py: 0.75 }}>
                                {row.total.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: alpha(slate[900], 0.03) }}>
                            <TableCell sx={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              position: 'sticky',
                              left: 0,
                              zIndex: 1,
                              bgcolor: alpha(slate[900], 0.03),
                              boxShadow: '2px 0 4px rgba(0,0,0,0.04)',
                              py: 0.75,
                            }}>
                              Total
                            </TableCell>
                            {sizeTable.sizes.map((size) => (
                              <TableCell key={size} align="center" sx={{ fontSize: '0.68rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', px: 0.75, py: 0.75 }}>
                                {sizeTable.rows.reduce((sum, row) => sum + (row.sizeMap[size] || 0), 0).toLocaleString() || '—'}
                              </TableCell>
                            ))}
                            <TableCell align="center" sx={{ fontSize: '0.68rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', px: 0.75, py: 0.75 }}>
                              {sizeTable.rows.reduce((sum, row) => sum + row.total, 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Collapse>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Paper>

      {totalQty > 0 && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5 }}>
          Totals auto-calculate from consumption × PI qty. Trims with Color use only the matching PI colour (e.g. Yellow buttons → Yellow pcs). Use Garment Size (not Size) when qty should follow PI size breakdown.
        </Typography>
      )}

      {/* ── FABRIC ── */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', flex: 1 }}>Fabric</Typography>
              <Button size="small" startIcon={<Add />} onClick={addFabricRow}
                sx={{ fontWeight: 700, textTransform: 'none' }}>Add Row</Button>
            </Box>
            <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
              <Table size="small" sx={bomTableSx}>
                <BomColGroup cols={FABRIC_COLS} />
                <TableHead>
                  <TableRow>
                    {FABRIC_COLS.map((col) => (
                      <TableCell key={col.label || 'actions'} sx={headCell(col.align)}>{col.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fabricLines.map((row, i) => (
                    <TableRow key={i} hover>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <TextField size="small" fullWidth value={row.material}
                            onChange={(e) => setFabricField(i, 'material', e.target.value)}
                            placeholder="e.g. 80% Polyester 20% Cotton" sx={bomFieldSx('left')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <Autocomplete freeSolo options={Object.keys(colorQty)} value={row.color}
                            onChange={(_, v) => setFabricField(i, 'color', v || '')}
                            onInputChange={(_, v) => setFabricField(i, 'color', v)}
                            sx={{ m: 0, width: '100%' }}
                            renderInput={(params) => <TextField {...params} size="small" fullWidth placeholder="Color" sx={bomFieldSx('left')} />} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('right')}>
                        <Box sx={bomCellInner('right')}>
                          <TextField size="small" fullWidth type="number" value={row.gsm || ''}
                            onChange={(e) => setFabricField(i, 'gsm', e.target.value)}
                            placeholder="245" inputProps={{ step: '0.01', min: '0' }}
                            InputProps={{ endAdornment: <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', pr: 0.5, whiteSpace: 'nowrap' }}>GSM</Typography> }}
                            sx={bomFieldSx('right')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('right')}>
                        <Box sx={bomCellInner('right')}>
                          <TextField size="small" fullWidth type="number" value={row.roll_width || ''}
                            onChange={(e) => setFabricField(i, 'roll_width', e.target.value)}
                            placeholder="150" inputProps={{ step: '1', min: '0' }}
                            InputProps={{ endAdornment: <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', pr: 0.5, whiteSpace: 'nowrap' }}>CMS</Typography> }}
                            sx={bomFieldSx('right')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('right')}>
                        <Box sx={bomCellInner('right')}>
                          <TextField size="small" fullWidth type="number" value={row.consumption_per_pc}
                            onChange={(e) => setFabricField(i, 'consumption_per_pc', e.target.value)}
                            inputProps={{ step: '0.0001', min: '0' }} sx={bomFieldSx('right')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('center')}>
                        <Box sx={bomCellInner('center')}>
                          <TextField size="small" fullWidth select value={row.unit}
                            onChange={(e) => setFabricField(i, 'unit', e.target.value)} sx={bomFieldSx('center')}>
                            {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                          </TextField>
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('right')}>
                        <Box sx={bomCellInner('right')}>
                          <TextField size="small" fullWidth value={row.total_consumption}
                            onChange={(e) => setFabricField(i, 'total_consumption', e.target.value)}
                            placeholder={totalQty ? 'Auto' : '—'}
                            sx={{
                              ...bomFieldSx('right'),
                              '& .MuiInputBase-root': { ...bomFieldSx('right')['& .MuiInputBase-root'], bgcolor: alpha('#6366f1', 0.06) },
                              '& input': { fontWeight: 700 },
                            }} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <TextField size="small" fullWidth value={row.remarks}
                            onChange={(e) => setFabricField(i, 'remarks', e.target.value)}
                            placeholder="e.g. in stock" sx={bomFieldSx('left')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('center')}>
                        <Box sx={bomCellInner('center')}>
                          <IconButton size="small" color="error" onClick={() => removeFabricRow(i)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Paper>

          {/* ── TRIMS & ACCESSORIES ── */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Box sx={{ flex: 1, minWidth: 160 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>Trims & Accessories</Typography>
              </Box>
              <Button size="small" variant="outlined" startIcon={<LibraryAdd />} onClick={() => openTrimModal(null)}
                sx={{ fontWeight: 700, textTransform: 'none', borderColor: '#7c3aed', color: '#7c3aed' }}>
                New Trim
              </Button>
              <Button size="small" variant="contained" startIcon={<Add />} onClick={addTrimRow}
                sx={{ fontWeight: 700, textTransform: 'none' }}>
                Add Row
              </Button>
            </Box>

            {/* Carton Box */}
            <Box sx={{ mb: 2, pb: 2, borderBottom: `1px solid ${slate[200]}` }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1.5, color: 'text.secondary' }}>Carton Box</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4} md={3}>
                  <TextField size="small" fullWidth label="Pcs/Box" type="number" value={pcsPerCarton}
                    onChange={(e) => setPcsPerCarton(e.target.value)} sx={sxInput} />
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <TextField size="small" fullWidth label="PLY" value={cartonPly}
                    onChange={(e) => setCartonPly(e.target.value)} placeholder="5 PLY" sx={sxInput} />
                </Grid>
                <Grid item xs={12} sm={4} md={3}>
                  <TextField size="small" fullWidth label="Dimensions (CMS)" value={cartonDims}
                    onChange={(e) => setCartonDims(e.target.value)} placeholder="L × W × H in CMS"
                    helperText="Length × Width × Height in centimetres"
                    FormHelperTextProps={{ sx: { mx: 0, fontSize: '0.68rem' } }}
                    sx={sxInput} />
                </Grid>
              </Grid>
            </Box>

            <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
              <Table size="small" sx={trimTableSx}>
                <BomColGroup cols={TRIM_COLS} />
                <TableHead>
                  <TableRow>
                    {TRIM_COLS.map((col) => (
                      <TableCell key={col.label || 'actions'} sx={headCell(col.align)}>{col.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {trimLines.map((row, i) => {
                    const schema = getTrimSchema(row);
                    const trimMaster = getTrimMaster(row);
                    return (
                      <TableRow key={i} hover className={i % 2 === 1 ? 'trim-row--alt' : undefined}>
                        <TableCell sx={{ ...bodyCell('left'), verticalAlign: 'top' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%', py: 0.25 }}>
                            {/* Row 1 — Trim name */}
                            <Box>
                              <Typography sx={trimFieldLabelSx}>Trim Name *</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Autocomplete
                                  freeSolo
                                  options={trimsList}
                                  getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                                  inputValue={row.trim_name}
                                  onInputChange={(_, v) => setTrimField(i, 'trim_name', v)}
                                  onChange={(_, v) => { if (v && typeof v === 'object') selectTrimFromLibrary(i, v); }}
                                  sx={{ flex: 1, m: 0, minWidth: 0 }}
                                  renderOption={(props, o) => (
                                    <Box component="li" {...props}>
                                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{o.name}</Typography>
                                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                                        {o.category && (
                                          <Chip label={o.category} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }} />
                                        )}
                                        {o.supplier_name && (
                                          <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{o.supplier_name}</Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  )}
                                  renderInput={(params) => (
                                    <TextField {...params} size="small" fullWidth placeholder="Search trim library or type name" sx={trimNameFieldSx('left')} />
                                  )}
                                />
                                <Tooltip title="Create new trim">
                                  <IconButton size="small" onClick={() => openTrimModal(i)} sx={{ color: '#7c3aed', flexShrink: 0 }}>
                                    <LibraryAdd fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                              {(trimMaster?.category || row.category) && (
                                <Chip
                                  label={trimMaster?.category || row.category}
                                  size="small"
                                  sx={{ mt: 0.75, height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: alpha('#6366f1', 0.1), color: '#4338ca' }}
                                />
                              )}
                            </Box>

                            {/* Row 2 — Properties */}
                            <Box sx={{
                              pt: 1.25,
                              borderTop: `1px dashed ${slate[200]}`,
                            }}>
                              <Typography sx={trimFieldLabelSx}>Properties</Typography>
                              {schema.length > 0 ? (
                                <Box sx={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 1,
                                  alignItems: 'flex-start',
                                }}>
                                  {schema.map((prop) => {
                                    const isColorProp = /^colou?r$/i.test(String(prop.name).trim());
                                    const isGarmentSizeProp = isGarmentSizeTrimProperty(prop.name);
                                    const isNumericProp = isNumericTrimProperty(prop.name);
                                    const propValue = row.property_values?.[prop.name] || '';
                                    return (
                                    <Box
                                      key={prop.name}
                                      sx={{
                                        flex: '1 1 130px',
                                        minWidth: 110,
                                        maxWidth: 200,
                                      }}
                                    >
                                      <Typography sx={{
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        color: slate[600],
                                        mb: 0.35,
                                        lineHeight: 1.2,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                      title={formatTrimPropertyLabel(prop)}
                                      >
                                        {prop.name}{prop.unit ? ` (${prop.unit})` : ''}
                                      </Typography>
                                      {isColorProp ? (
                                        <Autocomplete
                                          freeSolo
                                          options={piColorOptions}
                                          value={propValue}
                                          onChange={(_, v) => setTrimPropertyValue(i, prop.name, v || '')}
                                          onInputChange={(_, v) => setTrimPropertyValue(i, prop.name, v)}
                                          sx={{ m: 0, width: '100%' }}
                                          renderInput={(params) => (
                                            <TextField {...params} size="small" fullWidth placeholder="From PI colours" sx={trimPropFieldSx('left')} />
                                          )}
                                        />
                                      ) : isGarmentSizeProp ? (
                                        <Autocomplete
                                          freeSolo
                                          options={piSizeOptions}
                                          value={propValue}
                                          onChange={(_, v) => setTrimPropertyValue(i, prop.name, v || '')}
                                          onInputChange={(_, v) => setTrimPropertyValue(i, prop.name, v)}
                                          sx={{ m: 0, width: '100%' }}
                                          renderInput={(params) => (
                                            <TextField {...params} size="small" fullWidth placeholder="PI garment size (S, M, L…)" sx={trimPropFieldSx('left')} />
                                          )}
                                        />
                                      ) : (
                                      <TextField
                                        size="small"
                                        fullWidth
                                        type={isNumericProp ? 'number' : 'text'}
                                        placeholder={isNumericProp ? '0' : 'Enter value'}
                                        value={propValue}
                                        onChange={(e) => setTrimPropertyValue(i, prop.name, e.target.value)}
                                        inputProps={isNumericProp ? { min: 0, step: /^gsm$/i.test(String(prop.name).trim()) ? '0.01' : '1' } : undefined}
                                        sx={trimPropFieldSx(isNumericProp ? 'right' : 'left')}
                                      />
                                      )}
                                    </Box>
                                    );
                                  })}
                                </Box>
                              ) : (
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                  <Box sx={{ flex: '1 1 130px', minWidth: 110, maxWidth: 200 }}>
                                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: slate[600], mb: 0.35 }}>Color</Typography>
                                    <Autocomplete freeSolo options={Object.keys(colorQty)} value={row.color_variant}
                                      onChange={(_, v) => setTrimField(i, 'color_variant', v || '')}
                                      onInputChange={(_, v) => setTrimField(i, 'color_variant', v)}
                                      sx={{ m: 0, width: '100%' }}
                                      renderInput={(params) => (
                                        <TextField {...params} size="small" fullWidth placeholder="Color" sx={trimPropFieldSx('left')} />
                                      )} />
                                  </Box>
                                  <Box sx={{ flex: '1 1 130px', minWidth: 110, maxWidth: 200 }}>
                                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: slate[600], mb: 0.35 }}>Garment Size</Typography>
                                    <Autocomplete freeSolo options={piSizeOptions} value={row.size_variant}
                                      onChange={(_, v) => setTrimField(i, 'size_variant', v || '')}
                                      onInputChange={(_, v) => setTrimField(i, 'size_variant', v)}
                                      sx={{ m: 0, width: '100%' }}
                                      renderInput={(params) => (
                                        <TextField {...params} size="small" fullWidth placeholder="PI garment size" sx={trimPropFieldSx('left')} />
                                      )} />
                                  </Box>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('left')}>
                          <Box sx={bomCellInner('left')}>
                            {trimMaster?.supplier_name ? (
                              <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 600, width: '100%' }}
                                title={`${trimMaster.supplier_name}${trimMaster.supplier_country ? ` · ${trimMaster.supplier_country}` : ''}`}>
                                {trimMaster.supplier_name}
                                {trimMaster.supplier_country ? ` · ${trimMaster.supplier_country}` : ''}
                              </Typography>
                            ) : (
                              <Typography sx={{ fontSize: '0.875rem', color: 'text.disabled' }}>—</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('right')}>
                          <Box sx={bomCellInner('right')}>
                            <TextField size="small" fullWidth type="number" value={row.consumption_per_pc}
                              onChange={(e) => setTrimField(i, 'consumption_per_pc', e.target.value)}
                              inputProps={{ step: '0.0001', min: '0' }} sx={bomFieldSx('right')} />
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('center')}>
                          <Box sx={bomCellInner('center')}>
                            <TextField size="small" fullWidth select value={row.unit}
                              onChange={(e) => setTrimField(i, 'unit', e.target.value)} sx={bomFieldSx('center')}>
                              {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                            </TextField>
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('right')}>
                          <Box sx={bomCellInner('right')}>
                            <TextField size="small" fullWidth value={row.total_consumption}
                              onChange={(e) => setTrimField(i, 'total_consumption', e.target.value)}
                              sx={{
                                ...bomFieldSx('right'),
                                '& .MuiInputBase-root': { ...bomFieldSx('right')['& .MuiInputBase-root'], bgcolor: alpha('#6366f1', 0.06) },
                                '& input': { fontWeight: 700 },
                              }} />
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('center')}>
                          <Box sx={bomCellInner('center')}>
                            <TextField size="small" fullWidth select value={row.total_unit || row.unit}
                              onChange={(e) => setTrimField(i, 'total_unit', e.target.value)} sx={bomFieldSx('center')}>
                              {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                            </TextField>
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('left')}>
                          <Box sx={bomCellInner('left')}>
                            <TextField size="small" fullWidth value={row.remarks}
                              onChange={(e) => setTrimField(i, 'remarks', e.target.value)}
                              placeholder="in stock" sx={bomFieldSx('left')} />
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('center')}>
                          <Box sx={bomCellInner('center')}>
                            <IconButton size="small" color="error" onClick={() => removeTrimRow(i)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          </Paper>

      {/* ── Sign-off (last section) ── */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', mb: 2, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Sign-off
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <TextField size="small" fullWidth label="Prepared By" value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField size="small" fullWidth label="Received By" value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField size="small" fullWidth label="Approved By" value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)} sx={sxInput} />
          </Grid>
          <Grid item xs={12}>
            <TextField size="small" fullWidth label="Notes" multiline minRows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)} sx={sxInput} />
          </Grid>
        </Grid>
      </Paper>

      <AddTrimModal
        open={trimModalOpen}
        onClose={() => { setTrimModalOpen(false); setTrimModalTargetRow(null); }}
        onSaved={handleTrimCreated}
      />

      {/* ── Hidden print root ── */}
      <Box id="indent-print-root" sx={{ display: 'none' }}>
        <IndentDocument
          pi={pi}
          selectedLines={activeLines}
          indent={{ indent_number: indentNumber, indent_date: indentDate, pcs_per_carton: pcsPerCarton, carton_ply: cartonPly, carton_dimensions: cartonDims, prepared_by: preparedBy, received_by: receivedBy, approved_by: approvedBy }}
          fabricLines={fabricLines}
          trimLines={trimLines}
          company={company}
        />
      </Box>
    </Box>
  );
}
