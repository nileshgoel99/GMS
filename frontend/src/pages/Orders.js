import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import { Edit, Delete, Description, ReceiptLong, Visibility, Assignment } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { ordersAPI } from '../services/api';
import { BuyerPoDetailDialog } from './BuyerPOs';

const STATUS_COLORS = {
  DRAFT: 'default',
  CONFIRMED: 'info',
  IN_PRODUCTION: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const EMPTY_PLANNING = {
  buttons_required: 0,
  buttons_type: '',
  buttons_color: '',
  thread_required: 0,
  thread_color: '',
  thread_type: '',
  zippers_required: 0,
  zippers_size: '',
  zippers_color: '',
  tapes_required: 0,
  tapes_type: '',
  tapes_color: '',
  polybags_required: 0,
  polybags_size: '',
  fabric_required: 0,
  fabric_type: '',
  fabric_color: '',
  labels_required: 0,
  labels_type: '',
  notes: '',
};

/** Map API planning sheet payload to dialog form state (API may include id, pi, decimals, nulls). */
const mapPlanningFromApi = (data) => {
  if (!data || typeof data !== 'object') {
    return { ...EMPTY_PLANNING };
  }
  const n = (v, fallback = 0) => (v == null || v === '' ? fallback : v);
  const s = (v) => (v == null ? '' : String(v));
  return {
    buttons_required: n(data.buttons_required, 0),
    buttons_type: s(data.buttons_type),
    buttons_color: s(data.buttons_color),
    thread_required: n(data.thread_required, 0),
    thread_color: s(data.thread_color),
    thread_type: s(data.thread_type),
    zippers_required: n(data.zippers_required, 0),
    zippers_size: s(data.zippers_size),
    zippers_color: s(data.zippers_color),
    tapes_required: n(data.tapes_required, 0),
    tapes_type: s(data.tapes_type),
    tapes_color: s(data.tapes_color),
    polybags_required: n(data.polybags_required, 0),
    polybags_size: s(data.polybags_size),
    fabric_required: n(data.fabric_required, 0),
    fabric_type: s(data.fabric_type),
    fabric_color: s(data.fabric_color),
    labels_required: n(data.labels_required, 0),
    labels_type: s(data.labels_type),
    notes: s(data.notes),
  };
};

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openPlanningDialog, setOpenPlanningDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [planningData, setPlanningData] = useState(() => ({ ...EMPTY_PLANNING }));
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

  const handleOpenPlanning = async (order) => {
    setSelectedOrder(order);
    try {
      const response = await ordersAPI.getPlanningSheet(order.id);
      setPlanningData(mapPlanningFromApi(response.data));
    } catch (e) {
      if (e?.response?.status && e.response.status !== 404) {
        console.error('Planning sheet load error:', e);
      }
      setPlanningData({ ...EMPTY_PLANNING });
    }
    setOpenPlanningDialog(true);
  };

  const handleSavePlanning = async () => {
    try {
      await ordersAPI.updatePlanningSheet(selectedOrder.id, planningData);
      alert('Planning sheet saved successfully');
      setOpenPlanningDialog(false);
    } catch (error) {
      console.error('Error saving planning sheet:', error);
      alert('Error saving planning sheet');
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
    },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: 'none' },
    '& .MuiDataGrid-row.pi-row--alt': {
      bgcolor: `${alpha('#0f766e', 0.07)} !important`,
    },
    '& .MuiDataGrid-row.pi-row--alt:hover': {
      bgcolor: `${alpha('#0f766e', 0.12)} !important`,
    },
  };

  const columns = [
    {
      field: 'pi_number', headerName: 'PI Number', width: 140,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'primary.main' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'buyer_po_number', headerName: 'Buyer PO', width: 130,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'customer_code', headerName: 'Cust. Code', width: 100,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'text.secondary' }}>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'client_name', headerName: 'Bill To', flex: 1, minWidth: 160,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'lines_count', headerName: 'Lines', width: 72, type: 'number', align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Chip label={p.value ?? 0} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem' }} />
      ),
    },
    {
      field: 'garment_type',
      headerName: 'Items Summary',
      flex: 1.2,
      minWidth: 200,
      sortable: false,
      renderCell: (params) => {
        const raw = params.value;
        const text = raw == null || String(raw).trim() === '' ? '—' : String(raw);
        const content = (
          <Typography
            sx={{
              fontSize: '0.82rem',
              lineHeight: 1.35,
              color: text === '—' ? 'text.disabled' : 'text.primary',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}
          >
            {text}
          </Typography>
        );
        return cell('left', text === '—' ? content : (
          <Tooltip title={text} placement="top-start" enterDelay={400}>
            {content}
          </Tooltip>
        ));
      },
    },
    {
      field: 'quantity', headerName: 'Total Pcs', width: 100, type: 'number', align: 'right', headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{p.value?.toLocaleString?.() ?? p.value ?? '—'}</Typography>
      ),
    },
    {
      field: 'order_date', headerName: 'PI Date', width: 110,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => cell('center',
        <Chip
          label={params.value ?? '—'}
          color={STATUS_COLORS[params.value] ?? 'default'}
          size="small"
          sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 220,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => cell('center',
        <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
          <Tooltip title="View / Print PI">
            <IconButton size="small" color="primary" onClick={() => navigate(`/orders/pi/${params.row.id}/view`)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={params.row.indents_count > 0 ? 'View indents for this PI' : 'Create indent from this PI'}>
            <IconButton
              size="small"
              sx={{ color: '#7c3aed' }}
              onClick={() => navigate(
                params.row.indents_count > 0
                  ? `/indents?piId=${params.row.id}`
                  : `/indents/new?piId=${params.row.id}`,
              )}
            >
              <Assignment fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.linked_po_id && (
            <>
              <Tooltip title="View linked Buyer PO">
                <IconButton size="small" color="secondary" onClick={() => setViewPoId(params.row.linked_po_id)}>
                  <Visibility fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit / Re-generate PI">
                <IconButton size="small" sx={{ color: '#0f766e' }} onClick={() => navigate(`/buyer-pos/${params.row.linked_po_id}/generate-pi`)}>
                  <ReceiptLong fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Planning sheet">
            <IconButton size="small" color="primary" onClick={() => handleOpenPlanning(params.row)}>
              <Description fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
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
        kicker="Commercial"
        title="Proforma Invoices"
        subtitle="PIs generated from Buyer POs. Use the Buyer POs module to create and generate a new PI."
      />

      <DataGridShell>
        <DataGrid
          rows={orders}
          columns={columns}
          getRowId={(row) => row.id}
          getRowClassName={(p) => (orders.findIndex((r) => r.id === p.id) % 2 === 1 ? 'pi-row--alt' : '')}
          rowHeight={64}
          columnHeaderHeight={48}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          loading={loading}
          disableRowSelectionOnClick
          sx={piGridSx}
        />
      </DataGridShell>

      <Dialog open={openPlanningDialog} onClose={() => setOpenPlanningDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Planning sheet — {selectedOrder?.pi_number}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Buttons
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Quantity required"
                type="number"
                value={planningData.buttons_required}
                onChange={(e) => setPlanningData({ ...planningData, buttons_required: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Type"
                value={planningData.buttons_type}
                onChange={(e) => setPlanningData({ ...planningData, buttons_type: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Color"
                value={planningData.buttons_color}
                onChange={(e) => setPlanningData({ ...planningData, buttons_color: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Thread
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Quantity required"
                type="number"
                value={planningData.thread_required}
                onChange={(e) => setPlanningData({ ...planningData, thread_required: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Type"
                value={planningData.thread_type}
                onChange={(e) => setPlanningData({ ...planningData, thread_type: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Color"
                value={planningData.thread_color}
                onChange={(e) => setPlanningData({ ...planningData, thread_color: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Zippers
              </Typography>
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Quantity required"
                type="number"
                value={planningData.zippers_required}
                onChange={(e) => setPlanningData({ ...planningData, zippers_required: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Size"
                value={planningData.zippers_size}
                onChange={(e) => setPlanningData({ ...planningData, zippers_size: e.target.value })}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Color"
                value={planningData.zippers_color}
                onChange={(e) => setPlanningData({ ...planningData, zippers_color: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Polybags
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Quantity required"
                type="number"
                value={planningData.polybags_required}
                onChange={(e) => setPlanningData({ ...planningData, polybags_required: e.target.value })}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Size"
                value={planningData.polybags_size}
                onChange={(e) => setPlanningData({ ...planningData, polybags_size: e.target.value })}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={planningData.notes}
                onChange={(e) => setPlanningData({ ...planningData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenPlanningDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSavePlanning} variant="contained">
            Save planning sheet
          </Button>
        </DialogActions>
      </Dialog>

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
