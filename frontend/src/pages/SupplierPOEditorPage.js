import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Typography, TextField, MenuItem, Grid, Paper,
  IconButton, Autocomplete, CircularProgress, Table, TableHead,
  TableBody, TableRow, TableCell, Divider, FormControlLabel, Radio, RadioGroup,
  InputAdornment, Tooltip, Chip, ToggleButton, ToggleButtonGroup, Popover,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowBack, Save, Print, Add, Delete, LocalShipping, Sync,
  Storefront, ReceiptLong, PinDrop, LibraryAdd, Checkroom, Category,
} from '@mui/icons-material';
import { ordersAPI, procurementAPI, suppliersAPI, companyAPI } from '../services/api';
import { slate, sectionPaperSxByIndex, warm } from '../theme/appTheme';
import { resolveTaxModeFromStates } from '../utils/gstSupplyType';
import { formatDateDisplay } from '../utils/formatDate';
import {
  isNumericTrimProperty,
  isCartonDimUnitProperty,
  isCartonDimensionsProperty,
  TRIM_UNIT_OPTIONS,
} from '../components/trims/trimConstants';
import SupplierPOPrintDocument, { SUPPLIER_PO_PRINT_STYLE } from '../components/procurement/SupplierPOPrintDocument';
import AddTrimModal from '../components/trims/AddTrimModal';
import AddSupplierModal from '../components/suppliers/AddSupplierModal';

const DEFAULT_COMMENTS = `This purchase order is subject to seller's acceptance of the attached terms and conditions.
Please sign below and return acknowledgement of this purchase order. Please notify us immediately if you are unable to supply.`;

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const isFabricCategory = (category) => /^fabric$/i.test(String(category || '').trim());

const FABRIC_PO_NAME = 'Fabric';
const FABRIC_PO_PROPERTY_FIELDS = [
  'Fabric Material Composition',
  'Fabric Weight',
  'Finish / Coating',
  'Width',
  'Color',
  'Certification',
];

const emptyFabricPropertyValues = () => {
  const vals = {};
  FABRIC_PO_PROPERTY_FIELDS.forEach((name) => { vals[name] = ''; });
  return vals;
};

const isStandardFabricProperty = (name) => FABRIC_PO_PROPERTY_FIELDS.includes(name);
const PI_FABRIC_KEY_FIELD = '_pi_fabric_key';

const formatFabricPropertyLabel = (propertyValues, customFields = [], piFabricOptionKey = '') => {
  const lines = [];
  const emit = (name) => {
    const value = propertyValues?.[name];
    if (value == null || String(value).trim() === '') return;
    lines.push(`${name}: ${String(value).trim()}`);
  };
  FABRIC_PO_PROPERTY_FIELDS.forEach(emit);
  customFields.forEach(emit);
  Object.keys(propertyValues || {}).forEach((name) => {
    if (isStandardFabricProperty(name) || customFields.includes(name)) return;
    emit(name);
  });
  if (piFabricOptionKey) lines.push(`${PI_FABRIC_KEY_FIELD}: ${piFabricOptionKey}`);
  return lines.join('\n');
};

const parseFabricPropertyLabel = (propertyLabel) => {
  const values = emptyFabricPropertyValues();
  const customFields = [];
  let piFabricOptionKey = '';
  const label = (propertyLabel || '').trim();
  if (!label) return { values, customFields, piFabricOptionKey };
  label.split('\n').forEach((line) => {
    const trimmed = line.trim();
    const sep = trimmed.indexOf(':');
    if (sep === -1) return;
    const name = trimmed.slice(0, sep).trim();
    const value = trimmed.slice(sep + 1).trim();
    if (!name) return;
    if (name === PI_FABRIC_KEY_FIELD) {
      piFabricOptionKey = value;
      return;
    }
    values[name] = value;
    if (!isStandardFabricProperty(name) && !customFields.includes(name)) {
      customFields.push(name);
    }
  });
  return { values, customFields, piFabricOptionKey };
};

const matchPiFabricOption = (row, options) => {
  if (!options?.length) return null;
  if (row?.pi_fabric_option_key) {
    const byKey = options.find((o) => o._optionKey === row.pi_fabric_option_key);
    if (byKey) return byKey;
  }
  const pv = row?.property_values || {};
  const comp = String(pv['Fabric Material Composition'] || '').trim().toLowerCase();
  if (!comp) return null;
  return options.find((o) => {
    const mapped = mapPiFabricToPropertyValues(o);
    if (String(mapped['Fabric Material Composition'] || '').trim().toLowerCase() !== comp) return false;
    const color = String(pv.Color || '').trim().toLowerCase();
    const matchColor = String(mapped.Color || '').trim().toLowerCase();
    if (color && matchColor && color !== matchColor) return false;
    const weight = String(pv['Fabric Weight'] || '').trim().toLowerCase();
    const matchWeight = String(mapped['Fabric Weight'] || '').trim().toLowerCase();
    if (weight && matchWeight && weight !== matchWeight) return false;
    return true;
  }) || null;
};

const mapPiFabricToPropertyValues = (line) => ({
  'Fabric Material Composition': line?.material || '',
  'Fabric Weight': line?.gsm ? `${line.gsm} GSM` : '',
  'Finish / Coating': '',
  'Width': line?.roll_width ? `${line.roll_width} CMS` : '',
  'Color': line?.color || '',
  'Certification': '',
});

const emptyLine = (serial = 1, { unit = 'PCS', fabric = false } = {}) => ({
  serial_no: serial,
  trim: null,
  particulars: fabric ? FABRIC_PO_NAME : '',
  property_values: fabric ? emptyFabricPropertyValues() : {},
  fabric_custom_fields: fabric ? [] : [],
  pi_fabric_option_key: '',
  property_label: '',
  from_pi: false,
  hsn_code: '',
  quantity_ordered: '',
  unit: fabric ? 'MTRS' : unit,
  unit_price: '',
  notes: '',
});

const initPropertyValues = (properties) => {
  const vals = {};
  (properties || []).forEach((p) => { if (p.name) vals[p.name] = ''; });
  return vals;
};

const isPiSourcedLabel = (label) =>
  Boolean(label && (label.includes('PI Qty:') || label.includes('Order Qty:') || label.includes('Cons./pc:')));

const formatQty = (n) => {
  const num = parseFloat(n);
  if (Number.isNaN(num)) return '';
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const formatPropertyEntry = (propName, value, trimMaster) => {
  if (value == null || String(value).trim() === '') return null;
  const schema = (trimMaster?.properties || []).find((p) => p.name === propName);
  const unit = schema?.unit;
  if (unit && !isNumericTrimProperty(propName)) {
    return `${propName}: ${value} ${unit}`;
  }
  return `${propName}: ${value}`;
};

const formatPiTrimProperties = (line, trimMaster) => {
  const pv = line?.property_values || {};
  const schema = trimMaster?.properties || [];
  const parts = [];

  schema.forEach((prop) => {
    const entry = formatPropertyEntry(prop.name, pv[prop.name], trimMaster);
    if (entry) parts.push(entry);
  });

  Object.entries(pv).forEach(([k, v]) => {
    if (!schema.some((p) => p.name === k)) {
      const entry = formatPropertyEntry(k, v, trimMaster);
      if (entry) parts.push(entry);
    }
  });

  if (parts.length) return parts.join(' · ');
  return [line?.color_variant, line?.size_variant].filter(Boolean).join(' / ');
};

/**
 * Reverses formatPiTrimProperties()'s "Name: Value Unit · Name2: Value2" string back into a
 * { propName: value } map, so previously-saved property values can repopulate the editable
 * fields when a saved PO is reopened. Without this, re-editing a line drops any property the
 * user doesn't retype, because the fields would otherwise start blank.
 */
const parsePropertyLabelToValues = (propertyLabel, trimMaster) => {
  const values = {};
  const label = (propertyLabel || '').trim();
  if (!label) return values;
  const schema = trimMaster?.properties || [];
  label.split('·').forEach((part) => {
    const trimmed = part.trim();
    const sep = trimmed.indexOf(':');
    if (sep === -1) return;
    const name = trimmed.slice(0, sep).trim();
    let value = trimmed.slice(sep + 1).trim();
    const propSchema = schema.find((p) => p.name === name);
    if (propSchema?.unit && !isNumericTrimProperty(name)) {
      const unitSuffix = ` ${propSchema.unit}`;
      if (value.endsWith(unitSuffix)) {
        value = value.slice(0, -unitSuffix.length).trim();
      }
    }
    values[name] = value;
  });
  return values;
};

const resolvePiTrimOrderQty = (line, piTotalPcs) => {
  const total = parseFloat(line?.total_consumption);
  if (!Number.isNaN(total) && total > 0) return String(total);
  const cons = parseFloat(line?.consumption_per_pc);
  const pcs = parseFloat(piTotalPcs);
  if (!Number.isNaN(cons) && !Number.isNaN(pcs) && pcs > 0) {
    return String(parseFloat((cons * pcs).toFixed(4)));
  }
  return '';
};

const formatPiTrimConsumption = (line, trimMaster, piTotalPcs) => {
  const unit = line?.unit || trimMaster?.default_unit || '';
  const parts = [];
  if (line?.consumption_per_pc != null && String(line.consumption_per_pc).trim() !== '') {
    parts.push(`Cons./pc: ${formatQty(line.consumption_per_pc)} ${unit}`.trim());
  }
  if (piTotalPcs > 0) {
    parts.push(`PI Qty: ${formatQty(piTotalPcs)} pcs`);
  }
  const orderQty = resolvePiTrimOrderQty(line, piTotalPcs);
  if (orderQty) {
    parts.push(`Order Qty: ${formatQty(orderQty)} ${unit}`.trim());
  }
  return parts.join(' · ');
};

const buildPiTrimDisplay = (line, trimMaster) => {
  const piTotalPcs = line?._piTotalPcs ?? 0;
  const properties = formatPiTrimProperties(line, trimMaster);
  const consumption = formatPiTrimConsumption(line, trimMaster, piTotalPcs);
  const summary = [properties, consumption].filter(Boolean).join('\n');
  return {
    properties,
    consumption,
    summary,
    orderQty: resolvePiTrimOrderQty(line, piTotalPcs),
    unit: line?.unit || trimMaster?.default_unit || 'PCS',
    piTotalPcs,
  };
};

const formatPiTrimOptionLabel = (line, trimMaster) => {
  const name = line?.trim_name || trimMaster?.name || 'Trim';
  const props = formatPiTrimProperties(line, trimMaster);
  return props ? `${name} — ${props}` : name;
};

function PiTrimOptionContent({ line, trimMaster }) {
  const display = buildPiTrimDisplay(line, trimMaster);
  const name = line.trim_name || trimMaster?.name || 'Trim';

  return (
    <Box sx={{ py: 0.5, width: '100%' }}>
      <Typography sx={{ fontSize: '0.84rem', fontWeight: 800, color: slate[800], lineHeight: 1.3 }}>
        {name}
      </Typography>
      {display.properties && (
        <Typography sx={{ fontSize: '0.72rem', color: slate[700], mt: 0.5, lineHeight: 1.45, fontWeight: 600 }}>
          {display.properties}
        </Typography>
      )}
      {display.consumption && (
        <Typography sx={{ fontSize: '0.68rem', color: '#0f766e', mt: 0.35, lineHeight: 1.4, fontWeight: 700 }}>
          {display.consumption}
        </Typography>
      )}
      {line._indentNumber && (
        <Typography sx={{ fontSize: '0.62rem', color: slate[400], mt: 0.35 }}>
          {line._indentNumber}
        </Typography>
      )}
    </Box>
  );
}

const formatPiFabricProperties = (line) => {
  const parts = [];
  if (line?.color) parts.push(`Color: ${line.color}`);
  if (line?.gsm) parts.push(`GSM: ${line.gsm}`);
  if (line?.roll_width) parts.push(`Roll Width: ${line.roll_width} CMS`);
  return parts.join(' · ');
};

const formatPiFabricConsumption = (line, piTotalPcs) => {
  const unit = line?.unit || 'MTRS';
  const parts = [];
  if (line?.consumption_per_pc != null && String(line.consumption_per_pc).trim() !== '') {
    parts.push(`Cons./pc: ${formatQty(line.consumption_per_pc)} ${unit}`.trim());
  }
  if (piTotalPcs > 0) {
    parts.push(`PI Qty: ${formatQty(piTotalPcs)} pcs`);
  }
  const orderQty = resolvePiTrimOrderQty(line, piTotalPcs);
  if (orderQty) {
    parts.push(`Order Qty: ${formatQty(orderQty)} ${unit}`.trim());
  }
  return parts.join(' · ');
};

const buildPiFabricDisplay = (line) => {
  const piTotalPcs = line?._piTotalPcs ?? 0;
  const properties = formatPiFabricProperties(line);
  const consumption = formatPiFabricConsumption(line, piTotalPcs);
  const summary = [properties, consumption, line?.remarks ? `Remarks: ${line.remarks}` : ''].filter(Boolean).join('\n');
  return {
    properties,
    consumption,
    summary,
    orderQty: resolvePiTrimOrderQty(line, piTotalPcs),
    unit: line?.unit || 'MTRS',
    piTotalPcs,
  };
};

const formatPiFabricOptionLabel = (line) => {
  const name = line?.material || 'Fabric';
  const props = formatPiFabricProperties(line);
  return props ? `${name} — ${props}` : name;
};

function PiFabricOptionContent({ line }) {
  const display = buildPiFabricDisplay(line);
  const name = line.material || 'Fabric';

  return (
    <Box sx={{ py: 0.5, width: '100%' }}>
      <Typography sx={{ fontSize: '0.84rem', fontWeight: 800, color: slate[800], lineHeight: 1.3 }}>
        {name}
      </Typography>
      {display.properties && (
        <Typography sx={{ fontSize: '0.72rem', color: slate[700], mt: 0.5, lineHeight: 1.45, fontWeight: 600 }}>
          {display.properties}
        </Typography>
      )}
      {display.consumption && (
        <Typography sx={{ fontSize: '0.68rem', color: '#0f766e', mt: 0.35, lineHeight: 1.4, fontWeight: 700 }}>
          {display.consumption}
        </Typography>
      )}
      {line._indentNumber && (
        <Typography sx={{ fontSize: '0.62rem', color: slate[400], mt: 0.35 }}>
          {line._indentNumber}
        </Typography>
      )}
    </Box>
  );
}

function LibraryTrimOptionContent({ trim }) {
  const propNames = (trim.properties || []).map((p) => p.name).filter(Boolean);
  return (
    <Box sx={{ py: 0.5, width: '100%' }}>
      <Typography sx={{ fontSize: '0.84rem', fontWeight: 800, color: slate[800], lineHeight: 1.3 }}>
        {trim.name}
      </Typography>
      <Typography sx={{ fontSize: '0.68rem', color: slate[500], mt: 0.35 }}>
        Trim library{trim.category ? ` · ${trim.category}` : ''}
        {propNames.length ? ` · enter ${propNames.join(', ')} after selecting` : ' · add specification after selecting'}
      </Typography>
    </Box>
  );
}

/** Slim per-row hover strip between PO line items — click anywhere to insert a new line below. */
function AddRowDivider({ onAdd }) {
  const [hover, setHover] = useState(false);
  return (
    <TableRow onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <TableCell colSpan={7} sx={{ p: 0, border: 'none' }}>
        <Box
          onClick={onAdd}
          sx={{
            height: hover ? 24 : 7,
            cursor: 'pointer',
            transition: 'height 0.14s ease, background-color 0.14s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `repeating-linear-gradient(45deg, ${alpha('#4f46e5', hover ? 0.22 : 0.1)} 0px, ${alpha('#4f46e5', hover ? 0.22 : 0.1)} 5px, ${alpha('#4f46e5', hover ? 0.08 : 0.02)} 5px, ${alpha('#4f46e5', hover ? 0.08 : 0.02)} 10px)`,
          }}
        >
          {hover && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, color: '#4338ca' }}>
              <Add sx={{ fontSize: 14 }} />
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                Add line
              </Typography>
            </Box>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}

function FabricPiPickControl({ row, options, loading, piSelected, onSelect }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const selected = matchPiFabricOption(row, options);
  const pickDisabled = !piSelected || loading || options.length === 0;
  const pickTitle = !piSelected
    ? 'Select a PI in order details first'
    : loading
      ? 'Loading fabric lines from PI…'
      : options.length === 0
        ? 'No fabric lines found on PI indent'
        : 'Pre-fill from a PI indent fabric line — you can still edit values below';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
      <Typography sx={{ fontWeight: 800, fontSize: '0.84rem', textTransform: 'uppercase', color: slate[800] }}>
        {FABRIC_PO_NAME}
      </Typography>
      <Tooltip title={pickTitle}>
        <span>
          <Button
            size="small"
            variant="outlined"
            disabled={pickDisabled}
            startIcon={loading ? <CircularProgress size={12} /> : <ReceiptLong sx={{ fontSize: 15 }} />}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.72rem',
              py: 0.2,
              px: 1,
              minHeight: 28,
              borderRadius: 1.5,
              borderColor: alpha('#0f766e', 0.45),
              color: '#0f766e',
              '&:hover': { borderColor: '#0f766e', bgcolor: alpha('#0f766e', 0.06) },
            }}
          >
            Pick from PI indent
          </Button>
        </span>
      </Tooltip>
      {selected && (
        <Chip
          size="small"
          variant="outlined"
          label={`PI: ${formatPiFabricOptionLabel(selected)}`}
          sx={{
            maxWidth: 240,
            height: 24,
            fontSize: '0.65rem',
            fontWeight: 600,
            borderColor: alpha('#0f766e', 0.35),
            color: '#0f766e',
            '& .MuiChip-label': { px: 1 },
          }}
        />
      )}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{ sx: { mt: 0.5, borderRadius: 1.5, width: { xs: 320, sm: 420 } } }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: slate[600], mb: 1 }}>
            Select a fabric line to pre-fill — edit any field after picking
          </Typography>
          <Autocomplete
            autoFocus
            openOnFocus
            options={options}
            loading={loading}
            groupBy={() => 'From PI indent — Fabric'}
            getOptionLabel={(o) => formatPiFabricOptionLabel(o)}
            isOptionEqualToValue={(o, v) => o._optionKey === v._optionKey}
            value={selected}
            onChange={(_, v) => {
              if (v && v._kind === 'fabric') {
                onSelect(v);
                setAnchorEl(null);
              }
            }}
            renderOption={(props, option) => (
              <Box component="li" {...props} key={option._optionKey}>
                <PiFabricOptionContent line={option} />
              </Box>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                fullWidth
                placeholder="Search PI fabric…"
                sx={{ '& .MuiInputBase-root': { borderRadius: 1.5 } }}
              />
            )}
          />
        </Box>
      </Popover>
    </Box>
  );
}

function FabricPropertyFields({ row, onChange, onAddProperty, onRemoveProperty, onRenameProperty }) {
  const customFields = row.fabric_custom_fields || [];
  return (
    <Box sx={{ mt: 1.25 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, rowGap: 1.5 }}>
        {FABRIC_PO_PROPERTY_FIELDS.map((name) => (
          <TextField
            key={name}
            size="small"
            label={name}
            value={row.property_values?.[name] || ''}
            onChange={(e) => onChange(name, e.target.value)}
            sx={{ flex: '1 1 180px', minWidth: 150, '& .MuiInputBase-root': { borderRadius: 1.5 } }}
          />
        ))}
      </Box>
      {customFields.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {customFields.map((name) => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
              <TextField
                size="small"
                label="Property name"
                value={name}
                onChange={(e) => onRenameProperty(name, e.target.value)}
                sx={{ flex: '1 1 160px', minWidth: 130, '& .MuiInputBase-root': { borderRadius: 1.5 } }}
              />
              <TextField
                size="small"
                label="Value"
                value={row.property_values?.[name] || ''}
                onChange={(e) => onChange(name, e.target.value)}
                sx={{ flex: '2 1 200px', minWidth: 150, '& .MuiInputBase-root': { borderRadius: 1.5 } }}
              />
              <Tooltip title="Remove property">
                <IconButton size="small" color="error" onClick={() => onRemoveProperty(name)} sx={{ mt: 0.25 }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}
      <Button
        size="small"
        startIcon={<Add />}
        onClick={onAddProperty}
        sx={{ mt: 1.25, textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}
      >
        Add property
      </Button>
    </Box>
  );
}

function TrimPropertyFields({ row, trimMaster, onChange }) {
  const props = trimMaster?.properties || [];
  if (!props.length) {
    return (
      <TextField
        size="small"
        fullWidth
        label="Specification"
        placeholder="e.g. Color, size, variant…"
        value={row.property_values?.Spec || ''}
        onChange={(e) => onChange('Spec', e.target.value)}
        sx={{ '& .MuiInputBase-root': { borderRadius: 1.5 } }}
      />
    );
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, rowGap: 1.5 }}>
      {props.map((prop) => {
        if (isCartonDimUnitProperty(prop.name)) {
          return (
            <Autocomplete
              key={prop.name}
              freeSolo
              options={TRIM_UNIT_OPTIONS}
              value={row.property_values?.[prop.name] || ''}
              onInputChange={(_, v) => onChange(prop.name, v)}
              onChange={(_, v) => onChange(prop.name, v || '')}
              sx={{ flex: '1 1 130px', minWidth: 110 }}
              renderInput={(params) => (
                <TextField {...params} size="small" label="Dim. Unit" sx={{ '& .MuiInputBase-root': { borderRadius: 1.5 } }} />
              )}
            />
          );
        }
        const label = isCartonDimensionsProperty(prop.name)
          ? 'Dimensions (L × W × H)'
          : (prop.unit ? `${prop.name} (${prop.unit})` : prop.name);
        return (
          <TextField
            key={prop.name}
            size="small"
            label={label}
            value={row.property_values?.[prop.name] || ''}
            onChange={(e) => onChange(prop.name, e.target.value)}
            type={isNumericTrimProperty(prop.name) ? 'number' : 'text'}
            inputProps={isNumericTrimProperty(prop.name) ? { min: 0, step: '1' } : undefined}
            sx={{ flex: '1 1 130px', minWidth: 110, '& .MuiInputBase-root': { borderRadius: 1.5 } }}
          />
        );
      })}
    </Box>
  );
}

const parseParticulars = (text) => {
  const raw = (text || '').trim();
  if (!raw) return { name: '', property_label: '' };
  const nl = raw.indexOf('\n');
  if (nl === -1) return { name: raw, property_label: '' };
  return {
    name: raw.slice(0, nl).trim(),
    property_label: raw.slice(nl + 1).trim(),
  };
};

const buildParticularsForSave = (row, fabricMode = false) => {
  if (fabricMode) {
    const props = formatFabricPropertyLabel(row.property_values, row.fabric_custom_fields, row.pi_fabric_option_key);
    return props ? `${FABRIC_PO_NAME}\n${props}` : FABRIC_PO_NAME;
  }
  const name = (row.particulars || '').trim();
  const props = (row.property_label || '').trim();
  if (name && props) return `${name}\n${props}`;
  return name || props;
};

const monoFieldSx = {
  '& .MuiInputBase-input': {
    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
    fontSize: '0.875rem',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    letterSpacing: '0.02em',
  },
};

const clientFallbackPoNumber = () => {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  const fyEnd = fyStart + 1;
  const fy = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
  return `JBI/PO/${fy}/1`;
};

const emptyForm = () => ({
  po_number: '',
  supplier: null,
  vendor_name: '',
  vendor_address: '',
  vendor_email: '',
  vendor_phone: '',
  attention: '',
  bill_to: '',
  ship_to: '',
  pi: null,
  pi_number: '',
  buyer_po: null,
  reference_number: '',
  order_date: new Date().toISOString().split('T')[0],
  expected_delivery_date: '',
  payment_terms: '',
  delivery_terms: '',
  transport_paid_by: '',
  tax_mode: 'CGST_SGST',
  cgst_percent: '9',
  sgst_percent: '9',
  igst_percent: '18',
  po_comments: DEFAULT_COMMENTS,
  order_placed_by: 'Shivangi Jain',
  supplier_ack_name: '',
  supplier_ack_date: '',
  status: 'DRAFT',
  notes: '',
  items: [emptyLine(1)],
});

const fmtAddr = (c) => [c?.legal_name || c?.trading_name, c?.address_line1, c?.address_line2,
  [c?.city, c?.region_state, c?.postal_code].filter(Boolean).join(', '),
  c?.country, c?.phone ? `Phone: ${c.phone}` : '',
  c?.tax_registration ? `GST: ${c.tax_registration}` : '',
].filter(Boolean).join('\n');

const resolveBillTo = (c) => (c?.bill_to?.trim() || fmtAddr(c));
const resolveShipTo = (c) => (c?.ship_to?.trim() || fmtAddr(c));

const supplierBlock = (f) => [
  f.vendor_name,
  f.vendor_address,
  f.attention ? `Attn: ${f.attention}` : '',
  f.vendor_phone ? `Phone: ${f.vendor_phone}` : '',
].filter(Boolean).join('\n');

const sectionLabelSx = {
  fontWeight: 800,
  fontSize: '0.68rem',
  color: 'text.secondary',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  mb: 0.75,
};

/** Extract lead days from delivery terms (e.g. "30", "30 days", "within 15 days"). */
const parseDeliveryDays = (terms) => {
  const text = String(terms || '').trim();
  if (!text) return null;
  const match = text.match(/(\d+)\s*(?:days?|d)?/i);
  if (!match) return null;
  const days = parseInt(match[1], 10);
  return Number.isFinite(days) && days >= 0 ? days : null;
};

const addDaysToIsoDate = (isoDate, days) => {
  if (!isoDate || days == null) return '';
  const [y, m, d] = String(isoDate).split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const OrderSectionTitle = ({ children }) => (
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
    {children}
  </Typography>
);

const PARTY_CARD_HEIGHT = 220;

const PARTY_THEMES = {
  supplier: {
    color: '#b45309',
    light: '#f59e0b',
    icon: Storefront,
    empty: 'Select a supplier above to preview vendor details',
  },
  billTo: {
    color: '#0f766e',
    light: '#14b8a6',
    icon: ReceiptLong,
    empty: 'Bill-to address not configured — set in Company details',
  },
  shipTo: {
    color: '#4338ca',
    light: '#6366f1',
    icon: PinDrop,
    empty: 'Ship-to address not configured — set in Company details',
  },
};

function PartyCard({ variant, title, text, hint }) {
  const theme = PARTY_THEMES[variant];
  const Icon = theme.icon;
  const hasContent = Boolean(text?.trim());

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${alpha(theme.color, 0.22)}`,
        overflow: 'hidden',
        height: PARTY_CARD_HEIGHT,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#fff',
        boxShadow: `0 2px 10px ${alpha(slate[900], 0.05)}`,
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
        '&:hover': {
          boxShadow: `0 6px 20px ${alpha(theme.color, 0.12)}`,
        },
      }}
    >
      <Box
        sx={{
          px: 1.75,
          py: 1.25,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          background: `linear-gradient(135deg, ${alpha(theme.light, 0.14)} 0%, ${alpha(theme.color, 0.06)} 100%)`,
          borderBottom: `1px solid ${alpha(theme.color, 0.15)}`,
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.color, 0.12),
            color: theme.color,
            border: `1px solid ${alpha(theme.color, 0.2)}`,
          }}
        >
          <Icon sx={{ fontSize: 18 }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', color: theme.color, letterSpacing: '0.03em' }}>
          {title}
        </Typography>
      </Box>
      <Box
        sx={{
          p: 1.75,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {hasContent ? (
          <Typography
            sx={{
              fontSize: '0.78rem',
              lineHeight: 1.55,
              whiteSpace: 'pre-line',
              color: slate[700],
              fontWeight: 500,
            }}
          >
            {text}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: '0.75rem', color: slate[400], fontStyle: 'italic', lineHeight: 1.5 }}>
            {theme.empty}
          </Typography>
        )}
      </Box>
      {hint && (
        <Box
          sx={{
            px: 1.75,
            py: 0.85,
            flexShrink: 0,
            bgcolor: alpha(theme.color, 0.04),
            borderTop: `1px solid ${alpha(theme.color, 0.1)}`,
          }}
        >
          <Typography sx={{ fontSize: '0.65rem', color: alpha(theme.color, 0.85), fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {hint}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

const lineTotal = (row) => {
  const q = parseFloat(row.quantity_ordered);
  const p = parseFloat(row.unit_price);
  if (Number.isNaN(q) || Number.isNaN(p)) return 0;
  return q * p;
};

const applyRoundOff = ({ subtotal, cgst, sgst, igst }) => {
  const rawTotal = subtotal + cgst + sgst + igst;
  const roundedTotal = Math.round(rawTotal);
  const roundOff = Math.round((roundedTotal - rawTotal) * 100) / 100;
  return { subtotal, cgst, sgst, igst, roundOff, total: roundedTotal };
};

const calcPreview = (form) => {
  const subtotal = form.items.reduce((s, r) => s + lineTotal(r), 0);
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
};

export default function SupplierPOEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isNew = id === 'new';
  const isFabricMode = (searchParams.get('mode') || '').toLowerCase() === 'fabric';
  const [fabricPoDetected, setFabricPoDetected] = useState(false);
  const effectiveFabricMode = isFabricMode || fabricPoDetected;
  const lineDefaults = useMemo(
    () => ({ unit: 'MTRS', fabric: effectiveFabricMode }),
    [effectiveFabricMode],
  );

  const setPoMode = (mode) => {
    if (!isNew) return;
    if (mode === 'fabric') setSearchParams({ mode: 'fabric' });
    else setSearchParams({});
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [suppliers, setSuppliers] = useState([]);
  const [trims, setTrims] = useState([]);
  const [piList, setPiList] = useState([]);
  const [buyerPoList, setBuyerPoList] = useState([]);
  const [company, setCompany] = useState(null);
  const [piTrimOptions, setPiTrimOptions] = useState([]);
  const [piTrimsLoading, setPiTrimsLoading] = useState(false);
  const [piTotalPcs, setPiTotalPcs] = useState(0);
  const [poNumberLoading, setPoNumberLoading] = useState(false);
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [trimModalTargetRow, setTrimModalTargetRow] = useState(null);
  const [trimModalInitialName, setTrimModalInitialName] = useState('');
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const defaultDocTitleRef = useRef(document.title);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'supplier-po-print-style';
    style.textContent = SUPPLIER_PO_PRINT_STYLE;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  // Browser uses document.title as the default PDF / print save name.
  useEffect(() => {
    const setPrintTitle = () => {
      const poNumber = form.po_number?.trim();
      if (poNumber) document.title = poNumber;
    };
    const restoreTitle = () => {
      document.title = defaultDocTitleRef.current;
    };
    window.addEventListener('beforeprint', setPrintTitle);
    window.addEventListener('afterprint', restoreTitle);
    return () => {
      window.removeEventListener('beforeprint', setPrintTitle);
      window.removeEventListener('afterprint', restoreTitle);
      restoreTitle();
    };
  }, [form.po_number]);

  const trimsMap = useMemo(() => {
    const m = {};
    trims.forEach((t) => { m[t.id] = t; });
    return m;
  }, [trims]);

  const loadPiTrims = useCallback(async (piId) => {
    if (!piId) {
      setPiTrimOptions([]);
      setPiTotalPcs(0);
      return;
    }
    setPiTrimsLoading(true);
    try {
      const [indentsRes, piRes] = await Promise.all([
        ordersAPI.getIndents({ pi: piId }),
        ordersAPI.getById(piId),
      ]);
      const indents = asList(indentsRes.data);
      const piLines = piRes.data?.lines || [];
      const totalPcs = piLines.reduce((s, l) => s + (Number(l.quantity_pcs) || 0), 0);
      setPiTotalPcs(totalPcs);

      if (!indents.length) {
        setPiTrimOptions([]);
        return;
      }

      const detailRes = await Promise.all(indents.map((ind) => ordersAPI.getIndent(ind.id)));
      const trimMasterById = {};
      trims.forEach((t) => { trimMasterById[t.id] = t; });

      // Trim and fabric lines are collected into separate passes (rather than interleaved
      // per-indent) so each kind stays contiguous in the options list — required for the
      // Autocomplete's groupBy to render "From PI indent — Trim" / "— Fabric" as two
      // distinct sections instead of repeating headers.
      const trimEntries = [];
      const fabricEntries = [];
      detailRes.forEach((res) => {
        const indent = res.data;
        (indent.trim_lines || []).forEach((tl, idx) => {
          const trimMaster = tl.trim ? trimMasterById[tl.trim] : null;
          trimEntries.push({
            ...tl,
            _kind: 'trim',
            _optionKey: `pi-trim-${indent.id}-${tl.id || idx}`,
            _indentNumber: indent.indent_number,
            _label: tl.trim_name || 'Trim',
            _trimMaster: trimMaster,
            _piTotalPcs: totalPcs,
          });
        });
        (indent.fabric_lines || []).forEach((fl, idx) => {
          fabricEntries.push({
            ...fl,
            _kind: 'fabric',
            _optionKey: `pi-fabric-${indent.id}-${fl.id || idx}`,
            _indentNumber: indent.indent_number,
            _label: fl.material || 'Fabric',
            _piTotalPcs: totalPcs,
          });
        });
      });
      setPiTrimOptions([...trimEntries, ...fabricEntries]);
    } catch (e) {
      console.error(e);
      setPiTrimOptions([]);
      setPiTotalPcs(0);
    } finally {
      setPiTrimsLoading(false);
    }
  }, [trims]);

  useEffect(() => {
    loadPiTrims(form.pi);
  }, [form.pi, loadPiTrims]);

  // Mode filter applies only when raising a new PO. Editing keeps the full picker so
  // existing fabric/trim lines remain selectable.
  const filteredPiOptions = useMemo(() => {
    if (!isNew && !effectiveFabricMode) return piTrimOptions;
    return effectiveFabricMode
      ? piTrimOptions.filter((o) => o._kind === 'fabric')
      : piTrimOptions.filter((o) => o._kind !== 'fabric');
  }, [piTrimOptions, effectiveFabricMode, isNew]);

  // Re-link saved fabric rows to PI indent options once PI fabric lines are loaded.
  useEffect(() => {
    if (!form.pi || !filteredPiOptions.length) return;
    setForm((f) => {
      let changed = false;
      const items = f.items.map((row) => {
        if (row.particulars !== FABRIC_PO_NAME) return row;
        const matched = matchPiFabricOption(row, filteredPiOptions);
        if (!matched) return row;
        if (row.pi_fabric_option_key === matched._optionKey && row.from_pi) return row;
        changed = true;
        return {
          ...row,
          pi_fabric_option_key: matched._optionKey,
          from_pi: true,
        };
      });
      return changed ? { ...f, items } : f;
    });
  }, [form.pi, filteredPiOptions]);

  const filteredLibraryTrims = useMemo(() => {
    if (effectiveFabricMode) {
      return trims.filter((t) => isFabricCategory(t.category));
    }
    return trims;
  }, [trims, effectiveFabricMode]);

  const hasPiTrims = filteredPiOptions.length > 0;
  const trimOptions = useMemo(() => {
    const library = filteredLibraryTrims.map((t) => ({ ...t, _source: 'library' }));
    if (hasPiTrims) return [...filteredPiOptions, ...library];
    return library;
  }, [filteredPiOptions, filteredLibraryTrims, hasPiTrims]);

  const trimOptionGroup = (option) => {
    if (option.__create) return isFabricMode ? 'Add new fabric' : 'Add new trim';
    if (option._optionKey) return option._kind === 'fabric' ? 'From PI indent — Fabric' : 'From PI indent — Trim';
    return isFabricMode ? 'Fabric library (additional items)' : 'Trim library (additional items)';
  };

  const getParticularOptionLabel = (o) => {
    if (o._kind === 'fabric') return formatPiFabricOptionLabel(o);
    if (o._optionKey) return formatPiTrimOptionLabel(o, o._trimMaster || trimsMap[o.trim]);
    return o.name || '';
  };

  /** Appends a "Create '<typed name>'" option when no library trim matches the typed name. */
  const filterParticularOptions = (options, { inputValue }) => {
    const input = inputValue.trim();
    const filtered = !input ? options : options.filter((o) => getParticularOptionLabel(o).toLowerCase().includes(input.toLowerCase()));
    const existsInLibrary = filteredLibraryTrims.some((t) => t.name.toLowerCase() === input.toLowerCase());
    if (input && !existsInLibrary) {
      filtered.push({ __create: true, name: input });
    }
    return filtered;
  };

  const fetchNextPoNumber = useCallback(async () => {
    setPoNumberLoading(true);
    try {
      const res = await procurementAPI.getNextPoNumber();
      return res.data?.po_number || clientFallbackPoNumber();
    } catch (e) {
      console.error(e);
      return clientFallbackPoNumber();
    } finally {
      setPoNumberLoading(false);
    }
  }, []);

  const loadMasters = useCallback(async () => {
    const [supRes, trimRes, piRes, bpoRes, coRes] = await Promise.all([
      suppliersAPI.getAll({ is_active: true }),
      ordersAPI.getTrimsMaster(),
      ordersAPI.getAll(),
      ordersAPI.getBuyerPOs(),
      companyAPI.getProfile(),
    ]);
    const trimsList = asList(trimRes.data);
    setSuppliers(asList(supRes.data));
    setTrims(trimsList);
    setPiList(asList(piRes.data));
    setBuyerPoList(asList(bpoRes.data));
    setCompany(coRes.data);
    return { company: coRes.data, trimsList };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { company: co, trimsList } = await loadMasters();
        const trimMasterById = {};
        trimsList.forEach((t) => { trimMasterById[t.id] = t; });
        if (isNew) {
          const nextPoNumber = await fetchNextPoNumber();
          setForm((f) => ({
            ...f,
            bill_to: resolveBillTo(co),
            ship_to: resolveShipTo(co),
            po_number: nextPoNumber,
            items: isFabricMode ? [emptyLine(1, lineDefaults)] : f.items,
          }));
        } else {
          const res = await procurementAPI.getById(id);
          const d = res.data;
          const mappedItems = d.items?.length
            ? d.items.map((row, i) => {
              const parsed = parseParticulars(row.particulars);
              const trimMaster = row.trim ? trimMasterById[row.trim] : null;
              const isFabricLine = parsed.name.toUpperCase() === FABRIC_PO_NAME.toUpperCase()
                || FABRIC_PO_PROPERTY_FIELDS.some((field) => parsed.property_label.includes(`${field}:`));
              if (isFabricLine) {
                const parsedFabric = parseFabricPropertyLabel(parsed.property_label);
                return {
                  serial_no: row.serial_no || i + 1,
                  trim: null,
                  particulars: FABRIC_PO_NAME,
                  property_values: parsedFabric.values,
                  fabric_custom_fields: parsedFabric.customFields,
                  pi_fabric_option_key: parsedFabric.piFabricOptionKey || '',
                  property_label: parsed.property_label,
                  from_pi: Boolean(parsedFabric.piFabricOptionKey) || isPiSourcedLabel(parsed.property_label),
                  hsn_code: row.hsn_code || '',
                  quantity_ordered: row.quantity_ordered,
                  unit: 'MTRS',
                  unit_price: row.unit_price ?? '',
                  notes: row.notes || '',
                };
              }
              return {
                serial_no: row.serial_no || i + 1,
                trim: row.trim,
                particulars: parsed.name,
                property_values: parsePropertyLabelToValues(parsed.property_label, trimMaster),
                property_label: parsed.property_label,
                from_pi: isPiSourcedLabel(parsed.property_label),
                hsn_code: row.hsn_code || '',
                quantity_ordered: row.quantity_ordered,
                unit: row.unit || 'PCS',
                unit_price: row.unit_price ?? '',
                notes: row.notes || '',
              };
            })
            : [emptyLine(1, lineDefaults)];
          if (mappedItems.some((row) => row.particulars === FABRIC_PO_NAME)) {
            setFabricPoDetected(true);
          }
          setForm({
            po_number: d.po_number,
            supplier: d.supplier,
            vendor_name: d.vendor_name || '',
            vendor_address: d.vendor_address || '',
            vendor_email: d.vendor_email || '',
            vendor_phone: d.vendor_phone || '',
            attention: d.attention || '',
            bill_to: d.bill_to || resolveBillTo(co),
            ship_to: d.ship_to || resolveShipTo(co),
            pi: d.pi,
            pi_number: d.pi_number || '',
            buyer_po: d.buyer_po,
            reference_number: d.reference_number || '',
            order_date: d.order_date,
            expected_delivery_date: d.expected_delivery_date || '',
            payment_terms: d.payment_terms || '',
            delivery_terms: d.delivery_terms || '',
            transport_paid_by: d.transport_paid_by || '',
            tax_mode: d.tax_mode || 'CGST_SGST',
            cgst_percent: String(d.cgst_percent ?? 9),
            sgst_percent: String(d.sgst_percent ?? 9),
            igst_percent: String(d.igst_percent ?? 18),
            po_comments: d.po_comments || DEFAULT_COMMENTS,
            order_placed_by: d.order_placed_by || 'Shivangi Jain',
            supplier_ack_name: d.supplier_ack_name || '',
            supplier_ack_date: d.supplier_ack_date || '',
            status: d.status || 'DRAFT',
            notes: d.notes || '',
            items: mappedItems,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew, isFabricMode, lineDefaults, loadMasters, fetchNextPoNumber]);

  // Keep blank fabric rows on Fabric particulars + MTRS unit when switching modes.
  useEffect(() => {
    if (!isNew) return;
    if (effectiveFabricMode) {
      setForm((f) => ({
        ...f,
        items: f.items.map((row) => (
          row.trim || (row.particulars || '').trim()
            ? { ...row, particulars: FABRIC_PO_NAME, unit: 'MTRS' }
            : {
              ...row,
              particulars: FABRIC_PO_NAME,
              unit: 'MTRS',
              property_values: row.property_values && Object.keys(row.property_values).length
                ? row.property_values
                : emptyFabricPropertyValues(),
            }
        )),
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      items: f.items.map((row) => (
        row.trim || (row.particulars || '').trim()
          ? row
          : { ...row, unit: 'PCS', particulars: '' }
      )),
    }));
  }, [effectiveFabricMode, isNew]);

  const refreshPoNumber = async () => {
    const nextPoNumber = await fetchNextPoNumber();
    if (nextPoNumber) {
      setForm((f) => ({ ...f, po_number: nextPoNumber }));
    }
  };

  const deriveTaxMode = useCallback((supplier, companyProfile = company) => (
    resolveTaxModeFromStates({
      companyState: companyProfile?.region_state,
      supplierState: supplier?.state_province,
    })
  ), [company]);

  // Keep Intra/Inter in sync whenever company profile or selected supplier is available.
  useEffect(() => {
    if (!company || !form.supplier) return;
    const supplier = suppliers.find((s) => s.id === form.supplier);
    if (!supplier) return;
    const mode = deriveTaxMode(supplier);
    if (!mode) return;
    setForm((f) => (f.tax_mode === mode ? f : { ...f, tax_mode: mode }));
  }, [company, form.supplier, suppliers, deriveTaxMode]);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === form.supplier) || null,
    [suppliers, form.supplier],
  );
  const autoTaxMode = useMemo(
    () => (selectedSupplier ? deriveTaxMode(selectedSupplier) : null),
    [selectedSupplier, deriveTaxMode],
  );
  const effectiveTaxMode = autoTaxMode || form.tax_mode;
  const totals = useMemo(
    () => calcPreview({ ...form, tax_mode: effectiveTaxMode }),
    [form, effectiveTaxMode],
  );

  const selectSupplier = (supplier) => {
    if (!supplier) {
      setForm((f) => ({ ...f, supplier: null }));
      return;
    }
    const addr = [supplier.address, supplier.city, supplier.state_province, supplier.postal_code, supplier.country].filter(Boolean).join('\n');
    const taxMode = deriveTaxMode(supplier);
    setForm((f) => ({
      ...f,
      supplier: supplier.id,
      vendor_name: supplier.name,
      vendor_address: addr,
      vendor_email: supplier.email || '',
      vendor_phone: supplier.phone || '',
      attention: supplier.contact_person || f.attention,
      ...(taxMode ? { tax_mode: taxMode } : {}),
    }));
  };

  const handleSupplierCreated = (newSupplier) => {
    setSuppliers((prev) => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
    selectSupplier(newSupplier);
    setSupplierModalOpen(false);
  };

  const resolveBuyerPoForPi = (pi) => {
    if (!pi) return null;
    if (pi.linked_po_id) {
      return buyerPoList.find((b) => b.id === pi.linked_po_id) || null;
    }
    return buyerPoList.find((b) => b.pi_id === pi.id) || null;
  };

  const resolvePiForBuyerPo = (buyerPo) => {
    if (!buyerPo) return null;
    if (buyerPo.pi_id) {
      return piList.find((p) => p.id === buyerPo.pi_id) || null;
    }
    return piList.find((p) => p.linked_po_id === buyerPo.id) || null;
  };

  const updateRef = (pi, buyerPo) => {
    setForm((f) => ({
      ...f,
      pi: pi?.id || null,
      pi_number: pi?.pi_number || '',
      buyer_po: buyerPo?.id || null,
      reference_number: buyerPo?.po_number || '',
    }));
  };

  const setLine = (idx, field, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const selectTrim = (idx, trim) => {
    if (!trim) return;
    setForm((f) => {
      const items = [...f.items];
      // Pre-fill property values (e.g. Dim. Unit, Dimensions) from the most recent other
      // row that used this same trim, so repeat line items don't need re-typing them.
      const priorRow = items
        .map((row, i) => ({ row, i }))
        .reverse()
        .find(({ row, i }) => i !== idx && row.trim === trim.id)?.row;
      const property_values = initPropertyValues(trim.properties);
      if (priorRow?.property_values) {
        Object.keys(property_values).forEach((key) => {
          const priorValue = priorRow.property_values[key];
          if (priorValue != null && String(priorValue).trim() !== '') {
            property_values[key] = priorValue;
          }
        });
      }
      items[idx] = {
        ...items[idx],
        trim: trim.id,
        particulars: trim.name,
        property_values,
        // Recompute from the (possibly pre-filled) values above — leaving this blank would
        // silently drop sticky-prefilled properties from the saved particulars text.
        property_label: formatPiTrimProperties({ property_values }, trim),
        from_pi: false,
        hsn_code: (trim.hsn_code || '').trim(),
        unit: trim.default_unit || items[idx].unit,
      };
      return { ...f, items };
    });
  };

  const setLineProperty = (idx, propName, value) => {
    setForm((f) => {
      const items = [...f.items];
      const row = items[idx];
      const trimMaster = row.trim ? trimsMap[row.trim] : null;
      const property_values = { ...(row.property_values || {}), [propName]: value };
      const property_label = formatPiTrimProperties({ property_values }, trimMaster);
      items[idx] = { ...row, property_values, property_label, from_pi: false };
      return { ...f, items };
    });
  };

  const setFabricLineProperty = (idx, propName, value) => {
    setForm((f) => {
      const items = [...f.items];
      const row = items[idx];
      const property_values = { ...(row.property_values || {}), [propName]: value };
      const property_label = formatFabricPropertyLabel(property_values, row.fabric_custom_fields, row.pi_fabric_option_key);
      items[idx] = {
        ...row,
        particulars: FABRIC_PO_NAME,
        property_values,
        property_label,
        unit: 'MTRS',
      };
      return { ...f, items };
    });
  };

  const addFabricCustomProperty = (idx) => {
    setForm((f) => {
      const items = [...f.items];
      const row = items[idx];
      const customFields = [...(row.fabric_custom_fields || [])];
      let name = 'Custom property';
      let n = 1;
      while (customFields.includes(name) || isStandardFabricProperty(name)) {
        name = `Custom property ${n++}`;
      }
      customFields.push(name);
      const property_values = { ...(row.property_values || {}), [name]: '' };
      items[idx] = {
        ...row,
        particulars: FABRIC_PO_NAME,
        fabric_custom_fields: customFields,
        property_values,
        property_label: formatFabricPropertyLabel(property_values, customFields, row.pi_fabric_option_key),
        unit: 'MTRS',
      };
      return { ...f, items };
    });
  };

  const removeFabricCustomProperty = (idx, propName) => {
    setForm((f) => {
      const items = [...f.items];
      const row = items[idx];
      const customFields = (row.fabric_custom_fields || []).filter((n) => n !== propName);
      const property_values = { ...(row.property_values || {}) };
      delete property_values[propName];
      items[idx] = {
        ...row,
        particulars: FABRIC_PO_NAME,
        fabric_custom_fields: customFields,
        property_values,
        property_label: formatFabricPropertyLabel(property_values, customFields, row.pi_fabric_option_key),
        unit: 'MTRS',
      };
      return { ...f, items };
    });
  };

  const renameFabricCustomProperty = (idx, oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    if (isStandardFabricProperty(trimmed)) return;
    setForm((f) => {
      const items = [...f.items];
      const row = items[idx];
      const customFields = row.fabric_custom_fields || [];
      if (customFields.includes(trimmed)) return f;
      const nextCustomFields = customFields.map((n) => (n === oldName ? trimmed : n));
      const property_values = { ...(row.property_values || {}) };
      property_values[trimmed] = property_values[oldName] ?? '';
      delete property_values[oldName];
      items[idx] = {
        ...row,
        particulars: FABRIC_PO_NAME,
        fabric_custom_fields: nextCustomFields,
        property_values,
        property_label: formatFabricPropertyLabel(property_values, nextCustomFields, row.pi_fabric_option_key),
        unit: 'MTRS',
      };
      return { ...f, items };
    });
  };

  const selectPiTrimLine = (idx, line) => {
    const trimMaster = line._trimMaster || (line.trim ? trimsMap[line.trim] : null);
    const display = buildPiTrimDisplay(line, trimMaster);
    setForm((f) => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        trim: line.trim || null,
        particulars: line.trim_name || trimMaster?.name || '',
        property_values: { ...(line.property_values || {}) },
        property_label: display.summary,
        from_pi: true,
        hsn_code: (trimMaster?.hsn_code || '').trim(),
        unit: display.unit,
        quantity_ordered: display.orderQty || items[idx].quantity_ordered,
      };
      return { ...f, items };
    });
  };

  const selectPiFabricLine = (idx, line) => {
    const display = buildPiFabricDisplay(line);
    const property_values = mapPiFabricToPropertyValues(line);
    const property_label = formatFabricPropertyLabel(property_values, [], line._optionKey);
    setForm((f) => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        trim: null,
        particulars: FABRIC_PO_NAME,
        property_values,
        fabric_custom_fields: items[idx].fabric_custom_fields || [],
        pi_fabric_option_key: line._optionKey || '',
        property_label,
        from_pi: true,
        hsn_code: items[idx].hsn_code || '',
        unit: 'MTRS',
        quantity_ordered: display.orderQty || items[idx].quantity_ordered,
      };
      return { ...f, items };
    });
  };

  const clearLineTrim = (idx) => {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = {
        ...items[idx],
        trim: null,
        hsn_code: '',
        property_values: {},
        property_label: '',
        from_pi: false,
      };
      return { ...f, items };
    });
  };

  const addLine = () => setForm((f) => ({
    ...f,
    items: [...f.items, emptyLine(f.items.length + 1, lineDefaults)],
  }));
  const insertLineAfter = (idx) => setForm((f) => {
    const items = [...f.items.slice(0, idx + 1), emptyLine(1, lineDefaults), ...f.items.slice(idx + 1)];
    return { ...f, items: items.map((row, i) => ({ ...row, serial_no: i + 1 })) };
  });
  const removeLine = (idx) => setForm((f) => ({
    ...f,
    items: f.items.filter((_, i) => i !== idx).map((row, i) => ({ ...row, serial_no: i + 1 })),
  }));

  const openTrimModal = (idx, initialName = '') => {
    setTrimModalTargetRow(idx);
    setTrimModalInitialName(initialName);
    setTrimModalOpen(true);
  };

  const handleTrimCreated = (newTrim) => {
    setTrims((prev) => [...prev, newTrim].sort((a, b) => a.name.localeCompare(b.name)));
    if (trimModalTargetRow != null) {
      selectTrim(trimModalTargetRow, newTrim);
    }
    setTrimModalOpen(false);
    setTrimModalTargetRow(null);
    setTrimModalInitialName('');
  };

  const handleSave = async () => {
    const poNumber = form.po_number.trim();
    if (!poNumber) { alert('PO number is required.'); return; }
    if (!form.supplier && !form.vendor_name.trim()) { alert('Select a supplier.'); return; }
    const items = form.items.filter((r) => r.particulars?.trim() || r.trim || effectiveFabricMode);
    if (!items.length) { alert('Add at least one line item.'); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        po_number: poNumber,
        tax_mode: effectiveTaxMode,
        supplier: form.supplier,
        pi: form.pi,
        buyer_po: form.buyer_po,
        cgst_percent: parseFloat(form.cgst_percent) || 0,
        sgst_percent: parseFloat(form.sgst_percent) || 0,
        igst_percent: parseFloat(form.igst_percent) || 0,
        supplier_ack_date: form.supplier_ack_date || null,
        status: 'ORDERED',
        items: items.map((row, i) => ({
          serial_no: row.serial_no || i + 1,
          trim: effectiveFabricMode ? null : row.trim,
          particulars: buildParticularsForSave(row, effectiveFabricMode),
          hsn_code: row.hsn_code.trim(),
          quantity_ordered: parseFloat(row.quantity_ordered) || 0,
          unit: effectiveFabricMode ? 'MTRS' : (row.unit || 'PCS'),
          unit_price: parseFloat(row.unit_price) || 0,
          notes: row.notes || '',
        })),
      };
      if (isNew) {
        await procurementAPI.create(payload);
      } else {
        await procurementAPI.update(id, payload);
      }
      navigate('/procurement');
    } catch (e) {
      alert('Save failed: ' + (e.response?.data ? JSON.stringify(e.response.data) : e.message));
    } finally {
      setSaving(false);
    }
  };

  const refreshCompanyAddresses = () => {
    if (!company) return;
    setForm((f) => ({
      ...f,
      bill_to: resolveBillTo(company),
      ship_to: resolveShipTo(company),
    }));
  };

  const supplierText = useMemo(() => supplierBlock(form), [form]);
  const printPo = useMemo(() => {
    const piNumber = form.pi_number || piList.find((p) => p.id === form.pi)?.pi_number || '';
    return { ...form, pi_number: piNumber, items: form.items };
  }, [form, piList]);

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
        <IconButton onClick={() => navigate('/procurement')} size="small"><ArrowBack /></IconButton>
        {effectiveFabricMode ? <Checkroom sx={{ color: 'primary.main' }} /> : <LocalShipping sx={{ color: 'primary.main' }} />}
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', flex: 1 }}>
          {isNew
            ? (isFabricMode ? 'Raise Fabric Purchase Order' : 'Raise Trim Purchase Order')
            : `PO: ${form.po_number}`}
        </Typography>
        {isNew && (
          <ToggleButtonGroup
            exclusive
            size="small"
            value={isFabricMode ? 'fabric' : 'trim'}
            onChange={(_, v) => { if (v) setPoMode(v); }}
            sx={{
              mr: 0.5,
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.78rem',
                px: 1.5,
                py: 0.5,
                borderRadius: '8px !important',
              },
            }}
          >
            <ToggleButton value="trim"><Category sx={{ fontSize: 16, mr: 0.5 }} />Trim</ToggleButton>
            <ToggleButton value="fabric"><Checkroom sx={{ fontSize: 16, mr: 0.5 }} />Fabric</ToggleButton>
          </ToggleButtonGroup>
        )}
        {!isNew && effectiveFabricMode && (
          <Chip label="Fabric PO" size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
        )}
        {form.po_number && (
          <Button startIcon={<Print />} variant="outlined" size="small" onClick={() => window.print()}
            sx={{ fontWeight: 700, textTransform: 'none' }}>Print</Button>
        )}
        <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          disabled={saving} onClick={handleSave}
          sx={{ fontWeight: 800, textTransform: 'none', px: 3 }}>
          {saving ? 'Saving…' : 'Place Order'}
        </Button>
      </Box>

      {/* Order details */}
      <Paper elevation={0} sx={sectionPaperSxByIndex(0)}>
        <Typography sx={{ ...sectionLabelSx, mb: 2, fontSize: '0.75rem' }}>Order Details</Typography>

        {/* Document */}
        <OrderSectionTitle>Document</OrderSectionTitle>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              size="small"
              label="PO Number *"
              value={form.po_number}
              onChange={(e) => setForm((f) => ({ ...f, po_number: e.target.value }))}
              InputProps={{
                endAdornment: isNew ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={refreshPoNumber}
                      disabled={poNumberLoading}
                      title="Get next PO number"
                    >
                      {poNumberLoading ? <CircularProgress size={16} /> : <Sync sx={{ fontSize: 16 }} />}
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              }}
              sx={{
                ...sxInput,
                ...monoFieldSx,
                '& .MuiInputBase-input': {
                  ...monoFieldSx['& .MuiInputBase-input'],
                  fontSize: '0.82rem',
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth size="small" label="Order Date" type="date" value={form.order_date}
              onChange={(e) => {
                const order_date = e.target.value;
                setForm((f) => {
                  const days = parseDeliveryDays(f.delivery_terms);
                  const expected_delivery_date = days != null
                    ? addDaysToIsoDate(order_date, days)
                    : f.expected_delivery_date;
                  return { ...f, order_date, expected_delivery_date };
                });
              }}
              InputLabelProps={{ shrink: true }} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <Autocomplete
                options={suppliers}
                getOptionLabel={(o) => o.name || ''}
                value={suppliers.find((s) => s.id === form.supplier) || null}
                onChange={(_, v) => selectSupplier(v)}
                sx={{ flex: 1, minWidth: 0 }}
                renderInput={(params) => <TextField {...params} size="small" fullWidth label="Supplier *" sx={sxInput} />}
              />
              <Tooltip title="Create new supplier">
                <IconButton
                  size="small"
                  onClick={() => setSupplierModalOpen(true)}
                  sx={{ mt: 0.25, color: 'primary.main', flexShrink: 0 }}
                >
                  <Storefront fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth size="small" label="Attention" value={form.attention}
              onChange={(e) => setForm((f) => ({ ...f, attention: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth size="small" label="Phone No." value={form.vendor_phone}
              onChange={(e) => setForm((f) => ({ ...f, vendor_phone: e.target.value }))} sx={sxInput} />
          </Grid>
        </Grid>

        {/* References */}
        <OrderSectionTitle>References</OrderSectionTitle>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              options={piList}
              getOptionLabel={(o) => `${o.pi_number} — ${o.client_name || ''}`}
              value={piList.find((p) => p.id === form.pi) || null}
              onChange={(_, v) => {
                if (!v) updateRef(null, null);
                else updateRef(v, resolveBuyerPoForPi(v));
              }}
              renderInput={(params) => <TextField {...params} size="small" fullWidth label="Reference PI" sx={sxInput} />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Autocomplete
              options={buyerPoList}
              getOptionLabel={(o) => `${o.po_number} — ${o.buyer_name || ''}`}
              value={buyerPoList.find((b) => b.id === form.buyer_po) || null}
              onChange={(_, v) => {
                if (!v) updateRef(null, null);
                else updateRef(resolvePiForBuyerPo(v), v);
              }}
              renderInput={(params) => <TextField {...params} size="small" fullWidth label="Reference Buyer PO" sx={sxInput} />}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth size="small" label="Reference No. (Buyer PO)" value={form.reference_number}
              onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))} sx={sxInput} />
          </Grid>
        </Grid>

        {/* Schedule & terms */}
        <OrderSectionTitle>Schedule &amp; Terms</OrderSectionTitle>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Delivery Terms"
              value={form.delivery_terms}
              onChange={(e) => {
                const delivery_terms = e.target.value;
                setForm((f) => {
                  const days = parseDeliveryDays(delivery_terms);
                  const expected_delivery_date = days != null
                    ? addDaysToIsoDate(f.order_date, days)
                    : f.expected_delivery_date;
                  return { ...f, delivery_terms, expected_delivery_date };
                });
              }}
              placeholder="e.g. 30"
              helperText="Lead time in days from order date"
              InputProps={{
                endAdornment: <InputAdornment position="end">days</InputAdornment>,
              }}
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              size="small"
              label="Delivery Date"
              type="date"
              value={form.expected_delivery_date}
              onChange={(e) => setForm((f) => ({ ...f, expected_delivery_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              helperText={
                parseDeliveryDays(form.delivery_terms) != null
                  ? `Auto from order date + ${parseDeliveryDays(form.delivery_terms)} days`
                  : ' '
              }
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField fullWidth size="small" label="Payment Terms" value={form.payment_terms}
              onChange={(e) => setForm((f) => ({ ...f, payment_terms: e.target.value }))}
              placeholder="e.g. Net 30 days"
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: slate[600], mb: 0.75 }}>
              Transport paid by
            </Typography>
            <RadioGroup
              row
              value={form.transport_paid_by || ''}
              onChange={(e) => setForm((f) => ({ ...f, transport_paid_by: e.target.value }))}
            >
              <FormControlLabel
                value="SUPPLIER"
                control={<Radio size="small" />}
                label={<Typography variant="body2">Supplier</Typography>}
              />
              <FormControlLabel
                value="BUYER"
                control={<Radio size="small" />}
                label={<Typography variant="body2">Buyer</Typography>}
              />
            </RadioGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Parties */}
      <Paper elevation={0} sx={sectionPaperSxByIndex(1)}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
            pb: 1.5,
            borderBottom: `1px solid ${slate[200]}`,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#0f766e', 0.1),
              color: '#0f766e',
            }}
          >
            <LocalShipping sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: slate[800], letterSpacing: '-0.01em' }}>
              Parties
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: slate[500], mt: 0.25 }}>
              Supplier, billing, and shipping addresses for this purchase order
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Sync sx={{ fontSize: 14 }} />}
            onClick={refreshCompanyAddresses}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.72rem',
              borderColor: alpha('#0f766e', 0.35),
              color: '#0f766e',
              '&:hover': { borderColor: '#0f766e', bgcolor: alpha('#0f766e', 0.06) },
            }}
          >
            Refresh Bill / Ship
          </Button>
        </Box>
        <Grid container spacing={2} alignItems="stretch">
          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
            <PartyCard variant="supplier" title="Supplier" text={supplierText} hint="Vendor master" />
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
            <PartyCard variant="billTo" title="Bill To" text={form.bill_to} hint="Company profile" />
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
            <PartyCard variant="shipTo" title="Ship To" text={form.ship_to} hint="Company profile" />
          </Grid>
        </Grid>
      </Paper>

      {/* Line items */}
      <Paper elevation={0} sx={sectionPaperSxByIndex(2)}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.25, flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.8rem', flex: 1 }}>
            {effectiveFabricMode ? 'Fabric Line Items' : 'Trim Line Items'}
          </Typography>
          {form.pi && (
            <Typography sx={{ fontSize: '0.68rem', color: slate[500], fontWeight: 600 }}>
              {piTrimsLoading
                ? (effectiveFabricMode ? 'Loading fabrics from PI…' : 'Loading trims from PI…')
                : hasPiTrims
                  ? (effectiveFabricMode
                    ? `${filteredPiOptions.length} PI fabric line(s) · PI total ${formatQty(piTotalPcs)} pcs`
                    : `${filteredPiOptions.length} PI trim variant(s) · ${filteredLibraryTrims.length} library trim(s) · PI total ${formatQty(piTotalPcs)} pcs`)
                  : (effectiveFabricMode
                    ? 'No PI fabric lines — enter fabric details below'
                    : `No PI trim lines — ${filteredLibraryTrims.length} library trim(s) available`)}
            </Typography>
          )}
          {!form.pi && (
            <Typography sx={{ fontSize: '0.68rem', color: slate[500], fontWeight: 600 }}>
              {effectiveFabricMode
                ? 'Enter fabric details below — select a PI to pre-fill from indent'
                : `${filteredLibraryTrims.length} trim(s) from library — select a PI to include indent variants`}
            </Typography>
          )}
          <Button size="small" startIcon={<Add />} onClick={addLine} sx={{ textTransform: 'none', fontWeight: 700 }}>Add Row</Button>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{
            minWidth: 1180,
            border: `1px solid ${slate[200]}`,
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            '& .MuiTableCell-root': {
              borderBottom: `1px solid ${slate[200]}`,
            },
          }}
          >
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(slate[900], 0.05) }}>
                {[
                  { h: 'S.No', w: 52 },
                  { h: effectiveFabricMode ? 'Particulars' : 'Particulars (Trim)', w: 340 },
                  { h: 'HSN Code', w: 128 },
                  { h: effectiveFabricMode ? 'Qty (Meters)' : 'Qty', w: 132 },
                  { h: 'Unit Price', w: 110 },
                  { h: 'Total', w: 110 },
                  { h: '', w: 76 },
                ].map(({ h, w }) => (
                  <TableCell key={h || 'actions'} sx={{ fontWeight: 700, fontSize: '0.75rem', width: w, minWidth: w }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {form.items.map((row, i) => {
                const hsnMissing = Boolean(row.trim && !row.hsn_code?.trim());
                return (
                <React.Fragment key={i}>
                <TableRow
                  sx={{
                    bgcolor: i % 2 === 1 ? warm[100] : '#ffffff',
                    '&:hover': { bgcolor: i % 2 === 1 ? warm[200] : alpha(warm[100], 0.55) },
                    '&:last-child td': { borderBottom: 'none' },
                  }}
                >
                  <TableCell sx={{ width: 52, verticalAlign: 'top', pt: 1.25, py: 1.5 }}>{i + 1}</TableCell>
                  <TableCell sx={{ minWidth: 340, verticalAlign: 'top', py: 1.5 }}>
                    {effectiveFabricMode ? (
                      <Box>
                        <FabricPiPickControl
                          row={row}
                          options={filteredPiOptions}
                          loading={piTrimsLoading}
                          piSelected={Boolean(form.pi)}
                          onSelect={(line) => selectPiFabricLine(i, line)}
                        />
                        <FabricPropertyFields
                          row={row}
                          onChange={(propName, value) => setFabricLineProperty(i, propName, value)}
                          onAddProperty={() => addFabricCustomProperty(i)}
                          onRemoveProperty={(propName) => removeFabricCustomProperty(i, propName)}
                          onRenameProperty={(oldName, newName) => renameFabricCustomProperty(i, oldName, newName)}
                        />
                      </Box>
                    ) : (
                    <>
                    <Autocomplete
                      freeSolo
                      options={trimOptions}
                      loading={piTrimsLoading}
                      groupBy={trimOptionGroup}
                      filterOptions={filterParticularOptions}
                      componentsProps={{
                        paper: { sx: { minWidth: hasPiTrims ? 440 : 320 } },
                      }}
                      getOptionLabel={(o) => {
                        if (typeof o === 'string') return o;
                        if (o.__create) return o.name || '';
                        return getParticularOptionLabel(o);
                      }}
                      isOptionEqualToValue={(o, v) => {
                        if (typeof v === 'string') return false;
                        if (o._optionKey || v._optionKey) {
                          return o._optionKey === v._optionKey;
                        }
                        return o.id === v.id;
                      }}
                      inputValue={row.particulars}
                      onInputChange={(_, v, reason) => {
                        setLine(i, 'particulars', v);
                        if (reason === 'input') {
                          setForm((f) => {
                            const items = [...f.items];
                            items[i] = {
                              ...items[i],
                              trim: null,
                              property_values: {},
                              property_label: '',
                              from_pi: false,
                            };
                            return { ...f, items };
                          });
                        }
                      }}
                      onChange={(_, v) => {
                        if (v && typeof v === 'object') {
                          if (v.__create) openTrimModal(i, v.name);
                          else if (v._kind === 'fabric') selectPiFabricLine(i, v);
                          else if (v._optionKey) selectPiTrimLine(i, v);
                          else selectTrim(i, v);
                        } else if (!v) clearLineTrim(i);
                      }}
                      renderOption={(props, option) => {
                        if (option.__create) {
                          return (
                            <Box component="li" {...props} key="create-trim" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: '#7c3aed' }}>
                              <LibraryAdd sx={{ fontSize: 17 }} />
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'inherit' }}>
                                Create "{option.name}"
                              </Typography>
                            </Box>
                          );
                        }
                        if (option._kind === 'fabric') {
                          return (
                            <Box component="li" {...props} key={option._optionKey}>
                              <PiFabricOptionContent line={option} />
                            </Box>
                          );
                        }
                        const isPiLine = Boolean(option._optionKey);
                        if (!isPiLine) {
                          return (
                            <Box component="li" {...props} key={`lib-${option.id}`}>
                              <LibraryTrimOptionContent trim={option} />
                            </Box>
                          );
                        }
                        const trimMaster = option._trimMaster || trimsMap[option.trim];
                        return (
                          <Box component="li" {...props} key={option._optionKey}>
                            <PiTrimOptionContent line={option} trimMaster={trimMaster} />
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          fullWidth
                          placeholder={
                            isFabricMode
                              ? (hasPiTrims ? 'PI fabric or library fabric…' : 'Select fabric from library')
                              : (hasPiTrims ? 'PI trim or library trim…' : 'Select trim from library')
                          }
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {params.InputProps.endAdornment}
                                <Tooltip title={isFabricMode ? 'Create new fabric' : 'Create new trim'}>
                                  <IconButton size="small" onClick={() => openTrimModal(i, row.particulars)} sx={{ color: '#7c3aed', mr: 0.5 }}>
                                    <LibraryAdd fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                    {row.from_pi && row.property_label && (
                      <Box
                        sx={{
                          mt: 0.75,
                          px: 0.75,
                          py: 0.65,
                          borderRadius: 1,
                          bgcolor: alpha('#0f766e', 0.06),
                          border: `1px solid ${alpha('#0f766e', 0.12)}`,
                        }}
                      >
                        {row.property_label.split('\n').filter(Boolean).map((line) => (
                          <Typography
                            key={line}
                            sx={{
                              fontSize: line.includes('Order Qty:') ? '0.68rem' : '0.72rem',
                              color: line.includes('Order Qty:') ? '#0f766e' : slate[600],
                              lineHeight: 1.45,
                              fontWeight: line.includes('Order Qty:') ? 700 : 600,
                            }}
                          >
                            {line}
                          </Typography>
                        ))}
                      </Box>
                    )}
                    {row.trim && !row.from_pi && (
                      <Box sx={{ mt: 1.5 }}>
                        <TrimPropertyFields
                          row={row}
                          trimMaster={trimsMap[row.trim]}
                          onChange={(propName, value) => setLineProperty(i, propName, value)}
                        />
                      </Box>
                    )}
                    </>
                    )}
                  </TableCell>
                  <TableCell sx={{ width: 128, minWidth: 128, verticalAlign: 'top', pt: 1.25 }}>
                    <TextField
                      size="small"
                      fullWidth
                      value={row.hsn_code}
                      placeholder={hsnMissing ? 'Enter HSN' : '6–8 digits'}
                      inputProps={{ maxLength: 8, style: { textAlign: 'center' } }}
                      onChange={(e) => setLine(i, 'hsn_code', e.target.value.replace(/\D/g, '').slice(0, 8))}
                      helperText={hsnMissing ? 'HSN not available in system' : ''}
                      FormHelperTextProps={{
                        sx: {
                          mx: 0,
                          mt: 0.5,
                          fontSize: '0.62rem',
                          lineHeight: 1.3,
                          color: '#b45309',
                          fontWeight: 600,
                          whiteSpace: 'normal',
                        },
                      }}
                      sx={{
                        ...monoFieldSx,
                        '& .MuiOutlinedInput-root': {
                          bgcolor: hsnMissing ? alpha('#f59e0b', 0.06) : alpha(slate[50], 0.8),
                        },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ width: 132, minWidth: 132, verticalAlign: 'top', pt: 1.25 }}>
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={row.quantity_ordered}
                      placeholder="0"
                      inputProps={{ min: 0, step: 'any', style: { textAlign: 'right' } }}
                      onChange={(e) => setLine(i, 'quantity_ordered', e.target.value)}
                      sx={{
                        ...monoFieldSx,
                        '& .MuiOutlinedInput-root': { bgcolor: alpha(slate[50], 0.8) },
                      }}
                    />
                    {effectiveFabricMode && (
                      <Typography sx={{ fontSize: '0.62rem', color: slate[500], fontWeight: 600, textAlign: 'right', mt: 0.5 }}>
                        Meters
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ width: 110, minWidth: 110, verticalAlign: 'top', pt: 1.25 }}>
                    <TextField
                      size="small"
                      fullWidth
                      type="number"
                      value={row.unit_price}
                      placeholder="0.00"
                      onChange={(e) => setLine(i, 'unit_price', e.target.value)}
                      inputProps={{ step: '0.01', min: 0, style: { textAlign: 'right' } }}
                      sx={{
                        ...monoFieldSx,
                        '& .MuiOutlinedInput-root': { bgcolor: alpha(slate[50], 0.8) },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ width: 110, minWidth: 110, verticalAlign: 'top', pt: 1.25, fontWeight: 700, textAlign: 'right' }}>
                    <Typography className="font-numeric" sx={{ fontWeight: 700, fontSize: '0.875rem', pt: 0.75, pr: 0.5 }}>
                      {lineTotal(row).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ width: 76, verticalAlign: 'top', pt: 1 }}>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <Tooltip title="Insert row below">
                        <IconButton size="small" color="primary" onClick={() => insertLineAfter(i)}>
                          <Add fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove row">
                        <IconButton size="small" color="error" onClick={() => removeLine(i)} disabled={form.items.length <= 1}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
                <AddRowDivider onAdd={() => insertLineAfter(i)} />
                </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Box>

        {/* Tax summary */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
          <Box sx={{ width: { xs: '100%', sm: 320 } }}>
            <Grid container spacing={1} sx={{ mb: 0.75 }}>
              {effectiveTaxMode === 'IGST' ? (
                <Grid item xs={6}>
                  <TextField size="small" fullWidth label="IGST %" value={form.igst_percent}
                    onChange={(e) => setForm((f) => ({ ...f, igst_percent: e.target.value }))} />
                </Grid>
              ) : (
                <>
                  <Grid item xs={6}>
                    <TextField size="small" fullWidth label="CGST %" value={form.cgst_percent}
                      onChange={(e) => setForm((f) => ({ ...f, cgst_percent: e.target.value }))} />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField size="small" fullWidth label="SGST %" value={form.sgst_percent}
                      onChange={(e) => setForm((f) => ({ ...f, sgst_percent: e.target.value }))} />
                  </Grid>
                </>
              )}
            </Grid>
            <Box sx={{ p: 1.5, bgcolor: alpha('#0f766e', 0.06), borderRadius: 1.5, border: `1px solid ${slate[200]}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="body2">Sub Total</Typography><Typography variant="body2" fontWeight={700}>{totals.subtotal.toFixed(2)}</Typography></Box>
              {effectiveTaxMode === 'IGST' ? (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="body2">IGST</Typography><Typography variant="body2">{totals.igst.toFixed(2)}</Typography></Box>
              ) : (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="body2">CGST</Typography><Typography variant="body2">{totals.cgst.toFixed(2)}</Typography></Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}><Typography variant="body2">SGST</Typography><Typography variant="body2">{totals.sgst.toFixed(2)}</Typography></Box>
                </>
              )}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">Round Off</Typography>
                <Typography variant="body2">{totals.roundOff.toFixed(2)}</Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}><Typography fontWeight={800}>Total</Typography><Typography fontWeight={800}>{totals.total.toFixed(2)}</Typography></Box>
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Footer — compact */}
      <Paper elevation={0} sx={sectionPaperSxByIndex(3)}>
        <Typography sx={{ ...sectionLabelSx, mb: 1 }}>Footer & Acknowledgement</Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={12}>
            <TextField fullWidth size="small" multiline minRows={2} label="Purchase Order Comments"
              value={form.po_comments} onChange={(e) => setForm((f) => ({ ...f, po_comments: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Order Placed By" value={form.order_placed_by}
              onChange={(e) => setForm((f) => ({ ...f, order_placed_by: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Supplier Ack. Name" value={form.supplier_ack_name}
              onChange={(e) => setForm((f) => ({ ...f, supplier_ack_name: e.target.value }))} sx={sxInput} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth size="small" label="Supplier Ack. Date" type="date" value={form.supplier_ack_date}
              onChange={(e) => setForm((f) => ({ ...f, supplier_ack_date: e.target.value }))}
              InputLabelProps={{ shrink: true }} sx={sxInput} />
          </Grid>
        </Grid>
        <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', mt: 1.25, lineHeight: 1.4 }}>
          Print view includes signature blocks for company and supplier acknowledgement.
        </Typography>
      </Paper>

      {/* Bottom actions */}
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
        {form.po_number && (
          <Button startIcon={<Print />} variant="outlined" size="small" onClick={() => window.print()}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>Print</Button>
        )}
        <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          disabled={saving} onClick={handleSave}
          sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 1.5, px: 3 }}>
          {saving ? 'Saving…' : 'Place Order'}
        </Button>
      </Box>

      <AddSupplierModal
        open={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        onSaved={handleSupplierCreated}
      />

      <AddTrimModal
        open={trimModalOpen}
        initialName={trimModalInitialName}
        initialCategory={isFabricMode ? 'Fabric' : ''}
        initialUnit={isFabricMode ? 'MTRS' : 'PCS'}
        onClose={() => { setTrimModalOpen(false); setTrimModalTargetRow(null); setTrimModalInitialName(''); }}
        onSaved={handleTrimCreated}
      />

      <Box id="supplier-po-print-root">
        <SupplierPOPrintDocument po={printPo} company={company} trimsMap={trimsMap} />
      </Box>
    </Box>
  );
}
