import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, IconButton, Chip, Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, PointOfSale, Visibility } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import SalesEntryViewModal from '../components/sales/SalesEntryViewModal';
import { dataGridSx } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { salesEntryAPI } from '../services/api';

const STATUS_COLORS = {
  DRAFT: 'default',
  OPEN: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  CANCELLED: 'error',
};

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const fmtMoney = (amount, currency = 'USD') => {
  const num = Number(amount);
  if (Number.isNaN(num)) return '—';
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function SalesEntries() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesEntryAPI.getAll();
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sales entry?')) return;
    try {
      await salesEntryAPI.delete(id);
      load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const cell = (align = 'left', children) => (
    <Box sx={{
      display: 'flex', alignItems: 'center', width: '100%', height: '100%', px: 0.5,
      justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
    }}>
      {children}
    </Box>
  );

  const columns = [
    {
      field: 'internal_ref', headerName: 'Ref', flex: 1, minWidth: 130,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'primary.main' }}>{p.value}</Typography>
      ),
    },
    {
      field: 'invoice_number', headerName: 'Invoice No.', flex: 1, minWidth: 120,
      renderCell: (p) => cell('left', <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value}</Typography>),
    },
    {
      field: 'customer_name', headerName: 'Buyer', flex: 1.2, minWidth: 150,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PointOfSale sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7 }} />
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'buyer_po_number', headerName: 'Buyer PO', flex: 1, minWidth: 120,
      renderCell: (p) => cell('left', <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{p.value || '—'}</Typography>),
    },
    {
      field: 'sale_date', headerName: 'Sale / Dispatch', width: 120,
      renderCell: (p) => cell('left', <Typography sx={{ fontSize: '0.82rem' }}>{formatDateDisplay(p.value)}</Typography>),
    },
    {
      field: 'collection_due_date', headerName: 'Collection Due', width: 120,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: p.value ? 'warning.dark' : 'text.disabled' }}>
          {formatDateDisplay(p.value || p.row.due_date)}
        </Typography>
      ),
    },
    {
      field: 'total_amount', headerName: 'Total', flex: 0.8, minWidth: 120, align: 'right', headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography className="font-numeric" sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
          {fmtMoney(p.value, p.row.currency || 'USD')}
        </Typography>
      ),
    },
    {
      field: 'balance_due', headerName: 'Balance', flex: 0.8, minWidth: 120, align: 'right', headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography className="font-numeric" sx={{ fontWeight: 700, fontSize: '0.85rem', color: Number(p.value) > 0 ? 'error.dark' : 'success.dark' }}>
          {fmtMoney(p.value, p.row.currency || 'USD')}
        </Typography>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 110, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Chip label={p.value} size="small" color={STATUS_COLORS[p.value] || 'default'}
          sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }} />
      ),
    },
    {
      field: 'actions', headerName: '', width: 130, sortable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => setViewId(p.row.id)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => navigate(`/sales/${p.row.id}`)}>
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
        title="Sales Entry"
        subtitle="Record dispatched / invoiced sales to buyers — drives receivables on the dashboard"
        actions={
          <Button startIcon={<Add />} variant="contained" onClick={() => navigate('/sales/new')}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            New Sales Entry
          </Button>
        }
      />

      <DataGridShell>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          rowHeight={64}
          columnHeaderHeight={48}
          sx={dataGridSx}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>

      <SalesEntryViewModal
        open={Boolean(viewId)}
        entryId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => { setViewId(null); navigate(`/sales/${id}`); }}
      />
    </Box>
  );
}
