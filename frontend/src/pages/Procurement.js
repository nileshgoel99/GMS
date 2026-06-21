import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, IconButton, Chip, Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Add, Edit, Delete, LocalShipping, Visibility } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import SupplierPOViewModal from '../components/procurement/SupplierPOViewModal';
import { BuyerPoDetailDialog } from './BuyerPOs';
import { dataGridSx, slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { procurementAPI } from '../services/api';

const STATUS_COLORS = {
  DRAFT: 'default',
  ORDERED: 'info',
  PARTIAL: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function Procurement() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);
  const [buyerPoId, setBuyerPoId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await procurementAPI.getAll();
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase order?')) return;
    try {
      await procurementAPI.delete(id);
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

  const gridSx = {
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
    '& .MuiDataGrid-cell[data-field="total_amount"]': {
      overflow: 'visible',
      '& .MuiTypography-root': {
        overflow: 'visible',
        textOverflow: 'clip',
      },
    },
    '& .MuiDataGrid-row.po-row--alt': {
      bgcolor: `${alpha('#0f766e', 0.07)} !important`,
    },
  };

  const columns = [
    {
      field: 'po_number', headerName: 'PO Number', flex: 1, minWidth: 130,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'primary.main' }}>{p.value}</Typography>
      ),
    },
    {
      field: 'vendor_name', headerName: 'Supplier', flex: 1.5, minWidth: 160,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LocalShipping sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7 }} />
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value}</Typography>
        </Box>
      ),
    },
    {
      field: 'reference_number', headerName: 'Reference', flex: 1, minWidth: 140,
      renderCell: (p) => {
        const label = p.value || p.row.buyer_po_number || '—';
        const canOpen = Boolean(p.row.buyer_po);
        return cell('left',
          canOpen ? (
            <Typography
              component="button"
              type="button"
              onClick={() => setBuyerPoId(p.row.buyer_po)}
              sx={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'primary.main',
                cursor: 'pointer',
                border: 'none',
                bgcolor: 'transparent',
                p: 0,
                font: 'inherit',
                textAlign: 'left',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                '&:hover': { color: 'primary.dark' },
              }}
            >
              {label}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '0.82rem' }}>{label}</Typography>
          )
        );
      },
    },
    {
      field: 'order_date', headerName: 'Order Date', width: 110,
      renderCell: (p) => cell('left', <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{formatDateDisplay(p.value)}</Typography>),
    },
    {
      field: 'payment_due_date', headerName: 'Payment Due', width: 120,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: p.value ? 'warning.dark' : 'text.disabled' }}>
          {formatDateDisplay(p.value)}
        </Typography>
      ),
    },
    {
      field: 'expected_delivery_date', headerName: 'Delivery', width: 110,
      renderCell: (p) => cell('left', <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{formatDateDisplay(p.value)}</Typography>),
    },
    {
      field: 'total_amount', headerName: 'Total (₹)', flex: 0.9, minWidth: 150, align: 'right', headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography
          className="font-numeric"
          sx={{
            fontWeight: 700,
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
            overflow: 'visible',
            textOverflow: 'clip',
          }}
        >
          {p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
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
          <Tooltip title="Edit / Print">
            <IconButton size="small" color="primary" onClick={() => navigate(`/procurement/${p.row.id}`)}>
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
        title="Supplier Purchase Orders"
        subtitle="Raise POs to trim and material suppliers with GST breakdown and print-ready layout"
        actions={
          <Button startIcon={<Add />} variant="contained" onClick={() => navigate('/procurement/new')}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
            Raise PO
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
          getRowClassName={(p) => (rows.findIndex((r) => r.id === p.id) % 2 === 1 ? 'po-row--alt' : '')}
          sx={gridSx}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>

      <SupplierPOViewModal
        open={Boolean(viewId)}
        poId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => { setViewId(null); navigate(`/procurement/${id}`); }}
      />

      {buyerPoId && (
        <BuyerPoDetailDialog
          poId={buyerPoId}
          onClose={() => setBuyerPoId(null)}
        />
      )}
    </Box>
  );
}
