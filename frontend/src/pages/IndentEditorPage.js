import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, MenuItem, Grid, Paper,
  IconButton, Chip, Autocomplete, CircularProgress, Divider,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Tooltip,
  Checkbox, FormControlLabel, Collapse, Snackbar, Alert, Popper,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack, Save, Print, Add, Delete, CheckCircle,
  AutoAwesome, LibraryAdd, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { hasModuleAccess } from '../config/permissions';
import { ordersAPI, inventoryAPI, suppliersAPI } from '../services/api';
import { slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { normalizeGarmentSize, sortGarmentSizes } from '../utils/normalizeGarmentSize';
import { extractGsmFromFabricComposition, enrichFabricRowGsm } from '../utils/extractFabricGsm';
import {
  applyInventoryStockRemark,
  findMatchingInventoryItem,
  IN_STOCK_REMARK,
  isInStockRemark,
} from '../utils/matchInventoryStock';
import AddTrimModal from '../components/trims/AddTrimModal';
import SupplierAutocomplete from '../components/suppliers/SupplierAutocomplete';
import {
  formatTrimPropertyLabel,
  formatTrimVariantDisplay,
  isGarmentSizeTrimProperty,
  isNumericTrimProperty,
  normalizeTrimPropertyName,
  TRIM_PROPERTY_NAME_SUGGESTIONS,
  TRIM_UNIT_OPTIONS,
} from '../components/trims/trimConstants';

// ── Print styles ─────────────────────────────────────────────────────────────
const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #indent-print-root,
  #indent-print-root * { visibility: visible !important; }
  #indent-print-root {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    display: block !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  @page { margin: 12mm; size: A4; }
}
@media screen {
  #indent-print-root { display: none !important; }
}
`;

// ── Unit helpers ──────────────────────────────────────────────────────────────
const UNITS = ['MTRS', 'PCS', 'CONES', 'KG', 'SET', 'PAIR', 'ROLL', 'GROSS', 'GMS', 'CMS'];

// ── Empty row factories ───────────────────────────────────────────────────────
const emptyFabric = () => ({
  material: '', color: '', gsm: '', roll_width: '', consumption_per_pc: '', unit: 'MTRS',
  total_consumption: '', remarks: '', total_manual: false,
});
const emptyTrimPart = (label = '') => ({
  label, consumption_per_pc: '', unit: 'MTRS', total_consumption: '', total_unit: '', total_manual: false,
});
const emptyTrim = () => ({
  trim: null, trim_name: '', category: '', color_variant: '', size_variant: '',
  property_values: {}, consumption_per_pc: '', unit: 'PCS', total_consumption: '', total_unit: '', remarks: '',
  supplier: null, supplier_name: '', supplier_country: '',
  parts: [], total_manual: false,
});

/** Normalize Hook/Loop (multi-part) payload from API so edit always restores rows. */
const normalizeTrimParts = (raw) => {
  let parts = raw;
  if (typeof parts === 'string') {
    try { parts = JSON.parse(parts); } catch { return []; }
  }
  if (!Array.isArray(parts) || !parts.length) return [];
  return parts.map((p, idx) => ({
    label: p?.label != null && String(p.label).trim() ? String(p.label) : (idx === 0 ? 'Hook' : idx === 1 ? 'Loop' : `Part ${idx + 1}`),
    consumption_per_pc: p?.consumption_per_pc != null && p.consumption_per_pc !== '' ? String(p.consumption_per_pc) : '',
    unit: p?.unit || 'MTRS',
    total_consumption: p?.total_consumption != null && p.total_consumption !== '' ? String(p.total_consumption) : '',
    total_unit: p?.total_unit || p?.unit || 'MTRS',
    // Persist saved part totals on edit — don't auto-overwrite until Cons./pc changes.
    total_manual: p?.total_consumption != null && p.total_consumption !== '',
  }));
};

const mapApiTrimLine = (r) => ({
  ...emptyTrim(),
  ...r,
  property_values: r.property_values || {},
  parts: normalizeTrimParts(r.parts),
  supplier: r.supplier ?? null,
  supplier_name: r.supplier_name || '',
  supplier_country: r.supplier_country || '',
  consumption_per_pc: r.consumption_per_pc != null && r.consumption_per_pc !== '' ? String(r.consumption_per_pc) : '',
  total_consumption: r.total_consumption != null && r.total_consumption !== '' ? String(r.total_consumption) : '',
  // Keep API/saved totals when reopening an indent (PI qty effect must not overwrite).
  total_manual: true,
});

const asInventoryList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const fmtStockQty = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return '';
  const rounded = Math.round(n * 1e4) / 1e4;
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 4, minimumFractionDigits: 0 });
};

/** Compact clickable "In stock / Not in stock" indicator, replacing free-text remarks. */
const InStockToggle = ({ checked, onToggle, stockQty, stockUnit }) => {
  const qtyLabel = checked && stockQty != null && String(stockQty).trim() !== ''
    ? `${fmtStockQty(stockQty)}${stockUnit ? ` ${String(stockUnit).toUpperCase()}` : ''}`
    : '';
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.35, minWidth: 0 }}>
      <Box
        onClick={onToggle}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.6,
          px: 1,
          py: 0.5,
          borderRadius: 5,
          cursor: 'pointer',
          userSelect: 'none',
          bgcolor: checked ? alpha('#16a34a', 0.1) : alpha('#94a3b8', 0.14),
          border: `1px solid ${checked ? alpha('#16a34a', 0.35) : alpha('#94a3b8', 0.35)}`,
          transition: 'background-color 0.15s ease',
        }}
      >
        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: checked ? '#16a34a' : '#94a3b8', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: checked ? '#15803d' : '#64748b', whiteSpace: 'nowrap' }}>
          {checked ? 'In stock' : 'Not in stock'}
        </Typography>
      </Box>
      {qtyLabel ? (
        <Typography
          className="font-numeric"
          sx={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: '#15803d',
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            fontVariantNumeric: 'tabular-nums',
          }}
          title="Available inventory quantity"
        >
          {qtyLabel}
        </Typography>
      ) : null}
    </Box>
  );
};

/** Trim-name Autocomplete filter — appends a "Create '<typed name>'" option when there's no match. */
const filterTrimNameOptions = (options, { inputValue }) => {
  const input = inputValue.trim();
  const filtered = !input
    ? options
    : options.filter((o) => o.name.toLowerCase().includes(input.toLowerCase()));
  if (input && !options.some((o) => o.name.toLowerCase() === input.toLowerCase())) {
    filtered.push({ __create: true, name: input });
  }
  return filtered;
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
  if (isNaN(c) || isNaN(q) || q <= 0) return '0';
  return (c * q).toFixed(4).replace(/\.?0+$/, '');
};

const toApiDecimal = (value) => {
  if (value === '' || value == null) return 0;
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
};

const hasTrimParts = (row) => Array.isArray(row?.parts) && row.parts.length > 0;

/** Combined consumption/total across parts — kept on the row for backward-compat consumers. */
const sumTrimParts = (parts) => {
  let consumption = 0;
  let total = 0;
  let unit = '';
  let totalUnit = '';
  (parts || []).forEach((p) => {
    consumption += parseFloat(p.consumption_per_pc) || 0;
    total += parseFloat(p.total_consumption) || 0;
    unit = unit || p.unit || '';
    totalUnit = totalUnit || p.total_unit || p.unit || '';
  });
  return {
    consumption_per_pc: consumption ? String(consumption) : '',
    total_consumption: total ? total.toFixed(4).replace(/\.?0+$/, '') : '',
    unit,
    total_unit: totalUnit,
  };
};

const serializeFabricLine = (row) => ({
  id: row.id,
  material: row.material,
  color: row.color || '',
  gsm: row.gsm || '',
  roll_width: row.roll_width || '',
  consumption_per_pc: toApiDecimal(row.consumption_per_pc),
  unit: row.unit || 'MTRS',
  total_consumption: toApiDecimal(row.total_consumption),
  remarks: row.remarks || '',
});

const serializeTrimLine = (row) => ({
  id: row.id,
  trim: row.trim || null,
  trim_name: row.trim_name,
  category: row.category || '',
  color_variant: row.color_variant || '',
  size_variant: row.size_variant || '',
  property_values: row.property_values || {},
  consumption_per_pc: toApiDecimal(row.consumption_per_pc),
  unit: row.unit || 'PCS',
  total_consumption: toApiDecimal(row.total_consumption),
  total_unit: row.total_unit || row.unit || '',
  remarks: row.remarks || '',
  supplier: row.supplier || null,
  parts: (row.parts || []).map((p) => ({
    label: p.label || '',
    consumption_per_pc: toApiDecimal(p.consumption_per_pc),
    unit: p.unit || 'MTRS',
    total_consumption: toApiDecimal(p.total_consumption),
    total_unit: p.total_unit || p.unit || '',
  })),
});

const rowQtyForColor = (color, colorQty, totalQty) => {
  if (color && colorQty[color] != null) return colorQty[color];
  const key = Object.keys(colorQty).find((k) => k.toLowerCase() === String(color || '').trim().toLowerCase());
  if (key) return colorQty[key];
  return totalQty;
};

const normalizeMatchKey = (value) => normalizeGarmentSize(value);

const findTrimPropertyValue = (propertyValues, pattern) => {
  const entry = Object.entries(propertyValues || {}).find(([k]) => pattern.test(String(k).trim()));
  const raw = entry?.[1];
  return raw != null && String(raw).trim() ? String(raw).trim() : '';
};

const getTrimColorFromRow = (row) =>
  findTrimPropertyValue(row.property_values, /^colou?r$/i) || (row.color_variant?.trim() || '');

const getTrimGarmentSizeFromRow = (row) =>
  normalizeGarmentSize(
    findTrimPropertyValue(row.property_values, /^garment\s*size$/i) || (row.size_variant?.trim() || ''),
  );

const piLineMatchesColor = (line, color) =>
  normalizeMatchKey(line.color) === normalizeMatchKey(color);

const sizesMatch = (a, b) => normalizeMatchKey(a) === normalizeMatchKey(b);

/** True when a trim's color property corresponds to an actual PI/garment colour. */
const colorMatchesAnyPiColor = (color, colorQty) => {
  if (!color) return false;
  return Object.keys(colorQty || {}).some((k) => normalizeMatchKey(k) === normalizeMatchKey(color));
};

/**
 * Qty from selected PI lines for a trim row's Color / Garment Size properties.
 * If the trim's colour doesn't match any actual PI colour (e.g. a Black velcro
 * shared across Navy Blue + Anthracite garments), the colour is treated as
 * "common to all colours" and ignored rather than zeroing out the quantity.
 */
const qtyFromPiForTrim = (row, piLines, colorQty) => {
  const rawColor = getTrimColorFromRow(row);
  const color = colorMatchesAnyPiColor(rawColor, colorQty) ? rawColor : '';
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
  const rawColor = getTrimColorFromRow(row);
  const color = colorMatchesAnyPiColor(rawColor, colorQty) ? rawColor : '';
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

const trimPartTotal = (row, part, piLines, colorQty, totalQty) =>
  calcTotal(part.consumption_per_pc, rowQtyForTrim(row, piLines, colorQty, totalQty));

// ── BOM table column helpers ───────────────────────────────────────────────────
const BOM_ROW_H = 46;
/** Fabric composition / color — tall enough for ~2 wrapped lines. */
const BOM_MULTILINE_H = 56;
const BOM_ROW_TOTAL = BOM_MULTILINE_H + 18;
const BOM_CELL_PAD_Y = (BOM_ROW_TOTAL - BOM_MULTILINE_H) / 2;
const FABRIC_COLS = [
  { label: 'Fabric composition *', width: '24%', align: 'left' },
  { label: 'Color', width: '12%', align: 'left' },
  { label: 'GSM', width: '8%', align: 'left' },
  { label: 'Roll W (CMS)', width: '9%', align: 'left' },
  { label: 'Cons./pc', width: '9%', align: 'left' },
  { label: 'Unit', width: '8%', align: 'left' },
  { label: 'Total', width: '10%', align: 'left' },
  { label: 'In Stock', width: '13%', align: 'left' },
  { label: '', width: '10%', align: 'left' },
];

const TRIM_COLS = [
  { label: 'Trim & Properties', width: '30%', align: 'left' },
  { label: 'Supplier', width: '20%', align: 'left' },
  { label: 'Cons./pc', width: '8%', align: 'left' },
  { label: 'Unit', width: '7%', align: 'left' },
  { label: 'Total', width: '9%', align: 'left' },
  { label: 'Tot. Unit', width: '7%', align: 'left' },
  { label: 'In Stock', width: '11%', align: 'left' },
  { label: '', width: '8%', align: 'left' },
];

/** Popper portaled above cards — prefers below the field, flips if needed. */
const AutocompleteSelectPopper = React.forwardRef(function AutocompleteSelectPopper(props, ref) {
  const { disablePortal, placement, style, modifiers, ...other } = props;
  return (
    <Popper
      {...other}
      ref={ref}
      disablePortal={false}
      placement="bottom-start"
      style={{ zIndex: 13000, ...(style || {}) }}
      modifiers={[
        {
          name: 'flip',
          enabled: true,
          options: { fallbackPlacements: ['top-start', 'bottom-end', 'top-end'] },
        },
        { name: 'preventOverflow', enabled: true, options: { altAxis: true, padding: 8 } },
        { name: 'offset', options: { offset: [0, 4] } },
      ]}
    />
  );
});

const AutocompleteMenuPaper = React.forwardRef(function AutocompleteMenuPaper(props, ref) {
  return (
    <Paper
      {...props}
      ref={ref}
      elevation={8}
      sx={{
        ...(props.sx || {}),
        bgcolor: '#fff',
        border: `1px solid ${slate[200]}`,
        borderRadius: 1.5,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.14)',
        mt: 0.25,
      }}
    />
  );
});

const autocompleteSelectListboxProps = {
  sx: {
    maxHeight: 220,
    py: 0.5,
    bgcolor: '#fff',
    '& .MuiAutocomplete-option': {
      fontSize: '0.8125rem',
      fontWeight: 600,
      minHeight: 36,
      color: slate[800],
    },
  },
};

// Back-compat aliases (older references)
const AutocompleteTopPopper = AutocompleteSelectPopper;
const autocompleteTopListboxProps = autocompleteSelectListboxProps;

/** Tall wrapping field for fabric composition / color — full value visible, no ellipsis. */
const bomMultilineFieldSx = (align = 'left') => ({
  width: '100%',
  m: 0,
  '& .MuiFormControl-root': { m: 0, width: '100%' },
  '& .MuiInputBase-root': {
    fontSize: '0.8125rem',
    fontWeight: 600,
    minHeight: BOM_MULTILINE_H,
    height: 'auto !important',
    display: 'flex',
    alignItems: 'flex-start',
    boxSizing: 'border-box',
    py: '6px !important',
  },
  '& .MuiInputBase-input, & textarea.MuiInputBase-input, & .MuiAutocomplete-input': {
    py: '0 !important',
    px: '10px !important',
    height: 'auto !important',
    minHeight: '2.5em !important',
    lineHeight: '1.3 !important',
    boxSizing: 'border-box',
    textAlign: align,
    whiteSpace: 'pre-wrap !important',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    overflow: 'visible !important',
    textOverflow: 'clip !important',
    resize: 'none',
  },
  '& .MuiOutlinedInput-input': {
    py: '0 !important',
    px: '10px !important',
    height: 'auto !important',
    lineHeight: '1.3 !important',
  },
  '& .MuiAutocomplete-inputRoot': {
    height: 'auto !important',
    minHeight: `${BOM_MULTILINE_H}px !important`,
    py: '6px !important',
    flexWrap: 'nowrap',
    alignItems: 'flex-start !important',
    overflow: 'visible !important',
  },
  '& .MuiAutocomplete-endAdornment': {
    top: 8,
    transform: 'none',
  },
});

/** Select-style color field: pick from list or type a custom colour. */
const ColorFreeSelect = ({
  value,
  options = [],
  onChange,
  fieldSx,
  placeholder = 'Select or type color',
  multiline = false,
}) => (
  <Autocomplete
    freeSolo
    disableClearable
    options={options}
    value={value || ''}
    onChange={(_, v) => onChange(typeof v === 'string' ? v : v || '')}
    onInputChange={(_, v, reason) => {
      if (reason === 'input' || reason === 'clear') onChange(v);
    }}
    PopperComponent={AutocompleteSelectPopper}
    PaperComponent={AutocompleteMenuPaper}
    ListboxProps={autocompleteSelectListboxProps}
    forcePopupIcon
    selectOnFocus
    clearOnBlur={false}
    handleHomeEndKeys
    title={value || undefined}
    sx={{
      m: 0,
      width: '100%',
      minWidth: 0,
      '& .MuiAutocomplete-popupIndicator': { color: slate[500] },
      '& .MuiAutocomplete-inputRoot': {
        overflow: 'visible !important',
        ...(multiline ? {
          height: 'auto !important',
          minHeight: `${BOM_MULTILINE_H}px !important`,
          alignItems: 'flex-start !important',
          py: '6px !important',
        } : {}),
      },
      '& .MuiAutocomplete-input': multiline ? {
        textOverflow: 'clip !important',
        overflow: 'visible !important',
        whiteSpace: 'pre-wrap !important',
        wordBreak: 'break-word',
        overflowWrap: 'anywhere',
        height: 'auto !important',
        minHeight: '2.6em !important',
        lineHeight: '1.3 !important',
      } : {
        textOverflow: 'clip !important',
        overflow: 'visible !important',
        whiteSpace: 'nowrap !important',
        minWidth: '4ch !important',
      },
    }}
    renderOption={(props, option) => (
      <Box component="li" {...props} key={option} title={option}>
        <Typography
          sx={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: slate[800],
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {option}
        </Typography>
      </Box>
    )}
    renderInput={(params) => (
      <TextField
        {...params}
        size="small"
        fullWidth
        multiline={multiline}
        minRows={multiline ? 2 : undefined}
        maxRows={multiline ? 4 : undefined}
        placeholder={placeholder}
        inputProps={{
          ...params.inputProps,
          title: value || placeholder,
        }}
        sx={{
          ...fieldSx,
          ...(multiline ? bomMultilineFieldSx('left') : {}),
          '& .MuiAutocomplete-input, & input, & textarea': {
            textOverflow: 'clip !important',
            overflow: 'visible !important',
            whiteSpace: multiline ? 'pre-wrap !important' : 'nowrap !important',
            wordBreak: multiline ? 'break-word' : undefined,
            textAlign: 'left',
          },
        }}
      />
    )}
  />
);
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
    textOverflow: 'clip !important',
    overflow: 'visible !important',
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
    textOverflow: 'clip !important',
    overflow: 'visible !important',
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
    overflow: 'visible !important',
  },
  '& .MuiAutocomplete-input': {
    py: '0 !important',
    px: '0 !important',
    textOverflow: 'clip !important',
    overflow: 'visible !important',
  },
});

/** Cons./pc fields — bolder text so the key BOM input stands out (no tint, stays obviously editable). */
const bomConsFieldSx = (align = 'left') => ({
  ...bomFieldSx(align),
  '& input': { fontWeight: 700, fontSize: '0.9rem', color: slate[900] },
});

/** Total fields — strongest emphasis in the row (computed BOM output). */
const bomTotalFieldSx = (align = 'left') => ({
  ...bomFieldSx(align),
  '& .MuiInputBase-root': {
    ...bomFieldSx(align)['& .MuiInputBase-root'],
    bgcolor: alpha('#4f46e5', 0.1),
    border: `1px solid ${alpha('#4f46e5', 0.3)}`,
    borderRadius: '6px',
  },
  '& input': { fontWeight: 800, fontSize: '0.92rem', color: '#3730a3' },
});

const bomTableBaseSx = (slateColor) => ({
  width: '100%',
  tableLayout: 'fixed',
  borderCollapse: 'collapse',
  '& .MuiTableBody-root .MuiTableRow-root': {
    height: 'auto',
    minHeight: BOM_ROW_TOTAL,
  },
  '& .MuiTableCell-root': {
    px: '8px !important',
    py: `${BOM_CELL_PAD_Y}px !important`,
    height: 'auto',
    minHeight: BOM_ROW_TOTAL,
    verticalAlign: 'middle !important',
    borderBottom: `1px solid ${slateColor[200]}`,
    borderRight: `1px solid ${slateColor[100]}`,
    overflow: 'visible',
    '&:last-child': { borderRight: 'none' },
  },
  '& .MuiTableCell-sizeSmall': {
    px: '8px !important',
    py: `${BOM_CELL_PAD_Y}px !important`,
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    verticalAlign: 'middle !important',
    bgcolor: alpha(slateColor[900], 0.04),
    fontWeight: 700,
    fontSize: '0.72rem',
    whiteSpace: 'normal',
    lineHeight: 1.25,
    height: 44,
    py: '0 !important',
    px: '8px !important',
  },
});

const bomCellInner = (align = 'left') => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
  minHeight: BOM_MULTILINE_H,
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

/** Supplier cell — wraps full name; equal padding keeps text vertically centered. */
const SUPPLIER_FIELD_MIN_H = 40;
const supplierFieldSx = {
  width: '100%',
  m: 0,
  '& .MuiFormControl-root': { m: 0, width: '100%' },
  '& .MuiInputBase-root': {
    fontSize: '0.8125rem',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center !important',
    boxSizing: 'border-box',
    minHeight: SUPPLIER_FIELD_MIN_H,
    height: 'auto !important',
    py: '8px !important',
    px: '10px !important',
  },
  '& .MuiAutocomplete-inputRoot': {
    height: 'auto !important',
    minHeight: `${SUPPLIER_FIELD_MIN_H}px !important`,
    alignItems: 'center !important',
    flexWrap: 'nowrap',
    py: '8px !important',
  },
  '& textarea.MuiInputBase-input, & textarea.MuiAutocomplete-input': {
    padding: '0 !important',
    margin: '0 !important',
    height: 'auto !important',
    minHeight: '0 !important',
    maxHeight: 'none !important',
    lineHeight: '1.4 !important',
    whiteSpace: 'pre-wrap !important',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    overflow: 'visible !important',
    textOverflow: 'clip !important',
    resize: 'none',
    boxSizing: 'border-box',
  },
  '& .MuiAutocomplete-endAdornment': { display: 'none' },
};

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
    bgcolor: '#fff',
    border: `1px solid ${alpha('#6366f1', 0.18)}`,
    borderRadius: '6px',
    overflow: 'visible',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiInputBase-input': {
    py: '0 !important',
    px: '8px !important',
    height: `${TRIM_PROP_FIELD_H}px !important`,
    lineHeight: `${TRIM_PROP_FIELD_H}px !important`,
    boxSizing: 'border-box',
    textAlign: align,
    color: slate[900],
    textOverflow: 'clip !important',
    overflow: 'visible !important',
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
    flexWrap: 'nowrap',
    overflow: 'visible',
  },
  '& .MuiAutocomplete-input': {
    minWidth: '0 !important',
    width: '100% !important',
    textOverflow: 'clip !important',
    overflow: 'visible !important',
  },
  '& .MuiAutocomplete-endAdornment': {
    right: 4,
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

const trimPartColHeadSx = {
  fontSize: '0.62rem',
  fontWeight: 700,
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  lineHeight: 1.2,
};

const trimBomTableSx = (slateColor) => ({
  ...bomTableBaseSx(slateColor),
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
    overflow: 'visible',
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

const piLineFabricComposition = (line) => String(line?.material || line?.fabric || '').trim();

const collectFabricCompositionOptions = (piLines, fabricRows) => {
  const options = new Set();
  (piLines || []).forEach((line) => {
    const composition = piLineFabricComposition(line);
    if (composition) options.add(composition);
  });
  (fabricRows || []).forEach((row) => {
    const material = String(row?.material || '').trim();
    if (material) options.add(material);
  });
  return [...options].sort((a, b) => a.localeCompare(b));
};

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
      const normalizedSize = normalizeGarmentSize(size);
      if (!normalizedSize) return;
      allSizes.add(normalizedSize);
      sizeMap[normalizedSize] = (sizeMap[normalizedSize] || 0) + (parseInt(qty, 10) || 0);
    });
    rows.push({
      id: line.id,
      color: line.color || '—',
      itemName: line.item_name || '—',
      fabricComposition: piLineFabricComposition(line),
      sizeMap,
      total: line.quantity_pcs || Object.values(sizeMap).reduce((s, v) => s + v, 0),
    });
  });
  return { sizes: sortGarmentSizes(allSizes), rows };
};

// ── Table cell sx ─────────────────────────────────────────────────────────────
const cellSx = { border: '1px solid #000', p: '4px 6px', fontSize: '8.5pt', fontFamily: 'inherit', verticalAlign: 'middle' };
const thSx   = { ...cellSx, fontWeight: 700, bgcolor: '#e8e8e8', textAlign: 'center' };

// ── Printed Indent Document ───────────────────────────────────────────────────
function IndentDocument({ pi, indent, fabricLines, trimLines, company, selectedLines, suppliers = [], trimsList = [] }) {
  const piLines = selectedLines || pi?.lines || [];
  const colorQty = buildColorQty(piLines);
  const colors = Object.keys(colorQty);
  const totalQty = Object.values(colorQty).reduce((s, v) => s + v, 0);

  const itemName = [...new Set(piLines.map((l) => l.item_name))].join(' / ');
  const sizeBreakdown = piLines.reduce((acc, line) => {
    if (line.size_breakdown?.length) {
      line.size_breakdown.forEach(({ size, qty }) => {
        const normalizedSize = normalizeGarmentSize(size);
        if (!normalizedSize) return;
        if (!acc[normalizedSize]) acc[normalizedSize] = {};
        acc[normalizedSize][line.color || 'Total'] = (acc[normalizedSize][line.color || 'Total'] || 0) + (qty || 0);
      });
    }
    return acc;
  }, {});
  const sizes = sortGarmentSizes(Object.keys(sizeBreakdown));

  const companyName = company?.company_legal_name || 'JB INTERNATIONAL';

  const supplierLabelForTrim = (row) => {
    if (row?.supplier_name) {
      return row.supplier_country
        ? `${row.supplier_name} · ${row.supplier_country}`
        : row.supplier_name;
    }
    if (row?.supplier) {
      const s = suppliers.find((x) => x.id === row.supplier);
      if (s?.name) {
        return s.country ? `${s.name} · ${s.country}` : s.name;
      }
    }
    return '';
  };

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
            {['MATERIAL', 'COLOR / VARIANT', 'GSM', 'ROLL W (CMS)', 'CONSUM.', 'UNIT', 'TOT CON.', 'SUPPLIER', 'IN STOCK'].map((h) => (
              <Box component="th" key={h} sx={thSx}>{h}</Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {fabricLines.filter((r) => r.material).map((row, i) => (
            <Box component="tr" key={`f${i}`}>
              <Box component="td" sx={{ ...cellSx, fontWeight: 600 }}>{row.material}</Box>
              <Box component="td" sx={cellSx}>{row.color}</Box>
              <Box component="td" sx={cellSx}>{row.gsm ? `${row.gsm} GSM` : '—'}</Box>
              <Box component="td" sx={cellSx}>{row.roll_width ? `${row.roll_width} CMS` : '—'}</Box>
              <Box component="td" sx={cellSx}>{row.consumption_per_pc}</Box>
              <Box component="td" sx={cellSx}>{row.unit}</Box>
              <Box component="td" sx={{ ...cellSx, fontWeight: 700 }}>{row.total_consumption}</Box>
              <Box component="td" sx={{ ...cellSx, fontSize: '7.5pt', color: '#666' }}>—</Box>
              <Box component="td" sx={{ ...cellSx, fontSize: '7.5pt' }}>{isInStockRemark(row.remarks) ? 'In stock' : '—'}</Box>
            </Box>
          ))}
          {trimLines.filter((r) => r.trim_name).map((row, i) => {
            const parts = row.parts?.length ? row.parts : null;
            const supplierLabel = supplierLabelForTrim(row);
            const trimSchema = row.trim
              ? trimsList.find((t) => t.id === row.trim)
              : trimsList.find((t) => String(t.name || '').toLowerCase() === String(row.trim_name || '').toLowerCase());
            return (
              <Box component="tr" key={`t${i}`}>
                <Box component="td" sx={{ ...cellSx, textTransform: 'uppercase' }}>{row.trim_name}</Box>
                <Box component="td" sx={cellSx}>{formatTrimVariantDisplay(row, trimSchema) || '—'}</Box>
                <Box component="td" sx={cellSx}>—</Box>
                <Box component="td" sx={cellSx}>—</Box>
                <Box component="td" sx={{ ...cellSx, whiteSpace: 'pre-line' }}>
                  {parts
                    ? parts.map((p) => `${(p.label || 'Part').toUpperCase()}: ${p.consumption_per_pc}`).join('\n')
                    : row.consumption_per_pc}
                </Box>
                <Box component="td" sx={{ ...cellSx, whiteSpace: 'pre-line' }}>
                  {parts ? parts.map((p) => p.unit).join('\n') : row.unit}
                </Box>
                <Box component="td" sx={{ ...cellSx, fontWeight: 700, whiteSpace: 'pre-line' }}>
                  {parts
                    ? parts.map((p) => `${(p.label || 'Part').toUpperCase()}: ${p.total_consumption}`).join('\n')
                    : row.total_consumption}
                </Box>
                <Box component="td" sx={{ ...cellSx, fontSize: '7.5pt', fontWeight: supplierLabel ? 600 : 400 }}>
                  {supplierLabel || '—'}
                </Box>
                <Box component="td" sx={{ ...cellSx, fontSize: '7.5pt' }}>{isInStockRemark(row.remarks) ? 'In stock' : '—'}</Box>
              </Box>
            );
          })}
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
                line.size_breakdown.forEach(({ size, qty }) => {
                  const normalizedSize = normalizeGarmentSize(size);
                  if (!normalizedSize) return;
                  sizeMap[normalizedSize] = (sizeMap[normalizedSize] || 0) + (parseInt(qty, 10) || 0);
                });
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

const asApiList = (data) => (Array.isArray(data) ? data : data?.results || []);

const piFromIndentData = (data) => {
  if (data?.pi_detail) {
    return { ...data.pi_detail, lines: data.pi_detail.lines || data.pi_lines || [] };
  }
  return {
    id: data.pi,
    pi_number: data.pi_number,
    client_name: data.pi_client_name || '',
    lines: data.pi_lines || [],
  };
};

const loadIndentTrims = async () => {
  try {
    const res = await ordersAPI.getIndentTrimsLibrary();
    return asApiList(res.data);
  } catch {
    const res = await ordersAPI.getTrimsMaster();
    return asApiList(res.data);
  }
};

const loadIndentPiContext = async (piId) => {
  try {
    const res = await ordersAPI.getIndentPiContext(piId);
    return res.data;
  } catch {
    const res = await ordersAPI.getPI(piId);
    return res.data;
  }
};

const loadIndentPiOptions = async () => {
  try {
    const res = await ordersAPI.getIndentPiOptions();
    return asApiList(res.data);
  } catch {
    const res = await ordersAPI.getPIs({ page_size: 200 });
    return asApiList(res.data);
  }
};

// ── Main Editor Page ──────────────────────────────────────────────────────────
export default function IndentEditorPage() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const { user }    = useAuth();
  const canManageTrimsLibrary = hasModuleAccess(user, 'trims');
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
  const [suppliers, setSuppliers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);

  // Form state
  const [indent,       setIndent]      = useState(null);
  const [indentNumber, setIndentNumber] = useState('');
  const [indentDate,   setIndentDate]  = useState(new Date().toISOString().split('T')[0]);
  const [status,       setStatus]      = useState('DRAFT');
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
  const [trimModalInitialName, setTrimModalInitialName] = useState('');
  const [sizeBreakdownOpen, setSizeBreakdownOpen] = useState(true);
  const [saveNotice, setSaveNotice] = useState('');
  const [addPropRow, setAddPropRow] = useState(null);
  const [newPropName, setNewPropName] = useState('');
  const [newPropUnit, setNewPropUnit] = useState('');
  const [addingProp, setAddingProp] = useState(false);

  const resetBomFormState = () => {
    setFabricLines([emptyFabric()]);
    setTrimLines([emptyTrim()]);
    setPreparedBy('');
    setReceivedBy('');
    setApprovedBy('');
    setNotes('');
    setAutoFilled(false);
  };

  const resetNewIndentForm = () => {
    resetBomFormState();
    setPi(null);
    setSelectedLineIds([]);
    setIndent(null);
    setIndentDate(new Date().toISOString().split('T')[0]);
    setStatus('DRAFT');
  };

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
        const normalizedSize = normalizeGarmentSize(size);
        if (normalizedSize) sizes.add(normalizedSize);
      });
    });
    return sortGarmentSizes(sizes);
  }, [activeLines]);
  const fabricCompositionOptions = useMemo(
    () => collectFabricCompositionOptions(pi?.lines, fabricLines),
    [pi, fabricLines],
  );

  const getTrimMaster = (row) => (row.trim ? trimsList.find((t) => t.id === row.trim) : null);

  /** Master properties + any keys already on the row (supports custom types added on indent). */
  const getTrimSchema = (row) => {
    const byName = new Map();
    (getTrimMaster(row)?.properties || []).forEach((p) => {
      if (p?.name) byName.set(String(p.name).trim().toLowerCase(), { name: p.name, unit: p.unit || '' });
    });
    (row.extra_properties || []).forEach((p) => {
      if (p?.name) byName.set(String(p.name).trim().toLowerCase(), { name: p.name, unit: p.unit || '' });
    });
    Object.keys(row.property_values || {}).forEach((name) => {
      const key = String(name || '').trim().toLowerCase();
      if (key && !byName.has(key)) byName.set(key, { name, unit: '' });
    });
    return [...byName.values()];
  };

  const openAddProperty = (rowIndex) => {
    setAddPropRow(rowIndex);
    setNewPropName('');
    setNewPropUnit('');
  };

  const cancelAddProperty = () => {
    setAddPropRow(null);
    setNewPropName('');
    setNewPropUnit('');
  };

  const commitAddProperty = async (rowIndex) => {
    const name = normalizeTrimPropertyName(newPropName);
    if (!name) {
      alert('Enter a property type name (e.g. Width, Pantone).');
      return;
    }
    const unit = isNumericTrimProperty(name) ? '' : String(newPropUnit || '').trim();
    const row = trimLines[rowIndex];
    if (!row) return;
    const schema = getTrimSchema(row);
    if (schema.some((p) => String(p.name).toLowerCase() === name.toLowerCase())) {
      alert(`Property “${name}” already exists on this trim.`);
      return;
    }

    setAddingProp(true);
    try {
      const master = getTrimMaster(row);
      if (master && canManageTrimsLibrary) {
        const nextProps = [...(master.properties || []), { name, unit }];
        const res = await ordersAPI.updateTrim(master.id, { properties: nextProps });
        setTrimsList((prev) => prev.map((t) => (t.id === master.id ? res.data : t)));
      }
      setTrimLines((prev) => {
        const next = [...prev];
        const cur = next[rowIndex];
        const extra = [...(cur.extra_properties || [])];
        if (!master || !canManageTrimsLibrary) {
          extra.push({ name, unit });
        }
        next[rowIndex] = {
          ...cur,
          extra_properties: extra,
          property_values: { ...(cur.property_values || {}), [name]: '' },
        };
        return next;
      });
      cancelAddProperty();
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert(`Could not add property: ${msg}`);
    } finally {
      setAddingProp(false);
    }
  };

  const withStockRemark = (row) => applyInventoryStockRemark(row, inventoryItems, trimsList);

  useEffect(() => {
    if (location.state?.saveMessage) {
      setSaveNotice(location.state.saveMessage);
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  // Load inventory so trim "In stock" can auto-match SKUs by properties
  useEffect(() => {
    (async () => {
      try {
        const all = [];
        let page = 1;
        let guard = 0;
        while (guard < 40) {
          guard += 1;
          const res = await inventoryAPI.getAll({ is_active: true, page });
          const chunk = asInventoryList(res.data);
          all.push(...chunk);
          if (!res.data?.next || !chunk.length) break;
          page += 1;
        }
        setInventoryItems(all);
      } catch (err) {
        console.error('Failed to load inventory for stock matching:', err);
      }
    })();
  }, []);

  // Load suppliers for per-trim-line picker
  useEffect(() => {
    (async () => {
      try {
        const res = await suppliersAPI.getAll({ is_active: true, page_size: 500 });
        setSuppliers(asApiList(res.data));
      } catch (err) {
        console.error('Failed to load suppliers:', err);
      }
    })();
  }, []);

  // Re-evaluate stock badges when inventory / trim library arrives
  useEffect(() => {
    if (!inventoryItems.length) return;
    setTrimLines((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (!row.trim && !String(row.trim_name || '').trim()) return row;
        const updated = applyInventoryStockRemark(row, inventoryItems, trimsList);
        if (updated !== row) changed = true;
        return updated;
      });
      return changed ? next : prev;
    });
  }, [inventoryItems, trimsList]);

  // Recalculate totals when selected PI lines / qty change — never overwrite manual/saved totals.
  useEffect(() => {
    setFabricLines((prev) => prev.map((row) => {
      if (row.total_manual || !row.consumption_per_pc) return row;
      const nextTotal = fabricRowTotal(row, colorQty, totalQty);
      if (String(row.total_consumption) === String(nextTotal)) return row;
      return { ...row, total_consumption: nextTotal };
    }));
    setTrimLines((prev) => prev.map((row) => {
      if (row.total_manual) return row;
      if (hasTrimParts(row)) {
        const parts = row.parts.map((p) => {
          if (p.total_manual || !p.consumption_per_pc) return p;
          return { ...p, total_consumption: trimPartTotal(row, p, activeLines, colorQty, totalQty) };
        });
        return { ...row, parts, ...sumTrimParts(parts) };
      }
      if (!row.consumption_per_pc) return row;
      const nextTotal = trimRowTotal(row, activeLines, colorQty, totalQty);
      if (String(row.total_consumption) === String(nextTotal)) return row;
      return { ...row, total_consumption: nextTotal };
    }));
  }, [colorQty, totalQty, activeLines]);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        if (isNew) {
          resetNewIndentForm();
          const [trims, piArr] = await Promise.all([loadIndentTrims(), loadIndentPiOptions()]);
          setTrimsList(trims);
          setPiList(piArr);

          if (piIdFromUrl) {
            const piData = await loadIndentPiContext(piIdFromUrl);
            setPi(piData);
            setSelectedLineIds((piData.lines || []).map((l) => l.id));
          }
          const numRes = await ordersAPI.getNextIndentNumber();
          setIndentNumber(numRes.data.indent_number);
        } else {
          const res = await ordersAPI.getIndent(id);
          const data = res.data;
          setIndent(data);
          setIndentNumber(data.indent_number);
          setIndentDate(data.indent_date);
          setStatus(data.status);
          setPreparedBy(data.prepared_by || '');
          setReceivedBy(data.received_by || '');
          setApprovedBy(data.approved_by || '');
          setNotes(data.notes || '');
          setFabricLines(
            data.fabric_lines?.length
              ? data.fabric_lines.map((r) => enrichFabricRowGsm({
                ...emptyFabric(),
                ...r,
                total_consumption: r.total_consumption != null && r.total_consumption !== ''
                  ? String(r.total_consumption)
                  : '',
                total_manual: true,
              }))
              : [emptyFabric()],
          );
          setTrimLines(data.trim_lines?.length ? data.trim_lines.map(mapApiTrimLine) : [emptyTrim()]);
          setSelectedLineIds(data.selected_pi_line_ids?.length ? data.selected_pi_line_ids : []);

          const piData = piFromIndentData(data);
          setPi(piData);
          if (!data.selected_pi_line_ids?.length) {
            setSelectedLineIds((piData.lines || []).map((l) => l.id));
          }

          const libraryTrims = await loadIndentTrims();
          const linked = data.linked_trims || [];
          const merged = [...libraryTrims];
          linked.forEach((t) => {
            if (!merged.some((m) => m.id === t.id)) merged.push(t);
          });
          setTrimsList(merged);
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
          if (tmpl.fabric_lines?.length) {
            setFabricLines(tmpl.fabric_lines.map((r) => enrichFabricRowGsm({ ...emptyFabric(), ...r })));
          }
          if (tmpl.trim_lines?.length) {
            setTrimLines(tmpl.trim_lines.map(mapApiTrimLine));
          }
          setAutoFilled(true);
          break;
        }
      } catch (_) { /* no template */ }
    }
  };

  const loadItemTemplate = async () => {
    if (!activeLines.length) return;
    await tryAutoFillForLines(activeLines);
  };

  const loadFullPi = async (piSummary) => {
    if (!piSummary?.id) return null;
    return loadIndentPiContext(piSummary.id);
  };

  const handlePiSelect = async (piSummary) => {
    resetBomFormState();
    if (!piSummary) {
      setPi(null);
      setSelectedLineIds([]);
      return;
    }
    const piData = await loadFullPi(piSummary);
    setPi(piData);
    const lineIds = (piData?.lines || []).map((l) => l.id);
    setSelectedLineIds(lineIds);
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
      if (field === 'material') {
        const gsmFromComposition = extractGsmFromFabricComposition(value);
        if (gsmFromComposition) updated.gsm = gsmFromComposition;
      }
      if (field === 'total_consumption') {
        updated.total_manual = true;
        next[i] = updated;
      } else if (field === 'remarks' || field === 'material' || field === 'unit' || field === 'gsm' || field === 'roll_width') {
        next[i] = updated;
      } else {
        // consumption / color — resume auto total
        updated.total_manual = false;
        updated.total_consumption = fabricRowTotal(updated, colorQty, totalQty);
        next[i] = updated;
      }
      return next;
    });
  };

  const addFabricRow = () => setFabricLines((p) => [...p, emptyFabric()]);
  const insertFabricRowAfter = (i) => setFabricLines((p) => [...p.slice(0, i + 1), emptyFabric(), ...p.slice(i + 1)]);
  const removeFabricRow = (i) => setFabricLines((p) => p.filter((_, idx) => idx !== i));

  // ── Trim row helpers ───────────────────────────────────────────────────────
  const setTrimField = (i, field, value) => {
    setTrimLines((prev) => {
      const next = [...prev];
      const nextValue = field === 'size_variant' ? normalizeGarmentSize(value) : value;
      let updated = { ...next[i], [field]: nextValue };
      if (field === 'total_consumption') {
        updated.total_manual = true;
      } else if (field === 'consumption_per_pc' || field === 'color_variant' || field === 'size_variant') {
        updated.total_manual = false;
        if (hasTrimParts(updated)) {
          const parts = updated.parts.map((p) => ({
            ...p,
            total_manual: false,
            total_consumption: trimPartTotal(updated, p, activeLines, colorQty, totalQty),
          }));
          updated = { ...updated, parts, ...sumTrimParts(parts) };
        } else {
          updated.total_consumption = trimRowTotal(updated, activeLines, colorQty, totalQty);
        }
      }
      // Auto stock match when identity / properties change; keep manual remarks toggle as-is
      if (field === 'color_variant' || field === 'size_variant' || field === 'trim_name' || field === 'category') {
        updated = withStockRemark(updated);
      }
      next[i] = updated;
      return next;
    });
  };

  const addTrimRow = () => setTrimLines((p) => [...p, emptyTrim()]);
  const insertTrimRowAfter = (i) => setTrimLines((p) => [...p.slice(0, i + 1), emptyTrim(), ...p.slice(i + 1)]);
  const removeTrimRow = (i) => setTrimLines((p) => p.filter((_, idx) => idx !== i));

  /** Toggle multi-part consumption (e.g. Velcro Hook & Loop) for a trim row. */
  const toggleTrimParts = (i, enabled) => {
    setTrimLines((prev) => {
      const next = [...prev];
      const row = next[i];
      if (enabled) {
        const parts = [emptyTrimPart('Hook'), emptyTrimPart('Loop')];
        next[i] = { ...row, parts, ...sumTrimParts(parts) };
      } else {
        next[i] = { ...row, parts: [] };
      }
      return next;
    });
  };

  const addTrimPart = (i) => {
    setTrimLines((prev) => {
      const next = [...prev];
      const row = next[i];
      const parts = [...(row.parts || []), emptyTrimPart(`Part ${row.parts.length + 1}`)];
      next[i] = { ...row, parts, ...sumTrimParts(parts) };
      return next;
    });
  };

  const removeTrimPart = (i, partIdx) => {
    setTrimLines((prev) => {
      const next = [...prev];
      const row = next[i];
      const parts = row.parts.filter((_, pIdx) => pIdx !== partIdx);
      next[i] = { ...row, parts, ...sumTrimParts(parts) };
      return next;
    });
  };

  const setTrimPartField = (i, partIdx, field, value) => {
    setTrimLines((prev) => {
      const next = [...prev];
      const row = next[i];
      const parts = row.parts.map((p, pIdx) => {
        if (pIdx !== partIdx) return p;
        const updatedPart = { ...p, [field]: value };
        if (field === 'total_consumption') {
          updatedPart.total_manual = true;
        } else if (field === 'consumption_per_pc') {
          updatedPart.total_manual = false;
          updatedPart.total_consumption = trimPartTotal(row, updatedPart, activeLines, colorQty, totalQty);
        }
        return updatedPart;
      });
      const summed = { ...row, parts, ...sumTrimParts(parts) };
      // Row total is derived from parts when Cons./pc or part Total changes.
      if (field === 'consumption_per_pc' || field === 'total_consumption') {
        summed.total_manual = true;
      }
      next[i] = summed;
      return next;
    });
  };

  const selectTrimFromLibrary = (i, trim) => {
    setTrimLines((prev) => {
      const next = [...prev];
      let row = {
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
      if (row.consumption_per_pc) {
        row.total_consumption = trimRowTotal(row, activeLines, colorQty, totalQty);
      }
      next[i] = withStockRemark(row);
      return next;
    });
  };

  const setTrimPropertyValue = (i, propName, value) => {
    setTrimLines((prev) => {
      const next = [...prev];
      const nextValue = isGarmentSizeTrimProperty(propName) ? normalizeGarmentSize(value) : value;
      let row = { ...next[i], property_values: { ...(next[i].property_values || {}), [propName]: nextValue } };
      // Color / garment size change the qty basis — resume auto total. Other props keep a manual total.
      const qtyBasisChanged = /^colou?r$/i.test(String(propName).trim()) || isGarmentSizeTrimProperty(propName);
      if (qtyBasisChanged || !row.total_manual) {
        row.total_manual = false;
        if (hasTrimParts(row)) {
          const parts = row.parts.map((p) => ({
            ...p,
            total_manual: false,
            total_consumption: trimPartTotal(row, p, activeLines, colorQty, totalQty),
          }));
          row = { ...row, parts, ...sumTrimParts(parts) };
        } else {
          row.total_consumption = trimRowTotal(row, activeLines, colorQty, totalQty);
        }
      }
      next[i] = withStockRemark(row);
      return next;
    });
  };

  const openTrimModal = (rowIndex = null, initialName = '') => {
    setTrimModalTargetRow(rowIndex);
    setTrimModalInitialName(initialName || '');
    setTrimModalOpen(true);
  };

  const handleTrimCreated = (newTrim) => {
    setTrimsList((prev) => [...prev, newTrim].sort((a, b) => a.name.localeCompare(b.name)));
    if (trimModalTargetRow != null) {
      selectTrimFromLibrary(trimModalTargetRow, newTrim);
    } else {
      setTrimLines((prev) => {
        const entry = withStockRemark({
          ...emptyTrim(),
          trim: newTrim.id,
          trim_name: newTrim.name,
          category: newTrim.category || '',
          unit: newTrim.default_unit || 'PCS',
          total_unit: newTrim.default_unit || 'PCS',
          property_values: initPropertyValues(newTrim.properties),
        });
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
    setTrimModalInitialName('');
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async (nextStatus) => {
    if (!pi) { alert('Please select a PI first.'); return; }
    if (!selectedLineIds.length) { alert('Select at least one PI line item.'); return; }
    if (!indentNumber.trim()) { alert('Indent number is required.'); return; }

    setSaving(true);
    try {
      // Carton Box is a normal trim with user-defined properties — clear legacy indent carton fields.
      const payload = {
        pi: pi.id,
        selected_pi_line_ids: selectedLineIds,
        indent_number: indentNumber,
        indent_date: indentDate,
        status: nextStatus || status,
        pcs_per_carton: 0,
        carton_ply: '',
        carton_dimensions: '',
        carton_dimensions_unit: 'CMS',
        carton_boxes: [],
        prepared_by: preparedBy,
        received_by: receivedBy,
        approved_by: approvedBy,
        notes,
        fabric_lines: fabricLines.filter((r) => r.material.trim()).map(serializeFabricLine),
        trim_lines: trimLines.filter((r) => r.trim_name.trim()).map(serializeTrimLine),
      };

      let res;
      const savedStatus = nextStatus || status;
      const successMessage = savedStatus === 'CONFIRMED'
        ? `Indent ${indentNumber} confirmed and saved.`
        : isNew
          ? `Indent ${indentNumber} created successfully.`
          : `Indent ${indentNumber} saved successfully.`;

      if (isNew) {
        res = await ordersAPI.createIndent(payload);
        navigate(`/indents/${res.data.id}`, {
          replace: true,
          state: { saveMessage: successMessage },
        });
      } else {
        res = await ordersAPI.updateIndent(id, payload);
        setIndent(res.data);
        setStatus(res.data.status);
        if (res.data.trim_lines?.length) {
          setTrimLines(res.data.trim_lines.map(mapApiTrimLine));
        }
        if (res.data.linked_trims?.length) {
          setTrimsList((prev) => {
            const merged = [...prev];
            res.data.linked_trims.forEach((t) => {
              const idx = merged.findIndex((m) => m.id === t.id);
              if (idx >= 0) merged[idx] = t;
              else merged.push(t);
            });
            return merged;
          });
        }
        setSaveNotice(successMessage);
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

      <Snackbar
        open={Boolean(saveNotice)}
        autoHideDuration={5000}
        onClose={() => setSaveNotice('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSaveNotice('')}
          severity="success"
          variant="filled"
          sx={{ width: '100%', fontWeight: 600 }}
        >
          {saveNotice}
        </Alert>
      </Snackbar>

      {/* ── Toolbar ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/indents')} size="small"><ArrowBack /></IconButton>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', flex: 1 }}>
          {isNew ? 'New Indent' : `Indent: ${indentNumber}`}
        </Typography>
        {!isNew && (
          <Button startIcon={<Print />} variant="outlined" size="small"
            onClick={() => window.print()}
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
          <Grid item xs={6} sm={4} md={3}>
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
                    <Typography sx={{ fontSize: '0.68rem', color: '#92400e', fontWeight: 600 }}>Template loaded</Typography>
                  </Box>
                )}
              </Box>
            </Grid>
          )}
        </Grid>

        {isNew && pi && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AutoAwesome />}
              onClick={loadItemTemplate}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                borderColor: '#d97706',
                color: '#92400e',
                '&:hover': { borderColor: '#b45309', bgcolor: alpha('#f59e0b', 0.06) },
              }}
            >
              Load saved BOM for this item
            </Button>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
              Optional — fills fabric &amp; trims from the last saved indent for this item name.
            </Typography>
          </Box>
        )}

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
                  const fabricComposition = piLineFabricComposition(line);
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
                        {fabricComposition && (
                          <Typography sx={{ fontSize: '0.68rem', color: slate[600], mt: 0.35, lineHeight: 1.4, fontWeight: 600 }}>
                            Fabric composition: {fabricComposition}
                          </Typography>
                        )}
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
                              zIndex: 4,
                              bgcolor: '#e0e7ff',
                              backgroundImage: 'none',
                              boxShadow: '2px 0 4px rgba(0,0,0,0.06)',
                              borderBottom: `1px solid ${slate[300]}`,
                            }}>
                              Colour
                            </TableCell>
                            {sizeTable.sizes.map((size) => (
                              <TableCell
                                key={size}
                                align="center"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.68rem',
                                  minWidth: 40,
                                  px: 0.75,
                                  py: 0.75,
                                  bgcolor: '#eef2ff',
                                  backgroundImage: 'none',
                                  borderBottom: `1px solid ${slate[300]}`,
                                }}
                              >
                                {size}
                              </TableCell>
                            ))}
                            <TableCell align="center" sx={{
                              fontWeight: 800,
                              fontSize: '0.68rem',
                              minWidth: 48,
                              px: 0.75,
                              bgcolor: '#eef2ff',
                              backgroundImage: 'none',
                              borderBottom: `1px solid ${slate[300]}`,
                            }}>
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
                                {row.fabricComposition && (
                                  <Typography sx={{ fontSize: '0.6rem', color: slate[500], fontWeight: 500, lineHeight: 1.35, mt: 0.2 }}>
                                    {row.fabricComposition}
                                  </Typography>
                                )}
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
      <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2, overflow: 'visible' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', flex: 1 }}>Fabric</Typography>
              <Button size="small" startIcon={<Add />} onClick={addFabricRow}
                sx={{ fontWeight: 700, textTransform: 'none' }}>Add Row</Button>
            </Box>
            <Box sx={{ overflow: 'visible', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
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
                        <Box sx={{ ...bomCellInner('left'), alignItems: 'flex-start' }}>
                          <Autocomplete
                            freeSolo
                            options={fabricCompositionOptions}
                            value={row.material}
                            onChange={(_, v) => setFabricField(i, 'material', v || '')}
                            onInputChange={(_, v) => setFabricField(i, 'material', v)}
                            title={row.material || undefined}
                            sx={{
                              m: 0,
                              width: '100%',
                              '& .MuiAutocomplete-inputRoot': {
                                height: 'auto !important',
                                minHeight: `${BOM_MULTILINE_H}px !important`,
                                alignItems: 'flex-start !important',
                                py: '6px !important',
                                overflow: 'visible !important',
                              },
                            }}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={4}
                                placeholder="Select from PI or type new fabric"
                                inputProps={{
                                  ...params.inputProps,
                                  title: row.material || 'Select from PI or type new fabric',
                                }}
                                sx={bomMultilineFieldSx('left')}
                              />
                            )}
                            renderOption={(props, option) => (
                              <Box component="li" {...props} key={option}>
                                <Typography sx={{
                                  fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.35,
                                  whiteSpace: 'normal', wordBreak: 'break-word',
                                }}>
                                  {option}
                                </Typography>
                              </Box>
                            )}
                          />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={{ ...bomCellInner('left'), alignItems: 'flex-start' }}>
                          <ColorFreeSelect
                            value={row.color || ''}
                            options={Object.keys(colorQty)}
                            onChange={(v) => setFabricField(i, 'color', v)}
                            fieldSx={bomMultilineFieldSx('left')}
                            placeholder="Select or type color"
                            multiline
                          />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <TextField size="small" fullWidth type="number" value={row.gsm || ''}
                            onChange={(e) => setFabricField(i, 'gsm', e.target.value)}
                            placeholder="245"
                            inputProps={{ step: '0.01', min: '0', style: { textAlign: 'left' } }}
                            sx={bomFieldSx('left')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <TextField size="small" fullWidth type="number" value={row.roll_width || ''}
                            onChange={(e) => setFabricField(i, 'roll_width', e.target.value)}
                            placeholder="150"
                            inputProps={{ step: '1', min: '0', style: { textAlign: 'left' } }}
                            sx={bomFieldSx('left')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <TextField size="small" fullWidth type="number" value={row.consumption_per_pc}
                            onChange={(e) => setFabricField(i, 'consumption_per_pc', e.target.value)}
                            inputProps={{ step: '0.0001', min: '0' }} sx={bomConsFieldSx('left')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <TextField size="small" fullWidth select value={row.unit}
                            onChange={(e) => setFabricField(i, 'unit', e.target.value)} sx={bomFieldSx('left')}>
                            {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                          </TextField>
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('left')}>
                        <Box sx={bomCellInner('left')}>
                          <TextField size="small" fullWidth value={row.total_consumption}
                            onChange={(e) => setFabricField(i, 'total_consumption', e.target.value)}
                            placeholder={totalQty ? 'Auto' : '—'}
                            sx={bomTotalFieldSx('left')} />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('center')}>
                        <Box sx={bomCellInner('center')}>
                          <InStockToggle
                            checked={isInStockRemark(row.remarks)}
                            onToggle={() => setFabricField(i, 'remarks', isInStockRemark(row.remarks) ? '' : IN_STOCK_REMARK)}
                          />
                        </Box>
                      </TableCell>
                      <TableCell sx={bodyCell('center')}>
                        <Box sx={{ ...bomCellInner('center'), gap: 0.25 }}>
                          <Tooltip title="Insert row below">
                            <IconButton size="small" color="primary" onClick={() => insertFabricRowAfter(i)}>
                              <Add fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove row">
                            <IconButton size="small" color="error" onClick={() => removeFabricRow(i)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Paper>

          {/* ── TRIMS & ACCESSORIES ── */}
      <Paper elevation={0} sx={{ p: 2.5, mb: 2.5, border: `1px solid ${slate[200]}`, borderRadius: 2, overflow: 'visible' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Box sx={{ flex: 1, minWidth: 160 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>Trims & Accessories</Typography>
              </Box>
              {canManageTrimsLibrary && (
              <Button size="small" variant="outlined" startIcon={<LibraryAdd />} onClick={() => openTrimModal(null)}
                sx={{ fontWeight: 700, textTransform: 'none', borderColor: '#7c3aed', color: '#7c3aed' }}>
                New Trim
              </Button>
              )}
              <Button size="small" variant="contained" startIcon={<Add />} onClick={addTrimRow}
                sx={{ fontWeight: 700, textTransform: 'none' }}>
                Add Row
              </Button>
            </Box>

            <Box sx={{ overflow: 'visible', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
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
                    const stockMatch = findMatchingInventoryItem(row, inventoryItems, trimsList);
                    const stockQty = stockMatch?.current_stock ?? row.matched_stock_qty;
                    const stockUnit = stockMatch?.unit ?? row.matched_stock_unit;
                    return (
                      <TableRow key={i} hover className={i % 2 === 1 ? 'trim-row--alt' : undefined}>
                        <TableCell sx={{ ...bodyCell('left'), verticalAlign: 'top', overflow: 'visible' }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, width: '100%', py: 0.25, overflow: 'visible' }}>
                            {/* Row 1 — Trim name */}
                            <Box>
                              <Typography sx={trimFieldLabelSx}>Trim Name *</Typography>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Autocomplete
                                  freeSolo
                                  options={trimsList}
                                  filterOptions={filterTrimNameOptions}
                                  getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
                                  inputValue={row.trim_name}
                                  onInputChange={(_, v) => setTrimField(i, 'trim_name', v.toUpperCase())}
                                  onChange={(_, v) => {
                                    if (!v || typeof v !== 'object') return;
                                    if (v.__create) openTrimModal(i, v.name);
                                    else selectTrimFromLibrary(i, v);
                                  }}
                                  sx={{ flex: 1, m: 0, minWidth: 0 }}
                                  renderOption={(props, o) => (
                                    o.__create ? (
                                      <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#7c3aed' }}>
                                        <LibraryAdd sx={{ fontSize: 17 }} />
                                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'inherit' }}>
                                          Create "{o.name}"
                                        </Typography>
                                      </Box>
                                    ) : (
                                      <Box component="li" {...props}>
                                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{o.name}</Typography>
                                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                                          {o.category && (
                                            <Chip label={o.category} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700 }} />
                                          )}
                                        </Box>
                                      </Box>
                                    )
                                  )}
                                  renderInput={(params) => (
                                    <TextField {...params} size="small" fullWidth placeholder="Search trim library or type name" sx={trimNameFieldSx('left')} />
                                  )}
                                />
                                <Tooltip title="Create new trim">
                                  <IconButton size="small" onClick={() => openTrimModal(i, row.trim_name)} sx={{ color: '#7c3aed', flexShrink: 0 }}>
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
                              <FormControlLabel
                                sx={{ mt: 0.5, ml: 0, display: 'flex' }}
                                control={
                                  <Checkbox
                                    size="small"
                                    checked={hasTrimParts(row)}
                                    onChange={(e) => toggleTrimParts(i, e.target.checked)}
                                    sx={{ p: 0.5 }}
                                  />
                                }
                                label={
                                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: slate[600] }}>
                                    Multi-part consumption (e.g. Hook &amp; Loop)
                                  </Typography>
                                }
                              />
                            </Box>

                            {/* Row 2 — Properties */}
                            <Box sx={{
                              pt: 1.25,
                              borderTop: `1px dashed ${slate[200]}`,
                              overflow: 'visible',
                              position: 'relative',
                              zIndex: 1,
                            }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                                <Typography sx={{ ...trimFieldLabelSx, mb: 0, flex: 1 }}>Properties</Typography>
                                {addPropRow !== i && (
                                  <Button
                                    size="small"
                                    onClick={() => openAddProperty(i)}
                                    sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'none', p: 0, minWidth: 0 }}
                                  >
                                    + Add property type
                                  </Button>
                                )}
                              </Box>
                              {schema.length > 0 ? (
                                <Box sx={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                                  gap: 1,
                                  alignItems: 'start',
                                  overflow: 'visible',
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
                                        minWidth: isColorProp ? 180 : 0,
                                        width: '100%',
                                        position: 'relative',
                                        gridColumn: isColorProp ? 'span 2' : 'auto',
                                      }}
                                    >
                                      <Typography sx={{
                                        fontSize: '0.68rem',
                                        fontWeight: 600,
                                        color: slate[600],
                                        mb: 0.35,
                                        lineHeight: 1.2,
                                        whiteSpace: 'normal',
                                        overflow: 'visible',
                                        textOverflow: 'clip',
                                        wordBreak: 'break-word',
                                      }}
                                      title={formatTrimPropertyLabel(prop)}
                                      >
                                        {prop.name}{prop.unit ? ` (${prop.unit})` : ''}
                                      </Typography>
                                      {isColorProp ? (
                                        <ColorFreeSelect
                                          value={propValue}
                                          options={piColorOptions}
                                          onChange={(v) => setTrimPropertyValue(i, prop.name, v)}
                                          fieldSx={bomMultilineFieldSx('left')}
                                          placeholder="Select or type color"
                                          multiline
                                        />
                                      ) : isGarmentSizeProp ? (
                                        <Autocomplete
                                          freeSolo
                                          options={piSizeOptions}
                                          value={propValue}
                                          onChange={(_, v) => setTrimPropertyValue(i, prop.name, v || '')}
                                          onInputChange={(_, v, reason) => {
                                            if (reason === 'input' || reason === 'clear') {
                                              setTrimPropertyValue(i, prop.name, v);
                                            }
                                          }}
                                          PopperComponent={AutocompleteSelectPopper}
                                          PaperComponent={AutocompleteMenuPaper}
                                          ListboxProps={autocompleteSelectListboxProps}
                                          forcePopupIcon
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
                                        inputProps={{
                                          ...(isNumericProp ? { min: 0, step: /^gsm$/i.test(String(prop.name).trim()) ? '0.01' : '1' } : {}),
                                          style: { textAlign: 'left' },
                                        }}
                                        sx={trimPropFieldSx('left')}
                                      />
                                      )}
                                    </Box>
                                    );
                                  })}
                                </Box>
                              ) : addPropRow !== i ? (
                                <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled', fontStyle: 'italic' }}>
                                  No properties yet — add Width, Color, or any custom type.
                                </Typography>
                              ) : null}

                              {addPropRow === i && (
                                <Box sx={{
                                  mt: 1,
                                  p: 1,
                                  borderRadius: 1,
                                  border: `1px solid ${slate[200]}`,
                                  bgcolor: alpha('#fff', 0.9),
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: 1,
                                  alignItems: 'flex-end',
                                }}>
                                  <Box sx={{ flex: '1 1 140px', minWidth: 120 }}>
                                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: slate[600], mb: 0.35 }}>
                                      Property type
                                    </Typography>
                                    <Autocomplete
                                      freeSolo
                                      size="small"
                                      options={TRIM_PROPERTY_NAME_SUGGESTIONS.filter(
                                        (n) => !schema.some((p) => String(p.name).toLowerCase() === n.toLowerCase()),
                                      )}
                                      value={newPropName}
                                      onChange={(_, v) => setNewPropName(typeof v === 'string' ? v : v || '')}
                                      onInputChange={(_, v) => setNewPropName(v)}
                                      renderInput={(params) => (
                                        <TextField {...params} size="small" placeholder="Width, Pantone…" sx={trimPropFieldSx('left')} />
                                      )}
                                    />
                                  </Box>
                                  <Box sx={{ width: 110 }}>
                                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: slate[600], mb: 0.35 }}>
                                      Unit
                                    </Typography>
                                    <Autocomplete
                                      freeSolo
                                      size="small"
                                      disabled={isNumericTrimProperty(newPropName)}
                                      options={TRIM_UNIT_OPTIONS}
                                      value={isNumericTrimProperty(newPropName) ? '' : newPropUnit}
                                      onChange={(_, v) => setNewPropUnit(typeof v === 'string' ? v : v || '')}
                                      onInputChange={(_, v) => setNewPropUnit(v)}
                                      renderInput={(params) => (
                                        <TextField
                                          {...params}
                                          size="small"
                                          placeholder={isNumericTrimProperty(newPropName) ? '—' : 'MM, CMS…'}
                                          sx={trimPropFieldSx('left')}
                                        />
                                      )}
                                    />
                                  </Box>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={addingProp || !newPropName.trim()}
                                    onClick={() => commitAddProperty(i)}
                                    sx={{ fontWeight: 700, textTransform: 'none', height: TRIM_PROP_FIELD_H }}
                                  >
                                    {addingProp ? 'Adding…' : 'Add'}
                                  </Button>
                                  <Button
                                    size="small"
                                    disabled={addingProp}
                                    onClick={cancelAddProperty}
                                    sx={{ fontWeight: 700, textTransform: 'none', height: TRIM_PROP_FIELD_H }}
                                  >
                                    Cancel
                                  </Button>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell sx={{
                          ...bodyCell('left'),
                          verticalAlign: 'middle',
                          overflow: 'visible !important',
                          whiteSpace: 'normal',
                        }}>
                          <Box sx={{
                            ...bomCellInner('left'),
                            overflow: 'visible',
                            alignItems: 'center',
                            py: 0.75,
                            minHeight: 0,
                          }}>
                            <SupplierAutocomplete
                              compact
                              suppliers={suppliers}
                              value={row.supplier || null}
                              onChange={(id) => {
                                const s = id ? suppliers.find((x) => x.id === id) : null;
                                const hint = (row.trim_name || row.category || '').trim();
                                setTrimLines((prev) => {
                                  const next = [...prev];
                                  next[i] = {
                                    ...next[i],
                                    supplier: id,
                                    supplier_name: s?.name || '',
                                    supplier_country: s?.country || '',
                                  };
                                  return next;
                                });
                                if (id && hint) {
                                  setSuppliers((prev) => prev.map((sup) => {
                                    if (sup.id !== id) return sup;
                                    const existing = Array.isArray(sup.supplies_in) ? sup.supplies_in : [];
                                    if (existing.some((x) => String(x).toLowerCase() === hint.toLowerCase())) {
                                      return sup;
                                    }
                                    return { ...sup, supplies_in: [...existing, hint] };
                                  }));
                                }
                              }}
                              onSuppliersChange={setSuppliers}
                              suppliesInHint={row.trim_name || row.category || ''}
                              placeholder="Supplier…"
                              TextFieldProps={{ sx: supplierFieldSx }}
                            />
                          </Box>
                        </TableCell>
                        {hasTrimParts(row) ? (
                          <TableCell colSpan={4} sx={{ ...bodyCell('left'), verticalAlign: 'top' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%', py: 0.75 }}>
                              <Box sx={{ display: 'flex', gap: 0.75, px: 0.25 }}>
                                <Typography sx={{ ...trimPartColHeadSx, width: 88 }}>Part</Typography>
                                <Typography sx={{ ...trimPartColHeadSx, flex: 1.4, textAlign: 'left' }}>Cons./pc</Typography>
                                <Typography sx={{ ...trimPartColHeadSx, width: 80, textAlign: 'left' }}>Unit</Typography>
                                <Box sx={{ width: 28, flexShrink: 0 }} />
                              </Box>
                              {row.parts.map((part, pIdx) => (
                                <Box key={pIdx} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <TextField size="small" value={part.label}
                                    onChange={(e) => setTrimPartField(i, pIdx, 'label', e.target.value)}
                                    placeholder="Hook"
                                    sx={{ ...bomFieldSx('left'), width: 88, flexShrink: 0 }} />
                                  <TextField size="small" type="number" value={part.consumption_per_pc}
                                    onChange={(e) => setTrimPartField(i, pIdx, 'consumption_per_pc', e.target.value)}
                                    inputProps={{ step: '0.0001', min: '0' }} sx={{ ...bomConsFieldSx('left'), flex: 1.4 }} />
                                  <TextField size="small" select value={part.unit}
                                    onChange={(e) => setTrimPartField(i, pIdx, 'unit', e.target.value)}
                                    sx={{ ...bomFieldSx('left'), width: 80, flexShrink: 0 }}>
                                    {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                  </TextField>
                                  <IconButton size="small" color="error" onClick={() => removeTrimPart(i, pIdx)} sx={{ width: 28, flexShrink: 0 }}>
                                    <Delete sx={{ fontSize: 15 }} />
                                  </IconButton>
                                </Box>
                              ))}
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.25 }}>
                                <Button size="small" onClick={() => addTrimPart(i)}
                                  sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'none', p: 0, minWidth: 0 }}>
                                  + Add part
                                </Button>
                              </Box>
                            </Box>
                          </TableCell>
                        ) : (
                          <>
                            <TableCell sx={bodyCell('left')}>
                              <Box sx={bomCellInner('left')}>
                                <TextField size="small" fullWidth type="number" value={row.consumption_per_pc}
                                  onChange={(e) => setTrimField(i, 'consumption_per_pc', e.target.value)}
                                  inputProps={{ step: '0.0001', min: '0' }} sx={bomConsFieldSx('left')} />
                              </Box>
                            </TableCell>
                            <TableCell sx={bodyCell('left')}>
                              <Box sx={bomCellInner('left')}>
                                <TextField size="small" fullWidth select value={row.unit}
                                  onChange={(e) => setTrimField(i, 'unit', e.target.value)} sx={bomFieldSx('left')}>
                                  {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                </TextField>
                              </Box>
                            </TableCell>
                            <TableCell sx={bodyCell('left')}>
                              <Box sx={bomCellInner('left')}>
                                <TextField size="small" fullWidth value={row.total_consumption}
                                  onChange={(e) => setTrimField(i, 'total_consumption', e.target.value)}
                                  sx={bomTotalFieldSx('left')} />
                              </Box>
                            </TableCell>
                            <TableCell sx={bodyCell('left')}>
                              <Box sx={bomCellInner('left')}>
                                <TextField size="small" fullWidth select value={row.total_unit || row.unit}
                                  onChange={(e) => setTrimField(i, 'total_unit', e.target.value)} sx={bomFieldSx('left')}>
                                  {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                </TextField>
                              </Box>
                            </TableCell>
                          </>
                        )}
                        <TableCell sx={bodyCell('center')}>
                          <Box sx={{ ...bomCellInner('center'), flexDirection: 'column', minHeight: 'auto', py: 0.5 }}>
                            <InStockToggle
                              checked={isInStockRemark(row.remarks)}
                              stockQty={isInStockRemark(row.remarks) ? stockQty : ''}
                              stockUnit={isInStockRemark(row.remarks) ? stockUnit : ''}
                              onToggle={() => {
                                setTrimLines((prev) => {
                                  const next = [...prev];
                                  if (isInStockRemark(row.remarks)) {
                                    next[i] = {
                                      ...next[i],
                                      remarks: '',
                                      matched_stock_qty: '',
                                      matched_stock_unit: '',
                                    };
                                  } else if (stockMatch) {
                                    next[i] = applyInventoryStockRemark(next[i], inventoryItems, trimsList);
                                  } else {
                                    next[i] = {
                                      ...next[i],
                                      remarks: IN_STOCK_REMARK,
                                      matched_stock_qty: '',
                                      matched_stock_unit: '',
                                    };
                                  }
                                  return next;
                                });
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell sx={bodyCell('center')}>
                          <Box sx={{ ...bomCellInner('center'), gap: 0.25 }}>
                            <Tooltip title="Insert row below">
                              <IconButton size="small" color="primary" onClick={() => insertTrimRowAfter(i)}>
                                <Add fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Remove row">
                              <IconButton size="small" color="error" onClick={() => removeTrimRow(i)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
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

      {/* ── Bottom actions ── */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 1.5,
        flexWrap: 'wrap',
        py: 2,
        px: { xs: 0, sm: 0.5 },
        mb: 1,
        borderTop: `1px solid ${slate[200]}`,
      }}>
        {!isNew && (
          <Button startIcon={<Print />} variant="outlined" size="small"
            onClick={() => window.print()}
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

      <AddTrimModal
        open={trimModalOpen}
        initialName={trimModalInitialName}
        onClose={() => { setTrimModalOpen(false); setTrimModalTargetRow(null); setTrimModalInitialName(''); }}
        onSaved={handleTrimCreated}
      />

      {/* ── Hidden print root (hidden on screen via PRINT_STYLE, not display:none) ── */}
      <Box id="indent-print-root">
        <IndentDocument
          pi={pi}
          selectedLines={activeLines}
          indent={{
            indent_number: indentNumber,
            indent_date: indentDate,
            prepared_by: preparedBy,
            received_by: receivedBy,
            approved_by: approvedBy,
          }}
          fabricLines={fabricLines}
          trimLines={trimLines}
          company={company}
          suppliers={suppliers}
          trimsList={trimsList}
        />
      </Box>
    </Box>
  );
}
