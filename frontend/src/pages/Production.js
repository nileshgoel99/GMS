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
  MenuItem,
  Grid,
  IconButton,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Send } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx } from '../theme/appTheme';
import { productionAPI, ordersAPI, inventoryAPI } from '../services/api';
import { format } from 'date-fns';

const STATUS_COLORS = {
  DRAFT: 'default',
  ISSUED: 'info',
  IN_PRODUCTION: 'warning',
  COMPLETED: 'success',
  RETURNED: 'secondary',
};

const Production = () => {
  const [issues, setIssues] = useState([]);
  const [piList, setPiList] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [formData, setFormData] = useState({
    issue_number: '',
    pi: '',
    issue_date: format(new Date(), 'yyyy-MM-dd'),
    production_team: '',
    production_manager: '',
    status: 'DRAFT',
    notes: '',
    items: [],
  });

  useEffect(() => {
    fetchIssues();
    fetchPiList();
    fetchInventoryItems();
  }, []);

  const fetchIssues = async () => {
    try {
      const response = await productionAPI.getAll();
      setIssues(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching production issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPiList = async () => {
    try {
      const response = await ordersAPI.getAll();
      setPiList(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching PI list:', error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await inventoryAPI.getAll();
      setInventoryItems(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    }
  };

  const handleOpenDialog = (issue = null) => {
    if (issue) {
      setSelectedIssue(issue);
      setFormData({
        issue_number: issue.issue_number,
        pi: issue.pi,
        issue_date: issue.issue_date,
        production_team: issue.production_team || '',
        production_manager: issue.production_manager || '',
        status: issue.status,
        notes: issue.notes || '',
        items: issue.items || [],
      });
    } else {
      setSelectedIssue(null);
      setFormData({
        issue_number: '',
        pi: '',
        issue_date: format(new Date(), 'yyyy-MM-dd'),
        production_team: '',
        production_manager: '',
        status: 'DRAFT',
        notes: '',
        items: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedIssue(null);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item: '', quantity_issued: 0, remarks: '' }],
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async () => {
    try {
      if (selectedIssue) {
        await productionAPI.update(selectedIssue.id, formData);
      } else {
        await productionAPI.create(formData);
      }
      fetchIssues();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving production issue:', error);
      alert('Error saving production issue');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this production issue?')) {
      try {
        await productionAPI.delete(id);
        fetchIssues();
      } catch (error) {
        console.error('Error deleting production issue:', error);
        alert('Error deleting production issue');
      }
    }
  };

  const handleIssueMaterials = async (issue) => {
    if (window.confirm('Issue materials to production? This will deduct stock from inventory.')) {
      try {
        await productionAPI.issueMaterials(issue.id);
        fetchIssues();
        alert('Materials issued successfully');
      } catch (error) {
        console.error('Error issuing materials:', error);
        alert(error.response?.data?.detail || 'Error issuing materials');
      }
    }
  };

  const columns = [
    { field: 'issue_number', headerName: 'Issue Number', width: 130 },
    { field: 'pi_number', headerName: 'PI Number', width: 120 },
    { field: 'client_name', headerName: 'Client', width: 150 },
    { field: 'issue_date', headerName: 'Issue Date', width: 120 },
    { field: 'production_team', headerName: 'Team', width: 150 },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} color={STATUS_COLORS[params.value]} size="small" />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Edit issue">
            <IconButton size="small" color="primary" onClick={() => handleOpenDialog(params.row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Issue materials">
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleIssueMaterials(params.row)}
                disabled={params.row.status !== 'DRAFT'}
              >
                <Send fontSize="small" />
              </IconButton>
            </span>
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
        kicker="Shop floor"
        title="Production issues"
        subtitle="Issue materials from store stock only (recorded against PIs). Inventory is updated on issue so store balance always reflects what is physically available to release."
        actions={
          <Button variant="contained" size="large" startIcon={<Add />} onClick={() => handleOpenDialog()}>
            New production issue
          </Button>
        }
      />

      <DataGridShell sx={{ height: { xs: 560, md: 620 }, width: '100%' }}>
        <DataGrid
          rows={issues}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25, 50]}
          loading={loading}
          disableSelectionOnClick
          sx={{ ...dataGridSx, height: '100%' }}
        />
      </DataGridShell>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedIssue ? 'Edit Production Issue' : 'New Production Issue'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Issue Number"
                value={formData.issue_number}
                onChange={(e) => setFormData({ ...formData, issue_number: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Linked PI"
                value={formData.pi}
                onChange={(e) => setFormData({ ...formData, pi: e.target.value })}
                required
              >
                {piList.map((pi) => (
                  <MenuItem key={pi.id} value={pi.id}>
                    {pi.pi_number} - {pi.client_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Issue Date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Production Team"
                value={formData.production_team}
                onChange={(e) => setFormData({ ...formData, production_team: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Production Manager"
                value={formData.production_manager}
                onChange={(e) => setFormData({ ...formData, production_manager: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="ISSUED">Issued</MenuItem>
                <MenuItem value="IN_PRODUCTION">In Production</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="RETURNED">Returned</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Materials to Issue</Typography>
                <Button variant="outlined" size="small" onClick={handleAddItem}>
                  Add Item
                </Button>
              </Box>
              {formData.status === 'DRAFT' && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Materials will be deducted from inventory when you click "Issue Materials"
                </Alert>
              )}
              {formData.items.map((item, index) => (
                <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      select
                      label="Item"
                      value={item.item}
                      onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                    >
                      {inventoryItems.map((invItem) => (
                        <MenuItem key={invItem.id} value={invItem.id}>
                          {invItem.item_code} - {invItem.name} (Stock: {invItem.current_stock})
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={3}>
                    <TextField
                      fullWidth
                      label="Quantity to Issue"
                      type="number"
                      value={item.quantity_issued}
                      onChange={(e) => handleItemChange(index, 'quantity_issued', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={2}>
                    <TextField
                      fullWidth
                      label="Remarks"
                      value={item.remarks}
                      onChange={(e) => handleItemChange(index, 'remarks', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton onClick={() => handleRemoveItem(index)}>
                      <Delete />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedIssue ? 'Save changes' : 'Create issue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Production;
