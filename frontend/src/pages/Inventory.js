import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  IconButton,
  Chip,
  Tabs,
  Tab,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, History, Warning } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx } from '../theme/appTheme';
import { inventoryAPI } from '../services/api';

const Inventory = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openSummaryDialog, setOpenSummaryDialog] = useState(false);
  const [summary, setSummary] = useState(null);
  const [formData, setFormData] = useState({
    item_code: '',
    name: '',
    category: 'BUTTON',
    color: '',
    size: '',
    finish: '',
    material: '',
    unit: 'PCS',
    current_stock: 0,
    reorder_level: 0,
    unit_cost: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    fetchItems();
    fetchLowStock();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await inventoryAPI.getAll();
      setItems(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLowStock = async () => {
    try {
      const response = await inventoryAPI.getLowStock();
      setLowStockItems(response.data);
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    }
  };

  const handleOpenDialog = (item = null) => {
    if (item) {
      setSelectedItem(item);
      setFormData({
        item_code: item.item_code,
        name: item.name,
        category: item.category,
        color: item.color || '',
        size: item.size || '',
        finish: item.finish || '',
        material: item.material || '',
        unit: item.unit,
        current_stock: item.current_stock,
        reorder_level: item.reorder_level,
        unit_cost: item.unit_cost || '',
        description: item.description || '',
        is_active: item.is_active,
      });
    } else {
      setSelectedItem(null);
      setFormData({
        item_code: '',
        name: '',
        category: 'BUTTON',
        color: '',
        size: '',
        finish: '',
        material: '',
        unit: 'PCS',
        current_stock: 0,
        reorder_level: 0,
        unit_cost: '',
        description: '',
        is_active: true,
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedItem(null);
  };

  const handleSubmit = async () => {
    try {
      if (selectedItem) {
        await inventoryAPI.update(selectedItem.id, formData);
      } else {
        await inventoryAPI.create(formData);
      }
      fetchItems();
      fetchLowStock();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Error saving item');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await inventoryAPI.delete(id);
        fetchItems();
        fetchLowStock();
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item');
      }
    }
  };

  const handleViewSummary = async (item) => {
    try {
      const response = await inventoryAPI.getSummary(item.id);
      setSummary(response.data);
      setOpenSummaryDialog(true);
    } catch (error) {
      console.error('Error fetching summary:', error);
      alert('Error fetching summary');
    }
  };

  const columns = [
    { field: 'item_code', headerName: 'Item Code', width: 130 },
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'category', headerName: 'Category', width: 120 },
    { field: 'color', headerName: 'Color', width: 100 },
    { field: 'size', headerName: 'Size', width: 100 },
    { field: 'current_stock', headerName: 'Stock', width: 100 },
    { field: 'unit', headerName: 'Unit', width: 80 },
    {
      field: 'needs_reorder',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        params.value ? (
          <Chip label="Low Stock" color="error" size="small" icon={<Warning />} />
        ) : (
          <Chip label="OK" color="success" size="small" />
        )
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Edit item">
            <IconButton size="small" color="primary" onClick={() => handleOpenDialog(params.row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Summary & logs">
            <IconButton size="small" color="primary" onClick={() => handleViewSummary(params.row)}>
              <History fontSize="small" />
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

  const displayData = activeTab === 0 ? items : lowStockItems;

  return (
    <Box>
      <PageHeader
        kicker="Materials"
        title="Inventory"
        subtitle="Store-room stock for trims, fabrics, and packaging: attributes, balances, receipts from POs, and issues to production—all traceable for audit-ready operations."
        actions={
          <Button variant="contained" size="large" startIcon={<Add />} onClick={() => handleOpenDialog()}>
            Add item
          </Button>
        }
      />

      <Paper
        elevation={0}
        sx={{
          mb: 2,
          borderRadius: 0,
          border: '1px solid',
          borderColor: 'divider',
          px: 1,
          background: (theme) => theme.palette.background.paper,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab label="All items" />
          <Tab label="Low stock" />
        </Tabs>
      </Paper>

      <DataGridShell sx={{ height: { xs: 560, md: 620 }, width: '100%' }}>
        <DataGrid
          rows={displayData}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          loading={loading}
          disableSelectionOnClick
          sx={{ ...dataGridSx, height: '100%' }}
        />
      </DataGridShell>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedItem ? 'Edit Inventory Item' : 'New Inventory Item'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Item Code"
                value={formData.item_code}
                onChange={(e) => setFormData({ ...formData, item_code: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <MenuItem value="BUTTON">Button</MenuItem>
                <MenuItem value="THREAD">Thread</MenuItem>
                <MenuItem value="ZIPPER">Zipper</MenuItem>
                <MenuItem value="TAPE">Tape</MenuItem>
                <MenuItem value="POLYBAG">Polybag</MenuItem>
                <MenuItem value="FABRIC">Fabric</MenuItem>
                <MenuItem value="LABEL">Label</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Unit"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              >
                <MenuItem value="PCS">Pieces</MenuItem>
                <MenuItem value="MTR">Meters</MenuItem>
                <MenuItem value="KG">Kilograms</MenuItem>
                <MenuItem value="ROLL">Roll</MenuItem>
                <MenuItem value="BOX">Box</MenuItem>
                <MenuItem value="SET">Set</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Size"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Finish"
                value={formData.finish}
                onChange={(e) => setFormData({ ...formData, finish: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Material"
                value={formData.material}
                onChange={(e) => setFormData({ ...formData, material: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Current Stock"
                type="number"
                value={formData.current_stock}
                onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Reorder Level"
                type="number"
                value={formData.reorder_level}
                onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Unit Cost"
                type="number"
                value={formData.unit_cost}
                onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedItem ? 'Save changes' : 'Create item'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openSummaryDialog} onClose={() => setOpenSummaryDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Inventory Summary - {summary?.name}</DialogTitle>
        <DialogContent>
          {summary && (
            <Box>
              <Grid container spacing={3} sx={{ mt: 1, mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2 }}>
                    <Typography color="textSecondary" variant="body2">Total Ordered</Typography>
                    <Typography variant="h5">{summary.total_ordered} {summary.unit}</Typography>
                    <Typography variant="caption">
                      Last: {summary.last_order_date ? new Date(summary.last_order_date).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2 }}>
                    <Typography color="textSecondary" variant="body2">Total Received</Typography>
                    <Typography variant="h5">{summary.total_received} {summary.unit}</Typography>
                    <Typography variant="caption">
                      Last: {summary.last_receipt_date ? new Date(summary.last_receipt_date).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2 }}>
                    <Typography color="textSecondary" variant="body2">Total Released</Typography>
                    <Typography variant="h5">{summary.total_released} {summary.unit}</Typography>
                    <Typography variant="caption">
                      Last: {summary.last_release_date ? new Date(summary.last_release_date).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom>Transaction History</Typography>
              <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
                {summary.all_logs && summary.all_logs.map((log) => (
                  <Box key={log.id} sx={{ p: 2, borderBottom: '1px solid #eee' }}>
                    <Grid container spacing={2}>
                      <Grid item xs={3}>
                        <Typography variant="body2" color="textSecondary">Type</Typography>
                        <Typography variant="body1">{log.transaction_type}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="body2" color="textSecondary">Quantity</Typography>
                        <Typography variant="body1">{log.quantity}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="body2" color="textSecondary">Reference</Typography>
                        <Typography variant="body1">{log.reference_number || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={3}>
                        <Typography variant="body2" color="textSecondary">Vendor/Supplier</Typography>
                        <Typography variant="body1">{log.vendor_supplier || 'N/A'}</Typography>
                      </Grid>
                      <Grid item xs={2}>
                        <Typography variant="body2" color="textSecondary">Date</Typography>
                        <Typography variant="body1">
                          {new Date(log.created_at).toLocaleDateString()}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSummaryDialog(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Inventory;
