import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Grid,
  Chip,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  InputAdornment,
  Alert,
  Snackbar,
  Divider,
  Stack,
} from '@mui/material';
import {
  Search,
  Warning,
  Inventory2,
  LocalShipping,
  Assignment,
  Outbound,
  History,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import PageHeader from '../components/PageHeader';
import InventoryItemParticulars, {
  PropertyCards,
  InventoryItemFull,
} from '../components/inventory/InventoryItemParticulars';
import { extractTrimProperties } from '../utils/extractTrimProperties';
import { slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { inventoryAPI } from '../services/api';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const fmtQty = (v) => {
  const n = parseFloat(v);
  if (Number.isNaN(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const headCellSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: slate[700],
  py: 1.1,
  bgcolor: alpha('#2563eb', 0.07),
  borderBottom: `2px solid ${alpha('#2563eb', 0.2)}`,
  whiteSpace: 'nowrap',
};

const rowSx = (index) => ({
  bgcolor: index % 2 === 0 ? '#ffffff' : alpha(slate[100], 0.55),
  transition: 'background-color 0.15s ease',
  '&:hover': { bgcolor: alpha('#2563eb', 0.07) },
  '&:last-child td': { borderBottom: 0 },
});

const bodyCellSx = {
  py: 1.25,
  verticalAlign: 'top',
  borderBottom: `1px solid ${slate[100]}`,
};

const StatMiniCard = ({ label, value, icon, accent }) => (
  <Paper
    elevation={0}
    sx={{
      px: 1.25,
      py: 0.85,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
      border: `1px solid ${slate[200]}`,
      borderRadius: 1,
      minWidth: { xs: '30%', sm: 110 },
      flex: { xs: '1 1 30%', sm: '0 0 auto' },
    }}
  >
    {icon}
    <Box>
      <Typography
        sx={{ fontSize: '0.62rem', fontWeight: 600, color: slate[500], lineHeight: 1.1, textTransform: 'uppercase', letterSpacing: '0.03em' }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.2, color: accent || slate[900] }}>
        {value}
      </Typography>
    </Box>
  </Paper>
);

const Inventory = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const [summary, setSummary] = useState(null);
  const [releaseItem, setReleaseItem] = useState(null);
  const [releaseQty, setReleaseQty] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, lowRes, statsRes] = await Promise.all([
        inventoryAPI.getAll({ is_active: true }),
        inventoryAPI.getLowStock(),
        inventoryAPI.getStatistics(),
      ]);
      setItems(asList(itemsRes.data));
      setLowStockItems(asList(lowRes.data));
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setSnack({ open: true, message: 'Failed to load inventory', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const displayData = useMemo(() => {
    const base = activeTab === 0 ? items : lowStockItems;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((row) => {
      const hay = [
        row.item_code,
        row.item_name,
        row.trim_name,
        row.name,
        row.category,
        ...(row.property_lines || []).flatMap((l) => l.split(/\s·\s/)),
        ...extractTrimProperties(row).flatMap((p) => [p.label, p.value]),
        ...(row.pi_refs || []).flatMap((p) => [p.pi_number, p.customer]),
        ...(row.suppliers || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeTab, items, lowStockItems, search]);

  const openDetail = async (item) => {
    setDetailItem(item);
    try {
      const res = await inventoryAPI.getSummary(item.id);
      setSummary(res.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSnack({ open: true, message: 'Failed to load item details', severity: 'error' });
    }
  };

  const closeDetail = () => {
    setDetailItem(null);
    setSummary(null);
  };

  const openRelease = (item) => {
    setReleaseItem(item);
    setReleaseQty('');
    setReleaseRemarks('');
  };

  const closeRelease = () => {
    setReleaseItem(null);
    setReleaseQty('');
    setReleaseRemarks('');
  };

  const handleRelease = async () => {
    if (!releaseItem) return;
    const qty = parseFloat(releaseQty);
    if (!qty || qty <= 0) {
      setSnack({ open: true, message: 'Enter a valid release quantity', severity: 'warning' });
      return;
    }
    if (qty > parseFloat(releaseItem.current_stock)) {
      setSnack({
        open: true,
        message: `Cannot release more than ${fmtQty(releaseItem.current_stock)} ${releaseItem.unit}`,
        severity: 'warning',
      });
      return;
    }

    setReleaseLoading(true);
    try {
      await inventoryAPI.release(releaseItem.id, {
        quantity: qty,
        remarks: releaseRemarks,
      });
      setSnack({
        open: true,
        message: `Released ${fmtQty(qty)} ${releaseItem.unit} to production`,
        severity: 'success',
      });
      closeRelease();
      if (detailItem?.id === releaseItem.id) closeDetail();
      fetchAll();
    } catch (error) {
      const msg = error.response?.data?.quantity || error.response?.data?.detail || 'Release failed';
      setSnack({ open: true, message: String(msg), severity: 'error' });
    } finally {
      setReleaseLoading(false);
    }
  };

  const logLabel = (type) => {
    const map = {
      RECEIVE: 'Received',
      ISSUE: 'Released',
      ORDER: 'Ordered',
      RETURN: 'Return',
      ADJUST: 'Adjustment',
    };
    return map[type] || type;
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 1.25,
        }}
      >
        <PageHeader kicker="Materials" title="Inventory" compact />
        {stats && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', pb: 0.5 }}>
            <StatMiniCard
              label="Active SKUs"
              value={stats.total_items}
              icon={<Inventory2 sx={{ fontSize: 20, color: slate[500] }} />}
            />
            <StatMiniCard
              label="Low stock"
              value={stats.low_stock_items}
              accent="error.main"
              icon={<Warning sx={{ fontSize: 20, color: 'error.main' }} />}
            />
            <StatMiniCard
              label="In stock"
              value={displayData.length}
              icon={<LocalShipping sx={{ fontSize: 20, color: slate[500] }} />}
            />
          </Stack>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          mb: 1,
          borderRadius: 0,
          border: '1px solid',
          borderColor: 'divider',
          px: { xs: 1, md: 1.5 },
          py: 0.5,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="scrollable"
          allowScrollButtonsMobile
        >
          <Tab label={`All stock (${items.length})`} />
          <Tab label={`Low stock (${lowStockItems.length})`} />
        </Tabs>
        <TextField
          size="small"
          placeholder="Search item, PI, customer, supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { xs: '100%', sm: 280 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${alpha('#2563eb', 0.15)}`,
          borderRadius: 1,
          overflow: 'auto',
          bgcolor: '#fff',
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ ...headCellSx, minWidth: 160 }}>Item</TableCell>
              <TableCell sx={{ ...headCellSx, minWidth: 200 }}>Properties</TableCell>
              <TableCell sx={{ ...headCellSx, width: 90 }}>Code</TableCell>
              <TableCell sx={{ ...headCellSx, width: 80 }}>Category</TableCell>
              <TableCell sx={{ ...headCellSx, width: 90, textAlign: 'right' }}>Qty</TableCell>
              <TableCell sx={{ ...headCellSx, minWidth: 130 }}>Customer PI</TableCell>
              <TableCell sx={{ ...headCellSx, minWidth: 120 }}>Supplier</TableCell>
              <TableCell sx={{ ...headCellSx, width: 70 }}>Status</TableCell>
              <TableCell sx={{ ...headCellSx, width: 150 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ py: 5, textAlign: 'center', color: slate[500] }}>
                  Loading inventory…
                </TableCell>
              </TableRow>
            ) : displayData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ py: 5, textAlign: 'center', color: slate[500] }}>
                  No stock items found. Items appear here when purchase bills are saved.
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((row, index) => (
                <TableRow key={row.id} hover sx={rowSx(index)}>
                  <TableCell sx={{ ...bodyCellSx, maxWidth: 180 }}>
                    <InventoryItemParticulars item={row} compact />
                  </TableCell>
                  <TableCell sx={{ ...bodyCellSx, minWidth: 220 }}>
                    <PropertyCards item={row} dense />
                  </TableCell>
                  <TableCell sx={bodyCellSx}>
                    <Typography variant="body2" fontWeight={600} color={slate[700]}>
                      {row.item_code}
                    </Typography>
                  </TableCell>
                  <TableCell sx={bodyCellSx}>
                    <Chip
                      label={row.category}
                      size="small"
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        bgcolor: alpha('#6366f1', 0.1),
                        color: '#4338ca',
                        border: `1px solid ${alpha('#6366f1', 0.25)}`,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ ...bodyCellSx, textAlign: 'right' }}>
                    <Box
                      sx={{
                        display: 'inline-block',
                        px: 1,
                        py: 0.35,
                        borderRadius: 1,
                        bgcolor: alpha('#059669', 0.1),
                        border: `1px solid ${alpha('#059669', 0.25)}`,
                      }}
                    >
                      <Typography fontWeight={800} fontSize="0.9rem" color="#047857">
                        {fmtQty(row.current_stock)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
                        {row.unit}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={bodyCellSx}>
                    {(row.pi_refs || []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {row.pi_refs.map((pi) => (
                          <Box key={pi.pi_number}>
                            <Typography variant="body2" fontWeight={700} lineHeight={1.3}>
                              {pi.pi_number}
                            </Typography>
                            {pi.customer && (
                              <Typography variant="caption" color="text.secondary">
                                {pi.customer}
                              </Typography>
                            )}
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell sx={bodyCellSx}>
                    {(row.suppliers || []).length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        —
                      </Typography>
                    ) : (
                      <Stack spacing={0.5}>
                        {row.suppliers.map((s) => (
                          <Typography key={s} variant="body2" lineHeight={1.35}>
                            {s}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell sx={bodyCellSx}>
                    {row.needs_reorder ? (
                      <Chip label="Low" color="error" size="small" icon={<Warning />} />
                    ) : (
                      <Chip label="OK" color="success" size="small" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell sx={bodyCellSx} align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <Button
                        size="small"
                        startIcon={<History />}
                        onClick={() => openDetail(row)}
                      >
                        Details
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        startIcon={<Outbound />}
                        disabled={parseFloat(row.current_stock) <= 0}
                        onClick={() => openRelease(row)}
                      >
                        Release
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Paper>

      {/* Detail dialog */}
      <Dialog open={Boolean(detailItem)} onClose={closeDetail} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Stock details
          {summary && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {summary.item_code} · {fmtQty(summary.current_stock)} {summary.unit} on hand
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {summary && (
            <Box>
              <InventoryItemFull item={summary} />

              <Grid container spacing={2} sx={{ mt: 2, mb: 3 }}>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Received
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {fmtQty(summary.total_received)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Released
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      {fmtQty(summary.total_released)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      On hand
                    </Typography>
                    <Typography variant="h6" fontWeight={700} color="primary.main">
                      {fmtQty(summary.current_stock)} {summary.unit}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {(summary.pi_refs?.length > 0 || summary.suppliers?.length > 0) && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assignment fontSize="small" /> Linked PI & supplier
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                    {summary.pi_refs?.map((pi) => (
                      <Box key={pi.pi_number} sx={{ mb: 1 }}>
                        <Typography fontWeight={700}>{pi.pi_number}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Customer: {pi.customer || '—'}
                        </Typography>
                      </Box>
                    ))}
                    {summary.suppliers?.length > 0 && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Supplier: {summary.suppliers.join(', ')}
                      </Typography>
                    )}
                  </Paper>
                </>
              )}

              {summary.stock_sources?.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Receipt batches
                  </Typography>
                  <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={headCellSx}>Date</TableCell>
                          <TableCell sx={headCellSx}>Qty</TableCell>
                          <TableCell sx={headCellSx}>PI</TableCell>
                          <TableCell sx={headCellSx}>Customer</TableCell>
                          <TableCell sx={headCellSx}>Supplier</TableCell>
                          <TableCell sx={headCellSx}>Bill ref</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summary.stock_sources.map((src, i) => (
                          <TableRow key={`${src.bill_ref}-${i}`}>
                            <TableCell>{formatDateDisplay(src.received_at)}</TableCell>
                            <TableCell>{fmtQty(src.quantity)}</TableCell>
                            <TableCell>{src.pi_number || '—'}</TableCell>
                            <TableCell>{src.customer || '—'}</TableCell>
                            <TableCell>{src.supplier || '—'}</TableCell>
                            <TableCell>{src.bill_ref || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </>
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Transaction history
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 280, overflow: 'auto' }}>
                {(summary.all_logs || []).map((log) => (
                  <Box
                    key={log.id}
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderBottom: `1px solid ${slate[100]}`,
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 80px 1fr',
                      gap: 1,
                      alignItems: 'center',
                    }}
                  >
                    <Chip
                      size="small"
                      label={logLabel(log.transaction_type)}
                      color={log.transaction_type === 'ISSUE' ? 'warning' : 'default'}
                      variant="outlined"
                    />
                    <Typography variant="body2">
                      {log.reference_number || log.vendor_supplier || '—'}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {fmtQty(log.quantity)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateDisplay(log.created_at)}
                      {log.remarks ? ` · ${log.remarks}` : ''}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetail}>Close</Button>
          {detailItem && parseFloat(detailItem.current_stock) > 0 && (
            <Button
              variant="contained"
              startIcon={<Outbound />}
              onClick={() => {
                openRelease(detailItem);
              }}
            >
              Release stock
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Release dialog */}
      <Dialog open={Boolean(releaseItem)} onClose={closeRelease} maxWidth="xs" fullWidth>
        <DialogTitle>Release to production</DialogTitle>
        <DialogContent>
          {releaseItem && (
            <Box sx={{ pt: 1 }}>
              <InventoryItemFull item={releaseItem} compact />
              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                Available: <strong>{fmtQty(releaseItem.current_stock)} {releaseItem.unit}</strong>
              </Alert>
              <TextField
                fullWidth
                label="Quantity to release"
                type="number"
                value={releaseQty}
                onChange={(e) => setReleaseQty(e.target.value)}
                inputProps={{ min: 0, step: 'any' }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Remarks (optional)"
                multiline
                rows={2}
                value={releaseRemarks}
                onChange={(e) => setReleaseRemarks(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRelease} disabled={releaseLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleRelease} disabled={releaseLoading}>
            {releaseLoading ? 'Releasing…' : 'Confirm release'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Inventory;
