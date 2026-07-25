import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, TextField, IconButton, Chip, Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, LibraryBooks } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { ordersAPI } from '../services/api';
import {
  isCartonBoxCategory,
  formatTrimPropertyLabel,
  formatCartonBoxSummary,
} from '../components/trims/trimConstants';
import AddTrimModal from '../components/trims/AddTrimModal';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function TrimsLibraryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const showSpinner = !initialLoadDone.current;
    if (showSpinner) setLoading(true);
    try {
      const res = await ordersAPI.getTrimsMaster({ search: debouncedSearch });
      setRows(asList(res.data));
      initialLoadDone.current = true;
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

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
    height: '100%',
    border: 'none',
    bgcolor: '#fff',
    '& .MuiDataGrid-main': { overflow: 'hidden' },
    '& .MuiDataGrid-virtualScroller': {
      overflowY: 'auto !important',
      overscrollBehavior: 'contain',
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
    <Box
      sx={{
        height: {
          xs: 'calc(100dvh - 68px - 32px)',
          sm: 'calc(100dvh - 76px - 48px)',
          md: 'calc(100dvh - 76px - 64px)',
        },
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <PageHeader
          title="Trims Library"
          subtitle="Define trims with configurable properties (name + unit) used when building indents"
          compact
          actions={
            <Button startIcon={<Add />} variant="contained" onClick={openNew} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
              Add Trim
            </Button>
          }
        />

        <Box sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="Search by name or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: { xs: '100%', sm: 320 }, '& .MuiInputBase-root': { borderRadius: 2 } }}
          />
        </Box>
      </Box>

      <DataGridShell
        sx={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          '&:hover': { boxShadow: (theme) => theme.shadows[1] },
        }}
      >
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

      <AddTrimModal
        open={modalOpen}
        editing={editing}
        onClose={closeModal}
        onSaved={() => load()}
      />
    </Box>
  );
}
