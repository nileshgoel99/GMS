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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, LocalShipping } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx } from '../theme/appTheme';
import { procurementAPI, ordersAPI, inventoryAPI } from '../services/api';
import { format } from 'date-fns';

const STATUS_COLORS = {
  DRAFT: 'default',
  ORDERED: 'info',
  PARTIAL: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const Procurement = () => {
  const [pos, setPos] = useState([]);
  const [piList, setPiList] = useState([]);
  const [intentsList, setIntentsList] = useState([]);
  const [intentDetail, setIntentDetail] = useState(null);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [openReceiptDialog, setOpenReceiptDialog] = useState(false);
  const [selectedPo, setSelectedPo] = useState(null);
  const [formData, setFormData] = useState({
    po_number: '',
    pi: '',
    intent: '',
    vendor_name: '',
    vendor_email: '',
    vendor_phone: '',
    vendor_address: '',
    order_date: format(new Date(), 'yyyy-MM-dd'),
    expected_delivery_date: '',
    status: 'DRAFT',
    total_amount: '',
    payment_terms: '',
    delivery_terms: '',
    notes: '',
    items: [],
  });
  const [receiptData, setReceiptData] = useState({
    receipt_number: '',
    receipt_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    items: [],
  });

  useEffect(() => {
    fetchPos();
    fetchPiList();
    fetchInventoryItems();
    fetchIntents();
  }, []);

  const fetchIntents = async () => {
    try {
      const response = await ordersAPI.getIntents();
      setIntentsList(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching intents:', error);
    }
  };

  const loadIntentDetail = async (intentId) => {
    if (!intentId) {
      setIntentDetail(null);
      setFormData((f) => ({ ...f, intent: '' }));
      return;
    }
    try {
      const res = await ordersAPI.getIntent(intentId);
      setIntentDetail(res.data);
      setFormData((f) => ({
        ...f,
        intent: intentId,
        pi: f.pi || res.data.pi,
      }));
    } catch (error) {
      console.error(error);
      setIntentDetail(null);
    }
  };

  const fetchPos = async () => {
    try {
      const response = await procurementAPI.getAll();
      setPos(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching POs:', error);
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

  const handleOpenDialog = async (po = null) => {
    setIntentDetail(null);
    if (po) {
      try {
        const { data } = await procurementAPI.getById(po.id);
        setSelectedPo(data);
        setFormData({
          po_number: data.po_number,
          pi: data.pi || '',
          intent: data.intent || '',
          vendor_name: data.vendor_name,
          vendor_email: data.vendor_email || '',
          vendor_phone: data.vendor_phone || '',
          vendor_address: data.vendor_address || '',
          order_date: data.order_date,
          expected_delivery_date: data.expected_delivery_date || '',
          status: data.status,
          total_amount: data.total_amount || '',
          payment_terms: data.payment_terms || '',
          delivery_terms: data.delivery_terms || '',
          notes: data.notes || '',
          items: data.items || [],
        });
        if (data.intent) {
          await loadIntentDetail(data.intent);
        }
      } catch (error) {
        console.error(error);
        alert('Could not load purchase order');
        return;
      }
    } else {
      setSelectedPo(null);
      setFormData({
        po_number: '',
        pi: '',
        intent: '',
        vendor_name: '',
        vendor_email: '',
        vendor_phone: '',
        vendor_address: '',
        order_date: format(new Date(), 'yyyy-MM-dd'),
        expected_delivery_date: '',
        status: 'DRAFT',
        total_amount: '',
        payment_terms: '',
        delivery_terms: '',
        notes: '',
        items: [],
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPo(null);
    setIntentDetail(null);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { item: '', quantity_ordered: 0, unit_price: 0, intent_line: '' }],
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
      const payload = {
        ...formData,
        intent: formData.intent || null,
        pi: formData.pi || null,
        items: formData.items.map((row) => ({
          ...row,
          intent_line: row.intent_line || null,
        })),
      };
      if (selectedPo) {
        await procurementAPI.update(selectedPo.id, payload);
      } else {
        await procurementAPI.create(payload);
      }
      fetchPos();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving PO:', error);
      const msg = error.response?.data
        ? JSON.stringify(error.response.data)
        : 'Error saving PO';
      alert(msg);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this PO?')) {
      try {
        await procurementAPI.delete(id);
        fetchPos();
      } catch (error) {
        console.error('Error deleting PO:', error);
        alert('Error deleting PO');
      }
    }
  };

  const handleOpenReceipt = async (po) => {
    setSelectedPo(po);
    const poDetails = await procurementAPI.getById(po.id);
    setReceiptData({
      receipt_number: '',
      receipt_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      items: poDetails.data.items.map((item) => ({
        po_item: item.id,
        quantity_received: 0,
        item_name: item.item_details?.name || '',
        quantity_ordered: item.quantity_ordered,
        quantity_pending: item.quantity_pending,
      })),
    });
    setOpenReceiptDialog(true);
  };

  const handleReceiptItemChange = (index, value) => {
    const newItems = [...receiptData.items];
    newItems[index].quantity_received = value;
    setReceiptData({ ...receiptData, items: newItems });
  };

  const handleSubmitReceipt = async () => {
    try {
      const payload = {
        po: selectedPo.id,
        receipt_number: receiptData.receipt_number,
        receipt_date: receiptData.receipt_date,
        notes: receiptData.notes,
        items: receiptData.items
          .filter((item) => item.quantity_received > 0)
          .map((item) => ({
            po_item: item.po_item,
            quantity_received: item.quantity_received,
          })),
      };
      await procurementAPI.createReceipt(payload);
      fetchPos();
      setOpenReceiptDialog(false);
      alert('Receipt recorded successfully');
    } catch (error) {
      console.error('Error recording receipt:', error);
      alert('Error recording receipt');
    }
  };

  const columns = [
    { field: 'po_number', headerName: 'PO Number', width: 130 },
    { field: 'vendor_name', headerName: 'Vendor', width: 150 },
    { field: 'pi_number', headerName: 'PI Number', width: 120 },
    { field: 'indent_number', headerName: 'Indent', width: 130 },
    { field: 'order_date', headerName: 'Order Date', width: 120 },
    { field: 'expected_delivery_date', headerName: 'Expected Date', width: 130 },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} color={STATUS_COLORS[params.value]} size="small" />
      ),
    },
    {
      field: 'total_amount',
      headerName: 'Total Amount',
      width: 130,
      renderCell: (params) => params.value ? `$${params.value}` : 'N/A',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Edit PO">
            <IconButton size="small" color="primary" onClick={() => handleOpenDialog(params.row)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Record receipt">
            <span>
              <IconButton
                size="small"
                color="primary"
                onClick={() => handleOpenReceipt(params.row)}
                disabled={params.row.status === 'COMPLETED' || params.row.status === 'DRAFT'}
              >
                <LocalShipping fontSize="small" />
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
        kicker="Supply chain"
        title="Purchase orders"
        subtitle="Raise POs against indents (split quantities across suppliers), link to internal PIs, receive into store stock, and keep full traceability from intent line to receipt."
        actions={
          <Button variant="contained" size="large" startIcon={<Add />} onClick={() => handleOpenDialog()}>
            New purchase order
          </Button>
        }
      />

      <DataGridShell sx={{ height: { xs: 560, md: 620 }, width: '100%' }}>
        <DataGrid
          rows={pos}
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
          {selectedPo ? 'Edit Purchase Order' : 'New Purchase Order'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="PO Number"
                value={formData.po_number}
                onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
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
              >
                <MenuItem value="">None</MenuItem>
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
                select
                label="Intent (indent)"
                value={formData.intent}
                onChange={(e) => loadIntentDetail(e.target.value)}
                helperText="Optional. Loads BOM lines so you can tie each PO line to an intent line."
              >
                <MenuItem value="">None</MenuItem>
                {intentsList.map((it) => (
                  <MenuItem key={it.id} value={it.id}>
                    {it.indent_number} — {it.pi_number}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            {intentDetail ? (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 1 }}>
                  Indent <strong>{intentDetail.indent_number}</strong> — allocate PO quantities per line; remaining
                  updates after other POs are saved.
                </Alert>
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>Material</TableCell>
                        <TableCell>Required</TableCell>
                        <TableCell>On POs</TableCell>
                        <TableCell>Remaining</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(intentDetail.lines || []).map((ln) => (
                        <TableRow key={ln.id}>
                          <TableCell>{ln.line_number}</TableCell>
                          <TableCell>{ln.material_description}</TableCell>
                          <TableCell>{ln.total_required}</TableCell>
                          <TableCell>{ln.qty_ordered_on_pos}</TableCell>
                          <TableCell>{ln.qty_remaining_to_order}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            ) : null}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vendor Name"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vendor Email"
                type="email"
                value={formData.vendor_email}
                onChange={(e) => setFormData({ ...formData, vendor_email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Vendor Phone"
                value={formData.vendor_phone}
                onChange={(e) => setFormData({ ...formData, vendor_phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Order Date"
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Expected Delivery Date"
                type="date"
                value={formData.expected_delivery_date}
                onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
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
                <MenuItem value="ORDERED">Ordered</MenuItem>
                <MenuItem value="PARTIAL">Partially Received</MenuItem>
                <MenuItem value="COMPLETED">Completed</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Vendor Address"
                multiline
                rows={2}
                value={formData.vendor_address}
                onChange={(e) => setFormData({ ...formData, vendor_address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Items</Typography>
                <Button variant="outlined" size="small" onClick={handleAddItem}>
                  Add Item
                </Button>
              </Box>
              {formData.items.map((item, index) => (
                <Grid container spacing={2} key={index} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      select
                      label="Store SKU"
                      value={item.item}
                      onChange={(e) => handleItemChange(index, 'item', e.target.value)}
                    >
                      {inventoryItems.map((invItem) => (
                        <MenuItem key={invItem.id} value={invItem.id}>
                          {invItem.item_code} - {invItem.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  {intentDetail?.lines?.length ? (
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        select
                        label="Intent line"
                        value={item.intent_line || ''}
                        onChange={(e) => handleItemChange(index, 'intent_line', e.target.value)}
                      >
                        <MenuItem value="">—</MenuItem>
                        {intentDetail.lines.map((ln) => (
                          <MenuItem key={ln.id} value={ln.id}>
                            #{ln.line_number} {ln.material_description} (rem. {ln.qty_remaining_to_order})
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  ) : null}
                  <Grid item xs={6} md={2}>
                    <TextField
                      fullWidth
                      label="Quantity"
                      type="number"
                      value={item.quantity_ordered}
                      onChange={(e) => handleItemChange(index, 'quantity_ordered', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <TextField
                      fullWidth
                      label="Unit Price"
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
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
            {selectedPo ? 'Save changes' : 'Create PO'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openReceiptDialog} onClose={() => setOpenReceiptDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Record Receipt - {selectedPo?.po_number}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Receipt Number"
                value={receiptData.receipt_number}
                onChange={(e) => setReceiptData({ ...receiptData, receipt_number: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Receipt Date"
                type="date"
                value={receiptData.receipt_date}
                onChange={(e) => setReceiptData({ ...receiptData, receipt_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Items</Typography>
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{ borderRadius: 0, border: '1px solid', borderColor: 'divider' }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell>Ordered</TableCell>
                      <TableCell>Pending</TableCell>
                      <TableCell>Receiving Now</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {receiptData.items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell>{item.quantity_ordered}</TableCell>
                        <TableCell>{item.quantity_pending}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={item.quantity_received}
                            onChange={(e) => handleReceiptItemChange(index, e.target.value)}
                            inputProps={{ min: 0, max: item.quantity_pending }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={receiptData.notes}
                onChange={(e) => setReceiptData({ ...receiptData, notes: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReceiptDialog(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleSubmitReceipt} variant="contained">
            Record receipt
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Procurement;
