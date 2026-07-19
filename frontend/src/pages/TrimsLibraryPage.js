import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, TextField, IconButton, Chip, Drawer,
  Grid, MenuItem, Tooltip, Divider, CircularProgress, Autocomplete,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import { Add, Edit, Delete, Close, Save, LibraryBooks } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { ordersAPI, suppliersAPI } from '../services/api';
import {
  TRIM_PROPERTY_NAME_SUGGESTIONS,
  TRIM_CATEGORY_SUGGESTIONS,
  TRIM_UNIT_OPTIONS as UNIT_OPTIONS,
  isNumericTrimProperty,
  isCartonBoxCategory,
  normalizeTrimPropertyName,
  formatTrimPropertyLabel,
  applyCartonBoxCategoryToForm,
  defaultValuesFromCartonBox,
  cartonBoxFromDefaultValues,
  emptyCartonDefaults,
  formatCartonBoxSummary,
} from '../components/trims/trimConstants';
import CartonBoxDefaultsFields from '../components/trims/CartonBoxDefaultsFields';

const emptyProperty = () => ({ name: '', unit: '' });
const emptyForm = () => ({
  name: '', category: '', default_unit: 'PCS', notes: '', properties: [], supplier: null,
  cartonDefaults: emptyCartonDefaults(),
});

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function TrimsLibraryPage() {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [drawerOpen, setDrawer] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [suppliers, setSuppliers] = useState([]);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await suppliersAPI.getAll({ is_active: true });
      setSuppliers(asList(res.data));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersAPI.getTrimsMaster({ search });
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyForm()); setDrawer(true); };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      category: row.category || '',
      default_unit: row.default_unit || 'PCS',
      notes: row.notes || '',
      properties: (row.properties || []).map((p) => ({ name: p.name || '', unit: p.unit || '' })),
      supplier: row.supplier || null,
      cartonDefaults: isCartonBoxCategory(row.category)
        ? cartonBoxFromDefaultValues(row.default_property_values || {})
        : emptyCartonDefaults(),
    });
    setDrawer(true);
  };

  const addProperty = () => setForm((f) => ({ ...f, properties: [...f.properties, emptyProperty()] }));

  const updateProperty = (idx, field, value) => {
    setForm((f) => {
      const props = [...f.properties];
      const next = { ...props[idx], [field]: value };
      if (field === 'name') {
        next.name = normalizeTrimPropertyName(value);
        if (isNumericTrimProperty(next.name)) next.unit = '';
      }
      props[idx] = next;
      return { ...f, properties: props };
    });
  };

  const removeProperty = (idx) => {
    setForm((f) => ({ ...f, properties: f.properties.filter((_, i) => i !== idx) }));
  };

  const handleCategoryChange = (category) => {
    setForm((f) => applyCartonBoxCategoryToForm({ ...f, category }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Trim name is required.'); return; }
    const properties = form.properties
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), unit: (p.unit || '').trim() }));
    const default_property_values = isCartonBoxCategory(form.category)
      ? defaultValuesFromCartonBox(form.cartonDefaults)
      : {};

    setSaving(true);
    try {
      const payload = {
        name: form.name,
        category: form.category,
        default_unit: form.default_unit,
        notes: form.notes,
        properties,
        supplier: form.supplier || null,
        default_property_values,
      };
      if (editing) {
        await ordersAPI.updateTrim(editing.id, payload);
      } else {
        await ordersAPI.createTrim(payload);
      }
      setDrawer(false);
      load();
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert('Save failed: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trim? This won\'t affect existing indents.')) return;
    try {
      await ordersAPI.deleteTrim(id);
      load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const cell = (align = 'left', children) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%',
        height: '100%',
        px: 0.5,
      }}
    >
      {children}
    </Box>
  );

  const trimsGridSx = {
    ...dataGridSx,
    width: '100%',
    bgcolor: '#fff',
    '& .MuiDataGrid-columnHeaders': {
      ...(dataGridSx['& .MuiDataGrid-columnHeaders'] || {}),
      bgcolor: slate[50],
      borderBottom: `2px solid ${slate[200]}`,
    },
    '& .MuiDataGrid-cell': {
      ...(dataGridSx['& .MuiDataGrid-cell'] || {}),
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid ${slate[100]}`,
    },
  };

  const columns = [
    {
      field: 'name', headerName: 'Trim Name', flex: 2, minWidth: 200,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LibraryBooks sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7 }} />
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase' }}>{p.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'category', headerName: 'Category', flex: 1, minWidth: 100, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        p.value ? (
          <Chip label={p.value} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem', bgcolor: alpha('#6366f1', 0.1), color: '#4338ca' }} />
        ) : (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>
        )
      ),
    },
    {
      field: 'properties', headerName: 'Properties', flex: 2, minWidth: 200, sortable: false,
      renderCell: (p) => {
        const props = p.value || [];
        const defaults = p.row.default_property_values || {};
        if (isCartonBoxCategory(p.row.category) && formatCartonBoxSummary(defaults)) {
          return cell('left',
            <Typography sx={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
              {formatCartonBoxSummary(defaults)}
            </Typography>,
          );
        }
        if (!props.length) {
          return cell('left', <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>);
        }
        return cell('left',
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
            {props.map((prop, i) => (
              <Chip
                key={i}
                size="small"
                label={formatTrimPropertyLabel(prop)}
                sx={{ fontSize: '0.68rem', fontWeight: 600 }}
              />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'default_unit', headerName: 'Default Unit', width: 110, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center', <Chip label={p.value} size="small" variant="outlined" sx={{ fontSize: '0.7rem', fontWeight: 700 }} />),
    },
    {
      field: 'supplier_name', headerName: 'Supplier', flex: 1, minWidth: 140,
      renderCell: (p) => cell('left',
        p.value ? (
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.value}</Typography>
        ) : (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>
        )
      ),
    },
    {
      field: 'actions', headerName: '', width: 100, sortable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEdit(p.row)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(p.row.id)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Trims Library"
        subtitle="Define trims with configurable properties (name + unit) used when building indents"
        actions={
          <Button startIcon={<Add />} variant="contained" onClick={openNew} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Add Trim
          </Button>
        }
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search by name or category…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 320, '& .MuiInputBase-root': { borderRadius: 2 } }}
        />
      </Box>

      <DataGridShell>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          rowHeight={64}
          columnHeaderHeight={48}
          sx={trimsGridSx}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawer(false)}
        PaperProps={{ sx: { width: { xs: '100vw', sm: 480 }, p: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', flex: 1 }}>
            {editing ? 'Edit Trim' : 'Add New Trim'}
          </Typography>
          <IconButton onClick={() => setDrawer(false)}><Close /></IconButton>
        </Box>
        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Trim Name *"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
              placeholder="e.g. 5 CM WIDE REFLECTIVE TAPE D6101"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              options={TRIM_CATEGORY_SUGGESTIONS}
              value={form.category}
              onInputChange={(_, v) => handleCategoryChange(v)}
              renderInput={(params) => <TextField {...params} size="small" fullWidth label="Category" />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" select label="Default Consumption Unit"
              value={form.default_unit}
              onChange={(e) => setForm((f) => ({ ...f, default_unit: e.target.value }))}>
              {UNIT_OPTIONS.filter(Boolean).map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Grid>

          <Grid item xs={12}>
            <Autocomplete
              options={suppliers}
              getOptionLabel={(o) => o.name || ''}
              value={suppliers.find((s) => s.id === form.supplier) || null}
              onChange={(_, v) => setForm((f) => ({ ...f, supplier: v?.id || null }))}
              renderOption={(props, o) => (
                <Box component="li" {...props}>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{o.name}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{o.country}{o.gst ? ` · ${o.gst}` : ''}</Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} size="small" fullWidth label="Supplier (optional)"
                  placeholder="Select preferred supplier for this trim" />
              )}
            />
          </Grid>

          {/* Properties builder */}
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>Properties</Typography>
              <Button size="small" startIcon={<Add />} onClick={addProperty} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Add Property
              </Button>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5 }}>
              Define property names and units (e.g. Width → CMS, Size → button dia., Garment Size → PI size, Number / Washes → no unit)
            </Typography>
            {form.properties.length === 0 ? (
              <Box sx={{ p: 2, bgcolor: alpha(slate[200], 0.3), borderRadius: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No properties yet — click Add Property</Typography>
              </Box>
            ) : (
              <Table size="small" sx={{ border: `1px solid ${slate[200]}`, borderRadius: 1 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(slate[900], 0.04) }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Property Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Unit</TableCell>
                    <TableCell width={40} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.properties.map((prop, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ py: 0.75 }}>
                        <Autocomplete
                          freeSolo
                          options={TRIM_PROPERTY_NAME_SUGGESTIONS}
                          value={prop.name}
                          onInputChange={(_, v) => updateProperty(idx, 'name', v)}
                          renderInput={(params) => (
                            <TextField {...params} size="small" fullWidth placeholder="Width, Color, Microns, GSM…" />
                          )}
                        />
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        {isNumericTrimProperty(prop.name) ? (
                          <TextField size="small" fullWidth disabled value="—"
                            helperText="Numeric only" FormHelperTextProps={{ sx: { mx: 0, fontSize: '0.65rem' } }} />
                        ) : (
                          <Autocomplete
                            freeSolo
                            options={UNIT_OPTIONS}
                            value={prop.unit}
                            onInputChange={(_, v) => updateProperty(idx, 'unit', v)}
                            renderInput={(params) => <TextField {...params} size="small" placeholder="e.g. CMS, PCS" />}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <IconButton size="small" color="error" onClick={() => removeProperty(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Grid>

          {isCartonBoxCategory(form.category) && (
            <Grid item xs={12}>
              <CartonBoxDefaultsFields values={form.cartonDefaults} onChange={(cartonDefaults) => setForm((f) => ({ ...f, cartonDefaults }))} />
            </Grid>
          )}

          <Grid item xs={12}>
            <TextField fullWidth size="small" multiline minRows={2} label="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Grid>
        </Grid>

        <Box sx={{ mt: 4, display: 'flex', gap: 1.5 }}>
          <Button fullWidth variant="outlined" onClick={() => setDrawer(false)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Cancel
          </Button>
          <Button fullWidth variant="contained" onClick={handleSave} disabled={saving}
            startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
            sx={{ textTransform: 'none', fontWeight: 800 }}>
            {saving ? 'Saving…' : 'Save Trim'}
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
}
