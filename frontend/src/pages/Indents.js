import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, IconButton, Chip, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx } from '../theme/appTheme';
import { ordersAPI } from '../services/api';

const STATUS_COLOR = { DRAFT: 'default', CONFIRMED: 'success' };

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function Indents() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);

  const piFilter = searchParams.get('piId');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = piFilter ? { pi: piFilter } : {};
      const res = await ordersAPI.getIndents(params);
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [piFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this indent?')) return;
    try {
      await ordersAPI.deleteIndent(id);
      load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const columns = [
    {
      field: 'indent_number', headerName: 'Indent No', flex: 1, minWidth: 140,
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'primary.main' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'pi_number', headerName: 'PI Ref', flex: 1, minWidth: 140,
      renderCell: (p) => <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value}</Typography>,
    },
    {
      field: 'pi_ref', headerName: 'Buyer PO', flex: 1, minWidth: 130,
      renderCell: (p) => <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{p.value || '—'}</Typography>,
    },
    {
      field: 'item_name', headerName: 'Item', flex: 2, minWidth: 200,
      renderCell: (p) => (
        <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'normal', lineHeight: 1.3 }}>{p.value}</Typography>
      ),
    },
    {
      field: 'total_qty', headerName: 'Total Qty', width: 100, type: 'number',
      renderCell: (p) => <Typography sx={{ fontWeight: 700 }}>{p.value?.toLocaleString()}</Typography>,
    },
    {
      field: 'fabric_count', headerName: 'Fabrics', width: 80,
      renderCell: (p) => <Chip label={p.value} size="small" color="info" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />,
    },
    {
      field: 'trim_count', headerName: 'Trims', width: 80,
      renderCell: (p) => <Chip label={p.value} size="small" color="secondary" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />,
    },
    {
      field: 'status', headerName: 'Status', width: 110,
      renderCell: (p) => (
        <Chip label={p.value} size="small" color={STATUS_COLOR[p.value] || 'default'}
          sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
      ),
    },
    {
      field: 'indent_date', headerName: 'Date', width: 110,
      renderCell: (p) => <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{p.value}</Typography>,
    },
    {
      field: 'actions', headerName: '', width: 110, sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View / Edit Indent">
            <IconButton size="small" onClick={() => navigate(`/indents/${p.row.id}`)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => navigate(`/indents/${p.row.id}`)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(p.row.id)}>
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Indents"
        subtitle="Material & trim indents raised against Proforma Invoices"
        action={
          <Button startIcon={<Add />} variant="contained" onClick={() => navigate('/indents/new')}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Create Indent
          </Button>
        }
      />

      <DataGridShell>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          sx={dataGridSx}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>
    </Box>
  );
}
