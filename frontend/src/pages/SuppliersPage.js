import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, TextField, IconButton, Chip, Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, LocalShipping } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import AddSupplierModal from '../components/suppliers/AddSupplierModal';
import { dataGridSx, slate } from '../theme/appTheme';
import { suppliersAPI } from '../services/api';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function SuppliersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await suppliersAPI.getAll({ search });
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier? Indent lines linked to it will keep working but lose the supplier link.')) return;
    try {
      await suppliersAPI.delete(id);
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
        minWidth: 0,
        minHeight: 64,
        px: 0.5,
        py: 0.75,
      }}
    >
      {children}
    </Box>
  );

  const suppliersGridSx = {
    ...dataGridSx,
    width: '100%',
    bgcolor: '#fff',
    '& .MuiDataGrid-main': { overflow: 'visible' },
    '& .MuiDataGrid-virtualScroller': {
      overflowX: 'auto !important',
      overflowY: 'visible !important',
      overscrollBehavior: 'auto',
    },
    '& .MuiDataGrid-filler, & .MuiDataGrid-scrollbarFiller': {
      display: 'none !important',
      width: '0 !important',
      minWidth: '0 !important',
    },
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
      overflow: 'visible !important',
      whiteSpace: 'normal !important',
    },
  };

  const formatTax = (row) => {
    if (!row.gst) return '—';
    const type = row.tax_id_type || (row.is_international ? 'Tax ID' : 'GST');
    return `${type}: ${row.gst}`;
  };

  const formatContact = (row) => {
    const parts = [row.contact_person, row.phone, row.email].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  };

  const columns = [
    {
      field: 'name', headerName: 'Supplier Name', flex: 1.5, minWidth: 180,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShipping sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7, flexShrink: 0 }} />
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3 }}>{p.value}</Typography>
            {p.row.city && (
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{p.row.city}</Typography>
            )}
          </Box>
        </Box>
      ),
    },
    {
      field: 'country', headerName: 'Country', width: 120,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontSize: '0.82rem' }}>{p.value}</Typography>
          {p.row.is_international && (
            <Chip label="Intl" size="small" sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700 }} />
          )}
        </Box>
      ),
    },
    {
      field: 'contact_person', headerName: 'Contact', flex: 1.5, minWidth: 180, sortable: false,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', whiteSpace: 'normal', lineHeight: 1.35 }}>
          {formatContact(p.row)}
        </Typography>
      ),
    },
    {
      field: 'gst', headerName: 'Tax ID', flex: 1, minWidth: 140,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{formatTax(p.row)}</Typography>
      ),
    },
    {
      field: 'supplies_in', headerName: 'Supplies In', flex: 1.4, minWidth: 160, sortable: false,
      renderCell: (p) => {
        const items = Array.isArray(p.value) ? p.value.filter(Boolean) : [];
        if (!items.length) {
          return cell('left', <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>);
        }
        return cell('left',
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, py: 0.5 }}>
            {items.slice(0, 4).map((s) => (
              <Chip key={s} label={s} size="small" sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600 }} />
            ))}
            {items.length > 4 && (
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', alignSelf: 'center' }}>
                +{items.length - 4}
              </Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'address', headerName: 'Address', flex: 1.5, minWidth: 160,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', whiteSpace: 'normal', lineHeight: 1.35 }}>
          {[p.value, p.row.state_province, p.row.postal_code].filter(Boolean).join(', ') || '—'}
        </Typography>
      ),
    },
    {
      field: 'is_active', headerName: 'Status', width: 90, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Chip
          label={p.value ? 'Active' : 'Inactive'}
          size="small"
          color={p.value ? 'success' : 'default'}
          sx={{ fontSize: '0.68rem', fontWeight: 700 }}
        />
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
        title="Suppliers"
        subtitle="Manage trim and material suppliers — domestic and international"
        actions={
          <Button startIcon={<Add />} variant="contained" onClick={openNew} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Add Supplier
          </Button>
        }
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small" placeholder="Search by name, country, contact, tax ID…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 360, '& .MuiInputBase-root': { borderRadius: 2 } }}
        />
      </Box>

      <DataGridShell
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          '& > .MuiDataGrid-root': {
            height: 'auto !important',
            width: '100%',
          },
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          autoHeight
          getRowHeight={() => 'auto'}
          columnHeaderHeight={48}
          scrollbarSize={0}
          sx={suppliersGridSx}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>

      <AddSupplierModal
        open={modalOpen}
        editing={editing}
        onClose={closeModal}
        onSaved={() => load()}
      />
    </Box>
  );
}
