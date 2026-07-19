import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, IconButton, Chip, Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Add, Edit, Delete, LocalShipping, Visibility, ReceiptLong, Checkroom } from '@mui/icons-material';
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

/** Taller rows when supplier names wrap to multiple lines. */
const estimatePoRowHeight = (vendorName = '') => {
  const text = String(vendorName || '').trim();
  if (text.length <= 26) return 64;
  const lines = Math.ceil(text.length / 26);
  return Math.min(64 + (lines - 1) * 24, 128);
};

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

  const cell = (align = 'left', children, { multiline = false } = {}) => (
    <Box sx={{
      display: 'flex', alignItems: multiline ? 'flex-start' : 'center', width: '100%', height: '100%', px: 0.5,
      py: multiline ? 0.75 : 0,
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
    '& .MuiDataGrid-cell[data-field="vendor_name"]': {
      overflow: 'visible',
      whiteSpace: 'normal',
      lineHeight: 1.45,
      alignItems: 'flex-start',
      py: 0.75,
      '& .MuiTypography-root': {
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflow: 'visible',
        textOverflow: 'clip',
        lineHeight: 1.45,
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
      field: 'vendor_name', headerName: 'Supplier', flex: 1.8, minWidth: 200,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0, width: '100%' }}>
          <LocalShipping sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7, mt: 0.15, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.45 }}>
            {p.value || '—'}
          </Typography>
        </Box>,
        { multiline: true },
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
      field: 'actions', headerName: '', width: 160, sortable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Record bill">
            <IconButton size="small" color="secondary" onClick={() => navigate(`/purchase-bills/new?poId=${p.row.id}`)}>
              <ReceiptLong fontSize="small" />
            </IconButton>
          </Tooltip>
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
        subtitle="Raise POs to trim and fabric suppliers with GST breakdown and print-ready layout"
        actions={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => navigate('/procurement/new')}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}
            >
              Raise Trim PO
            </Button>
            <Button
              startIcon={<Checkroom />}
              variant="contained"
              onClick={() => navigate('/procurement/new?mode=fabric')}
              sx={{
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: 1.5,
                color: '#fff',
                border: `1px solid ${alpha('#0d9488', 0.45)}`,
                boxShadow: `0 2px 10px ${alpha('#0f766e', 0.35)}`,
                backgroundColor: '#0f766e',
                backgroundImage: `repeating-linear-gradient(135deg, ${alpha('#fff', 0.08)} 0px, ${alpha('#fff', 0.08)} 4px, transparent 4px, transparent 10px)`,
                '&:hover': {
                  backgroundColor: '#0d9488',
                  boxShadow: `0 4px 14px ${alpha('#0f766e', 0.45)}`,
                },
              }}
            >
              Raise Fabric PO
            </Button>
          </Box>
        }
      />

      <DataGridShell>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowHeight={(params) => estimatePoRowHeight(params.model.vendor_name)}
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
