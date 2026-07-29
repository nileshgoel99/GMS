import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, TextField, IconButton, Typography, Grid, MenuItem,
  Table, TableHead, TableBody, TableRow, TableCell, Autocomplete, CircularProgress, Divider,
  createFilterOptions,
} from '@mui/material';
import { Add, Delete, Close, Save, LibraryBooks } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { ordersAPI } from '../../services/api';
import { slate } from '../../theme/appTheme';
import {
  TRIM_PROPERTY_NAME_SUGGESTIONS,
  TRIM_CATEGORY_SUGGESTIONS,
  TRIM_UNIT_OPTIONS,
  isNumericTrimProperty,
  normalizeTrimPropertyName,
  filterTrimPropertyNameOptions,
} from './trimConstants';
import { confirmDiscardUnsaved } from '../../hooks/useUnsavedChanges';

export { TRIM_CATEGORY_SUGGESTIONS, TRIM_UNIT_OPTIONS } from './trimConstants';

const emptyProperty = () => ({ name: '', unit: '' });
const filterCategoryOptions = createFilterOptions({ stringify: (o) => (typeof o === 'string' ? o : o.inputValue || o.title || '') });
export const emptyTrimForm = () => ({
  name: '', category: '', default_unit: 'PCS', notes: '', properties: [],
});

const formSnapshot = (f) => JSON.stringify({
  name: f?.name || '',
  category: f?.category || '',
  default_unit: f?.default_unit || 'PCS',
  notes: f?.notes || '',
  properties: f?.properties || [],
});
const noEllipsisFieldSx = {
  '& .MuiInputBase-input, & input': {
    textOverflow: 'clip',
    overflow: 'visible',
    whiteSpace: 'normal',
  },
};

export default function AddTrimModal({
  open,
  onClose,
  onSaved,
  editing = null,
  initialName = '',
  initialCategory = '',
  initialUnit = '',
}) {
  const [form, setForm] = useState(emptyTrimForm());
  const [saving, setSaving] = useState(false);
  const wasOpen = useRef(false);
  const baselineRef = useRef(formSnapshot(emptyTrimForm()));
  const isEdit = Boolean(editing?.id);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const next = editing
        ? {
          name: (editing.name || '').toUpperCase(),
          category: editing.category || '',
          default_unit: editing.default_unit || 'PCS',
          notes: editing.notes || '',
          properties: (editing.properties || []).map((p) => ({ name: p.name || '', unit: p.unit || '' })),
        }
        : {
          ...emptyTrimForm(),
          name: (initialName || '').toUpperCase(),
          category: initialCategory || '',
          default_unit: initialUnit || 'PCS',
        };
      setForm(next);
      baselineRef.current = formSnapshot(next);
    }
    wasOpen.current = open;
  }, [open, editing, initialName, initialCategory, initialUnit]);

  const isDirty = open && formSnapshot(form) !== baselineRef.current;

  const handleClose = () => {
    if (saving) return;
    if (!confirmDiscardUnsaved(isDirty)) return;
    setForm(emptyTrimForm());
    onClose();
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
    setForm((f) => ({ ...f, category: String(category || '').trim() }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Trim name is required.');
      return;
    }
    const properties = form.properties
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), unit: (p.unit || '').trim() }));

    // Preserve default values when editing and move a value with a renamed
    // property at the same position (e.g. "Colour" → "Shade").
    const defaultPropertyValues = { ...(editing?.default_property_values || {}) };
    if (isEdit) {
      (editing.properties || []).forEach((oldProp, index) => {
        const oldName = String(oldProp?.name || '').trim();
        const newName = String(properties[index]?.name || '').trim();
        if (
          oldName
          && newName
          && oldName !== newName
          && Object.prototype.hasOwnProperty.call(defaultPropertyValues, oldName)
        ) {
          if (!Object.prototype.hasOwnProperty.call(defaultPropertyValues, newName)) {
            defaultPropertyValues[newName] = defaultPropertyValues[oldName];
          }
          delete defaultPropertyValues[oldName];
        }
      });
    }

    const payload = {
      name: form.name,
      category: form.category,
      default_unit: form.default_unit,
      notes: form.notes,
      properties,
      default_property_values: defaultPropertyValues,
    };

    setSaving(true);
    try {
      const res = isEdit
        ? await ordersAPI.updateTrim(editing.id, payload)
        : await ordersAPI.createTrim(payload);
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '92vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <LibraryBooks sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 800, flex: 1 }}>
          {isEdit ? 'Edit Trim' : 'Add New Trim to Library'}
        </Typography>
        <IconButton size="small" onClick={handleClose} disabled={saving}><Close /></IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" label="Trim Name *" autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toUpperCase() }))}
              placeholder="e.g. 5 CM WIDE REFLECTIVE TAPE D6101"
              sx={noEllipsisFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              freeSolo
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              options={TRIM_CATEGORY_SUGGESTIONS}
              filterOptions={(options, params) => {
                const filtered = filterCategoryOptions(options, params);
                const typed = String(params.inputValue || '').trim();
                if (
                  typed
                  && !options.some((o) => String(o).toLowerCase() === typed.toLowerCase())
                ) {
                  filtered.push({
                    inputValue: typed,
                    title: `Create category “${typed}”`,
                  });
                }
                return filtered;
              }}
              getOptionLabel={(o) => {
                if (typeof o === 'string') return o;
                if (o?.inputValue) return o.inputValue;
                return o?.title || '';
              }}
              value={form.category}
              onChange={(_, v) => {
                const next = typeof v === 'string' ? v : (v?.inputValue || '');
                handleCategoryChange(next);
              }}
              onInputChange={(_, v, reason) => {
                if (reason === 'input' || reason === 'clear') handleCategoryChange(v);
              }}
              renderOption={(props, option) => {
                const { key, ...rest } = props;
                if (option?.inputValue) {
                  return (
                    <Box component="li" key={key} {...rest} sx={{ fontWeight: 700, color: 'primary.main' }}>
                      {option.title}
                    </Box>
                  );
                }
                return (
                  <Box component="li" key={key} {...rest}>{option}</Box>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  fullWidth
                  label="Category"
                  placeholder="Tape, Button, or create new…"
                  helperText="Pick a suggestion or type a new category name"
                  sx={noEllipsisFieldSx}
                />
              )}
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
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', flex: 1 }}>Properties</Typography>
              <Button size="small" startIcon={<Add />} onClick={addProperty} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Add Property
              </Button>
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1.5 }}>
              Pick a suggested type or type any custom name (e.g. Width → MM/CMS, Pantone, Finish).
              Click Add Property for each extra type this trim needs.
            </Typography>
            {form.properties.length === 0 ? (
              <Box sx={{ p: 2, bgcolor: alpha(slate[200], 0.3), borderRadius: 1.5, textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  No properties yet — click Add Property to define Width, Color, or any custom type
                </Typography>
              </Box>
            ) : (
              <Table size="small" sx={{ border: `1px solid ${slate[200]}`, borderRadius: 1, tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(slate[900], 0.04) }}>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', width: '55%' }}>Property type</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', width: '35%' }}>Unit</TableCell>
                    <TableCell width={48} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {form.properties.map((prop, idx) => {
                    const usedNames = new Set(
                      form.properties
                        .map((p, i) => (i === idx ? '' : String(p.name || '').trim().toLowerCase()))
                        .filter(Boolean),
                    );
                    const nameOptions = TRIM_PROPERTY_NAME_SUGGESTIONS.filter(
                      (n) => !usedNames.has(n.toLowerCase()),
                    );
                    return (
                    <TableRow key={idx}>
                      <TableCell sx={{ py: 0.75 }}>
                        <Autocomplete
                          freeSolo
                          selectOnFocus
                          clearOnBlur={false}
                          blurOnSelect
                          handleHomeEndKeys
                          autoHighlight
                          options={nameOptions}
                          filterOptions={(options, params) => {
                            const filtered = filterTrimPropertyNameOptions(options, params);
                            const typed = normalizeTrimPropertyName(params.inputValue || '');
                            if (
                              typed
                              && !options.some((o) => String(o).toLowerCase() === typed.toLowerCase())
                              && !usedNames.has(typed.toLowerCase())
                            ) {
                              filtered.push({
                                inputValue: typed,
                                title: `Add custom type “${typed}”`,
                              });
                            }
                            return filtered;
                          }}
                          getOptionLabel={(o) => {
                            if (typeof o === 'string') return o;
                            if (o?.inputValue) return o.inputValue;
                            return o?.title || '';
                          }}
                          isOptionEqualToValue={(option, value) => {
                            const a = typeof option === 'string' ? option : (option?.inputValue || '');
                            const b = typeof value === 'string' ? value : (value?.inputValue || '');
                            return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
                          }}
                          value={prop.name || null}
                          inputValue={prop.name || ''}
                          onChange={(_, v) => {
                            if (v == null) {
                              updateProperty(idx, 'name', '');
                              return;
                            }
                            const next = typeof v === 'string' ? v : (v?.inputValue || '');
                            updateProperty(idx, 'name', next);
                          }}
                          onInputChange={(_, v, reason) => {
                            if (reason === 'input' || reason === 'clear') updateProperty(idx, 'name', v);
                          }}
                          renderOption={(props, option) => {
                            const { key, ...rest } = props;
                            if (option?.inputValue) {
                              return (
                                <Box component="li" key={key} {...rest} sx={{ fontWeight: 700, color: 'primary.main' }}>
                                  {option.title}
                                </Box>
                              );
                            }
                            return (
                              <Box component="li" key={key} {...rest}>{option}</Box>
                            );
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              size="small"
                              fullWidth
                              placeholder="Width, Color, or type a new type…"
                              sx={noEllipsisFieldSx}
                            />
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
                            renderInput={(params) => (
                              <TextField {...params} size="small" fullWidth placeholder="MM, CMS, PCS…" sx={noEllipsisFieldSx} />
                            )}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <IconButton size="small" color="error" onClick={() => removeProperty(idx)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    );
                  })}
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
          {saving ? 'Saving…' : isEdit ? 'Save Trim' : 'Save & Use Trim'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
