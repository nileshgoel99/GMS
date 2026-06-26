import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, TextField, IconButton, Typography, Grid, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, Autocomplete, CircularProgress, Divider,
} from '@mui/material';
import { Add, Delete, Close, Save, LibraryBooks } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { ordersAPI, suppliersAPI } from '../../services/api';
import { slate } from '../../theme/appTheme';
import {
  TRIM_PROPERTY_NAME_SUGGESTIONS,
  isNumericTrimProperty,
  normalizeTrimPropertyName,
} from './trimConstants';

export const TRIM_CATEGORY_SUGGESTIONS = [
  'Fabric', 'Tape', 'Button', 'Velcro', 'Zipper', 'Thread', 'Label',
  'Polybag', 'Waist Band', 'Hook & Loop', 'Sticker', 'Other',
];

export const TRIM_UNIT_OPTIONS = ['MTRS', 'PCS', 'CONES', 'KG', 'SET', 'PAIR', 'ROLL', 'GROSS', 'CMS', 'CM', 'MM', 'INCH', 'GMS', ''];

const emptyProperty = () => ({ name: '', unit: '' });
export const emptyTrimForm = () => ({
  name: '', category: '', default_unit: 'PCS', notes: '', properties: [], supplier: null,
});

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function AddTrimModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState(emptyTrimForm());
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await suppliersAPI.getAll({ is_active: true });
      setSuppliers(asList(res.data));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (open) loadSuppliers();
  }, [open, loadSuppliers]);

  const handleClose = () => {
    if (!saving) {
      setForm(emptyTrimForm());
      onClose();
    }
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

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Trim name is required.');
      return;
    }
    const properties = form.properties
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), unit: (p.unit || '').trim() }));

    setSaving(true);
    try {
      const res = await ordersAPI.createTrim({ ...form, supplier: form.supplier || null, properties });
      onSaved?.(res.data);
      setForm(emptyTrimForm());
      onClose();
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert('Save failed: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <LibraryBooks sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 800, flex: 1 }}>Add New Trim to Library</Typography>
        <IconButton size="small" onClick={handleClose} disabled={saving}><Close /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Trim Name *" autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 5 CM WIDE Reflective Tape D6101"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              options={TRIM_CATEGORY_SUGGESTIONS}
              value={form.category}
              onInputChange={(_, v) => setForm((f) => ({ ...f, category: v }))}
              renderInput={(params) => <TextField {...params} size="small" fullWidth label="Category" />}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth size="small" select label="Default Consumption Unit"
              value={form.default_unit}
              onChange={(e) => setForm((f) => ({ ...f, default_unit: e.target.value }))}>
              {TRIM_UNIT_OPTIONS.filter(Boolean).map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
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
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{o.country}</Typography>
                  </Box>
                </Box>
              )}
              renderInput={(params) => (
                <TextField {...params} size="small" fullWidth label="Supplier (optional)" />
              )}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>Properties</Typography>
              <Button size="small" startIcon={<Add />} onClick={addProperty} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Add Property
              </Button>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5 }}>
              Property name + unit (e.g. Width → CMS, Size → button dia., Garment Size → PI size, Number / Washes → no unit)
            </Typography>
            {form.properties.length === 0 ? (
              <Box sx={{ p: 2, bgcolor: alpha(slate[200], 0.3), borderRadius: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No properties — optional</Typography>
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
                            options={TRIM_UNIT_OPTIONS}
                            value={prop.unit}
                            onInputChange={(_, v) => updateProperty(idx, 'unit', v)}
                            renderInput={(params) => <TextField {...params} size="small" placeholder="CMS, PCS…" />}
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

          <Grid item xs={12}>
            <TextField fullWidth size="small" multiline minRows={2} label="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={saving} sx={{ fontWeight: 700, textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          sx={{ fontWeight: 800, textTransform: 'none', px: 3 }}>
          {saving ? 'Saving…' : 'Save & Use Trim'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
