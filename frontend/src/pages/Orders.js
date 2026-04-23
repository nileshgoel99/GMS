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
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Description } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx } from '../theme/appTheme';
import { ordersAPI } from '../services/api';

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

  const columns = [
    { field: 'pi_number', headerName: 'PI number', width: 130 },
    { field: 'buyer_po_number', headerName: 'Buyer PO', width: 120 },
    { field: 'customer_code', headerName: 'Cust. code', width: 100 },
    { field: 'client_name', headerName: 'Bill to', width: 160 },
    { field: 'lines_count', headerName: 'Lines', width: 70, type: 'number' },
    {
      field: 'garment_type',
      headerName: 'Items summary',
      flex: 1.2,
      minWidth: 220,
      sortable: false,
      renderCell: (params) => {
        const raw = params.value;
        const text = raw == null || String(raw).trim() === '' ? '—' : String(raw);
        const cell = (
          <Box
            component="span"
            sx={{
              display: 'block',
              width: '100%',
              whiteSpace: 'normal',
              lineHeight: 1.45,
              wordBreak: 'break-word',
              py: 0.5,
              pr: 0.5,
              color: text === '—' ? 'text.disabled' : 'text.primary',
              fontSize: '0.8125rem',
            }}
          >
            {text}
          </Box>
        );
        if (text === '—') {
          return cell;
        }
        return (
          <Tooltip title={text} placement="top-start" enterDelay={500} enterNextDelay={300}>
            {cell}
          </Tooltip>
        );
      },
    },
    { field: 'quantity', headerName: 'Total pcs', width: 90, type: 'number' },
    { field: 'order_date', headerName: 'PI date', width: 110 },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value ?? '—'}
          color={STATUS_COLORS[params.value] ?? 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Edit PI (full page)">
            <IconButton size="small" color="primary" onClick={() => navigate(`/orders/pi/${params.row.id}`)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
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
    <Box>
      <PageHeader
        kicker="Commercial"
        title="Customer PI"
        subtitle="Proforma invoices with line items, commercial terms, and PDF export. Open a PI in the full-page editor — planning sheet stays here."
        actions={
          <Button variant="contained" size="large" startIcon={<Add />} onClick={() => navigate('/orders/pi/new')}>
            New PI
          </Button>
        }
      />

      <DataGridShell sx={{ height: { xs: 560, md: 620 }, width: '100%' }}>
        <DataGrid
          rows={orders}
          columns={columns}
          getRowId={(row) => row.id}
          getRowHeight={() => 'auto'}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          loading={loading}
          disableRowSelectionOnClick
          sx={{
            ...dataGridSx,
            height: '100%',
            '& .MuiDataGrid-cell': { alignItems: 'flex-start', py: 0.75 },
            '& .MuiDataGrid-cell:focus': { outline: 'none' },
          }}
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
    </Box>
  );
};

export default Orders;
