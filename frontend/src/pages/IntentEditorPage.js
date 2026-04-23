import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Stack,
  Paper,
  LinearProgress,
  IconButton,
  Alert,
  Tabs,
  Tab,
} from '@mui/material';
import { AddCircleOutline, ArrowBack, Add, Save, Delete, NoteAdd } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { format } from 'date-fns';
import PageHeader from '../components/PageHeader';
import {
  IntentSizeColourGrid,
  defaultSizeRows,
  emptySizeRow,
  normalizeSizeRowsFromApi,
  buildSizeBreakdownForPayload,
  totalForSizes,
} from '../components/IntentSizeColourGrid';
import { ordersAPI, inventoryAPI } from '../services/api';

const emptyLine = () => ({
  material_description: '',
  variant: '',
  consumption_per_unit: 0,
  unit: 'PCS',
  total_required: 0,
  inventory_item: '',
  remarks: '',
});

const emptySheet = (label) => ({
  id: null,
  label: label || 'New sheet',
  item_description: '',
  sizeRows: defaultSizeRows(),
  lines: [emptyLine()],
});

const asList = (resData) => {
  if (Array.isArray(resData)) return resData;
  if (resData && Array.isArray(resData.results)) return resData.results;
  return [];
};

const sizeGridCount = (data) => {
  if (data == null) return 0;
  if (data.count != null) return data.count;
  if (data.results) return data.results.length;
  if (Array.isArray(data)) return data.length;
  return 0;
};

const suggestIndentNumber = (pi, nextIndex) => {
  if (!pi) return '';
  const num = String(pi.pi_number || 'PI').trim();
  return `${num} · I${String(nextIndex).padStart(2, '0')}`;
};

const mapLineFromApi = (l) => ({
  material_description: l.material_description,
  variant: l.variant || '',
  consumption_per_unit: l.consumption_per_unit,
  unit: l.unit,
  total_required: l.total_required,
  inventory_item: l.inventory_item || '',
  remarks: l.remarks || '',
});

const IntentEditorPage = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isCreate = id === 'new';
  const numericId = isCreate ? null : parseInt(id, 10);

  const [loading, setLoading] = useState(!isCreate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [piList, setPiList] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [tab, setTab] = useState(0);

  const [header, setHeader] = useState({
    pi: '',
    indent_number: '',
    buyer_po_reference: '',
    intent_date: format(new Date(), 'yyyy-MM-dd'),
    packing_notes: '',
    status: 'DRAFT',
    prepared_by: '',
    received_by: '',
    approved_by: '',
    notes: '',
  });

  const [sheets, setSheets] = useState([emptySheet('Sheet 1')]);

  const currentSheet = sheets[tab] || sheets[0];
  const piFromQuery = searchParams.get('pi');

  useEffect(() => {
    (async () => {
      try {
        const [pis, inv] = await Promise.all([ordersAPI.getAll(), inventoryAPI.getAll()]);
        setPiList(asList(pis.data));
        setInventoryItems(asList(inv.data));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const loadById = useCallback(async (iid) => {
    setLoading(true);
    setError(null);
    try {
      const res = await ordersAPI.getIntent(iid);
      const o = res.data;
      if (!o.sheets || !o.sheets.length) {
        setError('This intent has no sheets. Re-save to create sheet rows.');
      }
      setHeader({
        pi: o.pi,
        indent_number: o.indent_number,
        buyer_po_reference: o.buyer_po_reference || '',
        intent_date: o.intent_date,
        packing_notes: o.packing_notes || '',
        status: o.status,
        prepared_by: o.prepared_by || '',
        received_by: o.received_by || '',
        approved_by: o.approved_by || '',
        notes: o.notes || '',
      });
      if (o.sheets && o.sheets.length) {
        setSheets(
          [...o.sheets]
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.id - b.id)
            .map((s) => ({
              id: s.id,
              label: s.label || 'Sheet',
              item_description: s.item_description || '',
              sizeRows: normalizeSizeRowsFromApi(s.size_breakdown),
              lines: s.lines && s.lines.length ? s.lines.map(mapLineFromApi) : [emptyLine()],
            })),
        );
      } else {
        setSheets([emptySheet('Sheet 1')]);
      }
      setTab(0);
    } catch (e) {
      console.error(e);
      setError('Could not load this intent.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isCreate) {
      if (!piFromQuery) {
        return;
      }
      if (!piList.length) {
        return;
      }
      const piId = Number(piFromQuery);
      if (Number.isNaN(piId)) {
        return;
      }
      (async () => {
        setLoading(true);
        try {
          const pi = piList.find((p) => p.id === piId);
          if (!pi) {
            return;
          }
          const r = await ordersAPI.getIntents({ pi: piId });
          const n = sizeGridCount(r.data) + 1;
          setHeader((h) => ({
            ...h,
            pi: piId,
            buyer_po_reference: h.buyer_po_reference || pi.buyer_po_number || '',
            indent_number: suggestIndentNumber(pi, n),
          }));
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }
    if (numericId && !Number.isNaN(numericId)) {
      loadById(numericId);
    }
  }, [isCreate, piFromQuery, piList, numericId, loadById]);

  const updateCurrentSheet = useCallback(
    (patch) => {
      setSheets((rows) => rows.map((r, i) => (i === tab ? { ...r, ...patch } : r)));
    },
    [tab],
  );

  const setCurrentLines = useCallback(
    (lines) => {
      updateCurrentSheet({ lines });
    },
    [updateCurrentSheet],
  );

  const handleAddLine = () => {
    const s = currentSheet;
    if (!s) return;
    updateCurrentSheet({ lines: [...(s.lines || [emptyLine()]), emptyLine()] });
  };

  const handleLineChange = (i, field, value) => {
    const s = currentSheet;
    if (!s) return;
    const next = [...(s.lines || [])];
    next[i] = { ...next[i], [field]: value };
    setCurrentLines(next);
  };

  const handleRemoveLine = (i) => {
    const s = currentSheet;
    if (!s) return;
    const next = [...(s.lines || [])].filter((_, j) => j !== i);
    setCurrentLines(next.length ? next : [emptyLine()]);
  };

  const onPiChange = async (e) => {
    const v = e.target.value;
    const piId = v ? Number(v) : '';
    setHeader((h) => ({ ...h, pi: piId }));
    if (!isCreate) return;
    if (!v) return;
    const pi = piList.find((p) => p.id === Number(v));
    if (!pi) return;
    try {
      const r = await ordersAPI.getIntents({ pi: Number(v) });
      const n = sizeGridCount(r.data) + 1;
      setHeader((h) => ({
        ...h,
        pi: Number(v),
        buyer_po_reference: h.buyer_po_reference || pi.buyer_po_number || '',
        indent_number: suggestIndentNumber(pi, n),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const addSheet = () => {
    const n = sheets.length + 1;
    setSheets((r) => [...r, emptySheet(`Sheet ${n}`)]);
    setTab(sheets.length);
  };

  const removeSheet = (idx) => {
    if (sheets.length < 2) return;
    if (!window.confirm('Delete this tab and its lines?')) return;
    setSheets((r) => r.filter((_, i) => i !== idx));
    setTab((i) => {
      if (i > idx) return i - 1;
      if (i === idx) return Math.max(0, idx - 1);
      return i;
    });
  };

  const buildPayload = () => {
    const outSheets = sheets.map((sh, order) => {
      const b = buildSizeBreakdownForPayload(sh.sizeRows);
      const tt = sh.sizeRows.reduce((a, r) => a + totalForSizes(r.sizes), 0);
      return {
        label: (sh.label || `Sheet ${order + 1}`).trim() || `Sheet ${order + 1}`,
        sort_order: order,
        item_description: sh.item_description || '',
        size_breakdown: b,
        total_garment_qty: tt,
        lines: (sh.lines || [emptyLine()]).map((l, i) => ({
          line_number: i + 1,
          material_description: l.material_description,
          variant: l.variant || null,
          consumption_per_unit: l.consumption_per_unit,
          unit: l.unit,
          total_required: l.total_required,
          inventory_item: l.inventory_item || null,
          remarks: l.remarks || null,
        })),
      };
    });
    return {
      pi: header.pi,
      indent_number: header.indent_number,
      buyer_po_reference: header.buyer_po_reference || null,
      intent_date: header.intent_date,
      packing_notes: header.packing_notes,
      status: header.status,
      prepared_by: header.prepared_by,
      received_by: header.received_by,
      approved_by: header.approved_by,
      notes: header.notes,
      sheets: outSheets,
    };
  };

  const handleSave = async () => {
    if (!header.pi) {
      setError('Select a PI');
      return;
    }
    if (!header.indent_number || !String(header.indent_number).trim()) {
      setError('Enter an indent number');
      return;
    }
    for (const sh of sheets) {
      if (!(sh.label || '').trim()) {
        setError('Each sheet must have a label (Excel tab name).');
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const body = buildPayload();
      if (isCreate) {
        const r = await ordersAPI.createIntent(body);
        navigate(`/intents/${r.data.id}`, { replace: true });
        return;
      }
      await ordersAPI.updateIntent(numericId, body);
      await loadById(numericId);
    } catch (e) {
      console.error(e);
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  const pageCanvas = useMemo(
    () => ({
      ...{
        position: 'relative',
        borderRadius: { xs: 0, md: '20px' },
        px: { xs: 0, sm: 1 },
        py: 2,
      },
      bgcolor: alpha(theme.palette.background.default, 0.5),
    }),
    [theme],
  );

  if (loading) {
    return (
      <Box sx={{ minHeight: 300, p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={pageCanvas}>
      <PageHeader
        kicker="Planning"
        title={isCreate ? 'New intent (indent)' : 'Edit intent'}
        subtitle="Header fields apply to the whole workbook. Add multiple labelled sheets like Excel tabs — each has its own size & colour matrix and BOM."
        actions={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/intents')}>
              Back
            </Button>
            <Button startIcon={<Save />} variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        }
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <TextField
            select
            required
            fullWidth
            label="PI"
            value={header.pi || ''}
            onChange={onPiChange}
            disabled={!isCreate}
          >
            {piList.map((pi) => (
              <MenuItem key={pi.id} value={pi.id}>
                {pi.pi_number} — {pi.client_name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            required
            fullWidth
            label="Indent number (unique)"
            value={header.indent_number}
            onChange={(e) => setHeader((h) => ({ ...h, indent_number: e.target.value }))}
            disabled={!isCreate}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="Buyer PO reference"
            value={header.buyer_po_reference}
            onChange={(e) => setHeader((h) => ({ ...h, buyer_po_reference: e.target.value }))}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            type="date"
            fullWidth
            label="Intent date"
            value={header.intent_date}
            onChange={(e) => setHeader((h) => ({ ...h, intent_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            select
            fullWidth
            label="Status"
            value={header.status}
            onChange={(e) => setHeader((h) => ({ ...h, status: e.target.value }))}
          >
            <MenuItem value="DRAFT">Draft</MenuItem>
            <MenuItem value="SUBMITTED">Submitted</MenuItem>
            <MenuItem value="APPROVED">Approved</MenuItem>
            <MenuItem value="CLOSED">Closed</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Packing / carton (whole intent)"
            value={header.packing_notes}
            onChange={(e) => setHeader((h) => ({ ...h, packing_notes: e.target.value }))}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Prepared by"
            value={header.prepared_by}
            onChange={(e) => setHeader((h) => ({ ...h, prepared_by: e.target.value }))}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Received by"
            value={header.received_by}
            onChange={(e) => setHeader((h) => ({ ...h, received_by: e.target.value }))}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="Approved by"
            value={header.approved_by}
            onChange={(e) => setHeader((h) => ({ ...h, approved_by: e.target.value }))}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={2}
            label="Notes (e.g. Excel “CID” reference)"
            value={header.notes}
            onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))}
          />
        </Grid>
      </Grid>

      <Paper
        variant="outlined"
        sx={{
          mt: 3,
          p: 2,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.96),
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1} sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Workbook sheets
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
            <Button startIcon={<NoteAdd />} size="small" variant="outlined" onClick={addSheet}>
              Add sheet
            </Button>
            {sheets.length > 1 ? (
              <Button startIcon={<Delete />} size="small" color="error" onClick={() => removeSheet(tab)}>
                Remove this tab
              </Button>
            ) : null}
          </Stack>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          {sheets.map((s, i) => (
            <Tab key={i} label={s.label || `Sheet ${i + 1}`} />
          ))}
        </Tabs>

        {currentSheet && (
          <Box>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  required
                  fullWidth
                  label="Sheet label (Excel tab name)"
                  value={currentSheet.label}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSheets((r) => r.map((s, i) => (i === tab ? { ...s, label: v } : s)));
                  }}
                  placeholder="e.g. Waterproof Trousers"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Total garment qty (this sheet, from grid)"
                  value={currentSheet.sizeRows.reduce((a, r) => a + totalForSizes(r.sizes), 0)}
                  InputProps={{ readOnly: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Item description (this sheet header)"
                  value={currentSheet.item_description}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSheets((r) => r.map((s, i) => (i === tab ? { ...s, item_description: v } : s)));
                  }}
                />
              </Grid>
            </Grid>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="subtitle1" fontWeight={800}>
                Size &amp; colour
              </Typography>
              <Button
                size="small"
                startIcon={<AddCircleOutline />}
                onClick={() => {
                  const s = currentSheet;
                  if (!s) return;
                  updateCurrentSheet({
                    sizeRows: [...s.sizeRows, emptySizeRow('Colour')],
                  });
                }}
              >
                Add colour
              </Button>
            </Stack>
            <Paper variant="outlined" sx={{ p: 1, overflow: 'auto', mb: 2 }}>
              <IntentSizeColourGrid
                sizeRows={currentSheet.sizeRows}
                onChange={(rows) => updateCurrentSheet({ sizeRows: rows })}
              />
            </Paper>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={800}>
                Material lines (BOM)
              </Typography>
              <Button startIcon={<Add />} size="small" variant="outlined" onClick={handleAddLine}>
                Add line
              </Button>
            </Stack>
            {(currentSheet.lines || [emptyLine()]).map((line, li) => (
              <Grid container spacing={1} key={li} sx={{ mb: 1, alignItems: 'center' }}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Material"
                    value={line.material_description}
                    onChange={(e) => handleLineChange(li, 'material_description', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Colour / variant"
                    value={line.variant}
                    onChange={(e) => handleLineChange(li, 'variant', e.target.value)}
                  />
                </Grid>
                <Grid item xs={6} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Per unit"
                    value={line.consumption_per_unit}
                    onChange={(e) => handleLineChange(li, 'consumption_per_unit', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4} md={1}>
                  <TextField
                    fullWidth
                    size="small"
                    label="UoM"
                    value={line.unit}
                    onChange={(e) => handleLineChange(li, 'unit', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4} md={2}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Total req."
                    value={line.total_required}
                    onChange={(e) => handleLineChange(li, 'total_required', e.target.value)}
                  />
                </Grid>
                <Grid item xs={4} md={1}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="Store SKU"
                    value={line.inventory_item}
                    onChange={(e) => handleLineChange(li, 'inventory_item', e.target.value)}
                  >
                    <MenuItem value="">—</MenuItem>
                    {inventoryItems.map((it) => (
                      <MenuItem key={it.id} value={it.id}>
                        {it.item_code}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={1}>
                  <IconButton size="small" onClick={() => handleRemoveLine(li)} disabled={(currentSheet.lines || []).length < 2}>
                    <Delete fontSize="small" />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default IntentEditorPage;
