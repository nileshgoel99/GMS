import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, TextField, IconButton, Chip, Drawer,
  Grid, MenuItem, Tooltip, Divider, CircularProgress, Autocomplete,
} from '@mui/material';
import { Add, Edit, Delete, Close, Save, LibraryBooks } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { ordersAPI } from '../services/api';

const CATEGORY_SUGGESTIONS = [
  'Fabric', 'Tape', 'Button', 'Velcro', 'Zipper', 'Thread', 'Label',
  'Polybag', 'Waist Band', 'Hook & Loop', 'Sticker', 'Other',
];

const UNIT_OPTIONS = ['MTRS', 'PCS', 'CONES', 'KG', 'SET', 'PAIR', 'ROLL'];

const emptyForm = () => ({ name: '', category: '', default_unit: 'PCS', notes: '' });

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function TrimsLibraryPage() {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [drawerOpen, setDrawer] = useState(false);
  const [editing, setEditing]   = useState(null); // null = new
  const [form, setForm]         = useState(emptyForm());
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');

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
  const openEdit = (row) => { setEditing(row); setForm({ name: row.name, category: row.category, default_unit: row.default_unit, notes: row.notes || '' }); setDrawer(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Trim name is required.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await ordersAPI.updateTrim(editing.id, form);
      } else {
        await ordersAPI.createTrim(form);
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

  const columns = [
    {
      field: 'name', headerName: 'Trim Name', flex: 2, minWidth: 220,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LibraryBooks sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7 }} />
          <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'category', headerName: 'Category', flex: 1, minWidth: 120,
      renderCell: (p) => p.value ? (
        <Chip label={p.value} size="small" sx={{ fontWeight: 600, fontSize: '0.7rem', bgcolor: alpha('#6366f1', 0.1), color: '#4338ca' }} />
      ) : '—',
    },
    { field: 'default_unit', headerName: 'Default Unit', width: 120, renderCell: (p) => <Chip label={p.value} size="small" variant="outlined" sx={{ fontSize: '0.7rem', fontWeight: 700 }} /> },
    { field: 'notes', headerName: 'Notes', flex: 1, minWidth: 150, renderCell: (p) => <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{p.value || '—'}</Typography> },
    {
      field: 'actions', headerName: '', width: 100, sortable: false,
      renderCell: (p) => (
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
        subtitle="Master list of trims and accessories used in indents"
        action={
          <Button startIcon={<Add />} variant="contained" onClick={openNew} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Add Trim
          </Button>
        }
      />

      {/* Search bar */}
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
          sx={dataGridSx}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>

      {/* Add / Edit Drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawer(false)}
        PaperProps={{ sx: { width: { xs: '100vw', sm: 420 }, p: 3 } }}>
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
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. 5 CM WIDE Reflective Tape D6101"
              helperText="Full descriptive name as it will appear on the indent"
            />
          </Grid>
          <Grid item xs={12}>
            <Autocomplete
              freeSolo
              options={CATEGORY_SUGGESTIONS}
              value={form.category}
              onInputChange={(_, v) => setForm((f) => ({ ...f, category: v }))}
              renderInput={(params) => (
                <TextField {...params} size="small" fullWidth label="Category"
                  placeholder="e.g. Tape, Button, Label…" />
              )}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" select label="Default Unit"
              value={form.default_unit}
              onChange={(e) => setForm((f) => ({ ...f, default_unit: e.target.value }))}>
              {UNIT_OPTIONS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth size="small" multiline minRows={2} label="Notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes about this trim…"
            />
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
