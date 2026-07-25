import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import { Print, Visibility, Delete, Assignment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { ordersAPI } from '../services/api';
import { BuyerPoDetailDialog } from './BuyerPOs';

const STATUS_COLORS = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  IN_PRODUCTION: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const STATUS_LABELS = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  IN_PRODUCTION: 'In Production',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewPoId, setViewPoId] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await ordersAPI.getAll();
      const body = response.data;
      const rows = Array.isArray(body) ? body : body?.results;
      setOrders(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await ordersAPI.delete(id);
        fetchOrders();
      } catch (error) {
        console.error('Error deleting order:', error);
        alert('Error deleting order');
      }
    }
  };

  const cell = (align = 'left', children, verticalAlign = 'center') => (
    <Box
      sx={{
        display: 'flex',
        alignItems: verticalAlign,
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%',
        height: '100%',
        px: 0.5,
        overflow: 'visible',
      }}
    >
      {children}
    </Box>
  );

  const piGridSx = {
    ...dataGridSx,
    width: '100%',
    bgcolor: '#fff',
    '& .MuiDataGrid-columnHeaders': {
      ...(dataGridSx['& .MuiDataGrid-columnHeaders'] || {}),
      bgcolor: slate[50],
      borderBottom: `2px solid ${slate[200]}`,
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 800,
      fontSize: '0.72rem',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: slate[500],
    },
    '& .MuiDataGrid-cell': {
      ...(dataGridSx['& .MuiDataGrid-cell'] || {}),
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid ${slate[100]}`,
      overflow: 'visible',
      py: 0.75,
    },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: 'none' },
    '& .MuiDataGrid-row.pi-row--alt': {
      bgcolor: `${alpha('#0f766e', 0.07)} !important`,
    },
    '& .MuiDataGrid-row.pi-row--alt:hover': {
      bgcolor: `${alpha('#0f766e', 0.12)} !important`,
    },
    '& .MuiDataGrid-virtualScroller': {
      overflowX: 'hidden',
    },
  };

  const actionBtnSx = {
    p: 0.65,
    '& .MuiSvgIcon-root': { fontSize: 18 },
  };

  const columns = [
    {
      field: 'pi_number',
      headerName: 'PI #',
      minWidth: 92,
      flex: 0.85,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', fontFamily: 'monospace', color: 'primary.main' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'buyer_po_number',
      headerName: 'Buyer PO',
      minWidth: 82,
      flex: 0.75,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'customer_code',
      headerName: 'Code',
      minWidth: 48,
      flex: 0.45,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'text.secondary' }} noWrap>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'client_name',
      headerName: 'Bill To',
      minWidth: 88,
      flex: 1.15,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} noWrap>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'lines_count',
      headerName: 'Lines',
      minWidth: 48,
      flex: 0.38,
      type: 'number',
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Chip label={p.value ?? 0} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.68rem', height: 24 }} />
      ),
    },
    {
      field: 'quantity',
      headerName: 'Pcs',
      minWidth: 60,
      flex: 0.45,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{p.value?.toLocaleString?.() ?? p.value ?? '—'}</Typography>
      ),
    },
    {
      field: 'order_date',
      headerName: 'PI Date',
      minWidth: 84,
      flex: 0.55,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }} noWrap>{formatDateDisplay(p.value)}</Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 128,
      flex: 0.65,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => cell('center',
        <Chip
          label={STATUS_LABELS[params.value] || params.value || '—'}
          color={STATUS_COLORS[params.value] ?? 'default'}
          size="small"
          sx={{
            fontWeight: 700,
            fontSize: '0.68rem',
            letterSpacing: '0.02em',
            height: 'auto',
            minHeight: 26,
            maxWidth: 'none',
            '& .MuiChip-label': {
              whiteSpace: 'normal',
              overflow: 'visible',
              textOverflow: 'clip',
              display: 'block',
              px: 1,
              py: 0.35,
              lineHeight: 1.25,
            },
          }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      minWidth: 120,
      flex: 0.45,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => {
        const actionButtons = [
          (
            <Tooltip key="view" title="View / Print PI">
              <IconButton size="small" color="primary" sx={actionBtnSx} onClick={() => navigate(`/orders/pi/${params.row.id}/view`)}>
                <Print />
              </IconButton>
            </Tooltip>
          ),
          (
            <Tooltip key="indent" title={params.row.indents_count > 0 ? 'View indents for this PI' : 'Create indent from this PI'}>
              <IconButton
                size="small"
                sx={{ ...actionBtnSx, color: '#7c3aed' }}
                onClick={() => navigate(
                  params.row.indents_count > 0
                    ? `/indents?piId=${params.row.id}`
                    : `/indents/new?piId=${params.row.id}`,
                )}
              >
                <Assignment />
              </IconButton>
            </Tooltip>
          ),
          params.row.linked_po_id ? (
            <Tooltip key="view-po" title="View linked Buyer PO">
              <IconButton size="small" color="secondary" sx={actionBtnSx} onClick={() => setViewPoId(params.row.linked_po_id)}>
                <Visibility />
              </IconButton>
            </Tooltip>
          ) : null,
          (
            <Tooltip key="delete" title="Delete">
              <IconButton size="small" color="error" sx={actionBtnSx} onClick={() => handleDelete(params.row.id)}>
                <Delete />
              </IconButton>
            </Tooltip>
          ),
        ].filter(Boolean);

        return cell('center',
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.35,
              justifyContent: 'center',
              width: '100%',
              py: 0.35,
            }}
          >
            {actionButtons.map((btn) => (
              <Box key={btn.key} sx={{ display: 'flex', justifyContent: 'center' }}>
                {btn}
              </Box>
            ))}
          </Box>,
          'center',
        );
      },
    },
  ];

  return (
    <Box>
      <PageHeader
        kicker="Commercial"
        title="Proforma Invoices"
        subtitle="PIs generated from Buyer POs. Use the Buyer POs module to create and generate a new PI."
      />

      <DataGridShell sx={{ width: '100%' }}>
        <DataGrid
          rows={orders}
          columns={columns}
          getRowId={(row) => row.id}
          getRowClassName={(p) => (orders.findIndex((r) => r.id === p.id) % 2 === 1 ? 'pi-row--alt' : '')}
          rowHeight={100}
          columnHeaderHeight={48}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          loading={loading}
          disableRowSelectionOnClick
          sx={{ ...piGridSx, width: '100%', border: 'none' }}
        />
      </DataGridShell>

      {/* Buyer PO detail modal (view-only) */}
      {viewPoId != null && (
        <BuyerPoDetailDialog
          poId={viewPoId}
          onClose={() => setViewPoId(null)}
          onEdit={() => { setViewPoId(null); navigate(`/buyer-pos/${viewPoId}`); }}
          onGeneratePI={() => { setViewPoId(null); navigate(`/buyer-pos/${viewPoId}/generate-pi`); }}
        />
      )}
    </Box>
  );
};

export default Orders;
