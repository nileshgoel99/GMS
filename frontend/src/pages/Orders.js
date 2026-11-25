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

const fmtMoney = (n, ccy = 'USD') =>
  n == null || n === ''
    ? '—'
    : `${ccy} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
        minWidth: 0,
        height: '100%',
        px: 0.25,
        overflow: 'visible',
        '& .MuiTypography-root': {
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          lineHeight: 1.35,
        },
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
    '& .MuiDataGrid-columnHeader': {
      height: 'auto',
      minHeight: 48,
    },
    '& .MuiDataGrid-columnHeaderTitleContainer, & .MuiDataGrid-columnHeaderTitleContainerContent': {
      whiteSpace: 'normal',
      overflow: 'visible',
      lineHeight: 1.25,
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 800,
      fontSize: '0.68rem',
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      color: slate[500],
      whiteSpace: 'normal',
      lineHeight: 1.25,
      overflow: 'visible',
      textOverflow: 'clip',
    },
    '& .MuiDataGrid-cell': {
      ...(dataGridSx['& .MuiDataGrid-cell'] || {}),
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid ${slate[100]}`,
      overflow: 'visible',
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      lineHeight: 1.35,
      py: 1,
      minWidth: '0 !important',
    },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: 'none' },
    '& .MuiDataGrid-row.pi-row--alt': {
      bgcolor: `${alpha('#0f766e', 0.07)} !important`,
    },
    '& .MuiDataGrid-row.pi-row--alt:hover': {
      bgcolor: `${alpha('#0f766e', 0.12)} !important`,
    },
    '& .MuiDataGrid-main, & .MuiDataGrid-virtualScroller, & .MuiDataGrid-virtualScrollerContent': {
      overflowX: 'hidden',
    },
    '& .MuiDataGrid-scrollbar--horizontal': {
      display: 'none',
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
      minWidth: 56,
      flex: 0.9,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', fontFamily: 'monospace', color: 'primary.main' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'buyer_po_number',
      headerName: 'Buyer PO',
      minWidth: 56,
      flex: 0.8,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'customer_code',
      headerName: 'Code',
      minWidth: 40,
      flex: 0.4,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'text.secondary' }}>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'client_name',
      headerName: 'Bill To',
      minWidth: 72,
      flex: 1.2,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'lines_count',
      headerName: 'Lines',
      minWidth: 40,
      flex: 0.35,
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
      minWidth: 44,
      flex: 0.4,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem' }}>{p.value?.toLocaleString?.() ?? p.value ?? '—'}</Typography>
      ),
    },
    {
      field: 'total_amount',
      headerName: 'Order Value',
      minWidth: 64,
      flex: 0.7,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'primary.dark' }}>
          {fmtMoney(p.value, p.row.currency || 'USD')}
        </Typography>
      ),
    },
    {
      field: 'advance_received',
      headerName: 'Advance',
      minWidth: 56,
      flex: 0.6,
      type: 'number',
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
          {fmtMoney(p.value, p.row.currency || 'USD')}
        </Typography>
      ),
    },
    {
      field: 'ex_factory_date',
      headerName: 'Ex Factory Date',
      minWidth: 64,
      flex: 0.65,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: p.value ? 'text.secondary' : slate[300] }}>
          {formatDateDisplay(p.value)}
        </Typography>
      ),
    },
    {
      field: 'order_date',
      headerName: 'PI Date',
      minWidth: 52,
      flex: 0.5,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{formatDateDisplay(p.value)}</Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 64,
      flex: 0.6,
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
      minWidth: 88,
      flex: 0.5,
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
          getRowHeight={() => 'auto'}
          columnHeaderHeight={56}
          scrollbarSize={0}
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
