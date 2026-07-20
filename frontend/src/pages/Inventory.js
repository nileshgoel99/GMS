import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  Warning,
  Inventory2,
  Outbound,
  History,
  Close,
  Assignment,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import PageHeader from '../components/PageHeader';
import InventoryItemParticulars, {
  PropertyCards,
  InventoryItemFull,
} from '../components/inventory/InventoryItemParticulars';
import { extractTrimProperties, getItemDisplayName } from '../utils/extractTrimProperties';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { inventoryAPI } from '../services/api';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const fmtQty = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 1e4) / 1e4;
  return rounded.toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
};

const headCellSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: slate[700],
  py: 1.1,
  bgcolor: alpha('#0f766e', 0.06),
  borderBottom: `2px solid ${alpha('#0f766e', 0.18)}`,
  whiteSpace: 'nowrap',
};

const itemSearchHaystack = (row) => {
  const props = extractTrimProperties(row);
  return [
    row.item_code,
    row.item_name,
    row.trim_name,
    row.name,
    getItemDisplayName(row),
    row.category,
    row.unit,
    ...(row.property_lines || []),
    ...props.flatMap((p) => [p.label, p.value]),
    ...(row.suppliers || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const matchesSearch = (row, query) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = itemSearchHaystack(row);
  return tokens.every((t) => hay.includes(t));
};

const stockTone = (row) => {
  const qty = parseFloat(row.current_stock) || 0;
  if (qty <= 0) return { key: 'empty', color: slate[500] };
  if (row.needs_reorder) return { key: 'low', color: '#b45309' };
  return { key: 'ok', color: '#047857' };
};

const StockQty = ({ row }) => {
  const qty = parseFloat(row.current_stock) || 0;
  const tone = stockTone(row);

  return (
    <Box sx={{ minWidth: 72, textAlign: 'right' }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 0.5 }}>
        <Typography
          className="font-numeric"
          sx={{
            fontWeight: 800,
            fontSize: '1rem',
            color: tone.color,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.1,
          }}
        >
          {fmtQty(qty)}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: slate[500] }}>
          {row.unit}
        </Typography>
      </Box>
    </Box>
  );
};

const FilterChip = ({ active, label, count, onClick, color = 'default' }) => (
  <Chip
    label={count != null ? `${label} · ${count}` : label}
    onClick={onClick}
    size="small"
    color={active ? (color === 'warning' ? 'warning' : 'primary') : 'default'}
    variant={active ? 'filled' : 'outlined'}
    sx={{
      fontWeight: 700,
      fontSize: '0.72rem',
      height: 28,
      borderRadius: 1.5,
      ...(active && color === 'default' ? {} : {}),
      ...(!active ? { borderColor: slate[200], color: slate[700] } : {}),
    }}
  />
);

const Inventory = () => {
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all | low | zero
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [summary, setSummary] = useState(null);
  const [releaseItem, setReleaseItem] = useState(null);
  const [releaseQty, setReleaseQty] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const searchRef = useRef(null);

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

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lowIdSet = useMemo(() => new Set(lowStockItems.map((r) => r.id)), [lowStockItems]);

  const categories = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      const cat = (row.category || 'OTHER').toUpperCase();
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => {
    let rows = items;
    if (stockFilter === 'low') {
      rows = rows.filter((r) => lowIdSet.has(r.id) || r.needs_reorder);
    } else if (stockFilter === 'zero') {
      rows = rows.filter((r) => (parseFloat(r.current_stock) || 0) <= 0);
    }
    if (categoryFilter) {
      rows = rows.filter((r) => (r.category || '').toUpperCase() === categoryFilter);
    }
    rows = rows.filter((r) => matchesSearch(r, search));
    return [...rows].sort((a, b) => {
      const na = getItemDisplayName(a).localeCompare(getItemDisplayName(b));
      if (na !== 0) return na;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [items, stockFilter, categoryFilter, search, lowIdSet]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const cat = (row.category || 'OTHER').toUpperCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(row);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const zeroCount = useMemo(
    () => items.filter((r) => (parseFloat(r.current_stock) || 0) <= 0).length,
    [items],
  );

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

  const openRelease = (item, e) => {
    e?.stopPropagation?.();
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

  const clearFilters = () => {
    setSearch('');
    setStockFilter('all');
    setCategoryFilter(null);
    searchRef.current?.focus();
  };

  const hasActiveFilters = Boolean(search.trim() || stockFilter !== 'all' || categoryFilter);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1280, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2,
        }}
      >
        <PageHeader
          kicker="Materials"
          title="Inventory"
          subtitle="Search by trim name, color, size, or supplier — click a row for history"
          compact
        />
        <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.85,
              borderRadius: 1.5,
              border: `1px solid ${slate[200]}`,
              bgcolor: '#fff',
              minWidth: 88,
            }}
          >
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: slate[500], textTransform: 'uppercase' }}>
              SKUs
            </Typography>
            <Typography className="font-numeric" sx={{ fontWeight: 800, fontSize: '1.2rem', color: slate[900] }}>
              {stats?.total_items ?? items.length}
            </Typography>
          </Box>
          <Box
            sx={{
              px: 1.5,
              py: 0.85,
              borderRadius: 1.5,
              border: `1px solid ${alpha('#b45309', 0.25)}`,
              bgcolor: alpha('#f59e0b', 0.06),
              minWidth: 88,
            }}
          >
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>
              Low stock
            </Typography>
            <Typography className="font-numeric" sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#b45309' }}>
              {stats?.low_stock_items ?? lowStockItems.length}
            </Typography>
          </Box>
        </Stack>
      </Box>

      {/* Search & filters */}
      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(0), mb: 2, p: { xs: 1.5, sm: 2 } }}>
        <TextField
          fullWidth
          inputRef={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trim, color, width, size, supplier…"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: slate[400] }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {search ? (
                  <IconButton size="small" onClick={() => setSearch('')} edge="end" aria-label="Clear search">
                    <Close fontSize="small" />
                  </IconButton>
                ) : (
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: slate[400],
                      border: `1px solid ${slate[200]}`,
                      borderRadius: 1,
                      px: 0.75,
                      py: 0.25,
                      display: { xs: 'none', sm: 'inline' },
                    }}
                  >
                    ⌘K
                  </Typography>
                )}
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            '& .MuiInputBase-root': {
              borderRadius: 2,
              bgcolor: slate[50],
              fontSize: '0.95rem',
              fontWeight: 600,
            },
          }}
        />

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
          <FilterChip
            label="All"
            count={items.length}
            active={stockFilter === 'all' && !categoryFilter}
            onClick={() => { setStockFilter('all'); setCategoryFilter(null); }}
          />
          <FilterChip
            label="Low stock"
            count={lowStockItems.length}
            active={stockFilter === 'low'}
            color="warning"
            onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          />
          {zeroCount > 0 && (
            <FilterChip
              label="Empty"
              count={zeroCount}
              active={stockFilter === 'zero'}
              onClick={() => setStockFilter(stockFilter === 'zero' ? 'all' : 'zero')}
            />
          )}
          <Box sx={{ width: 1, height: 20, bgcolor: slate[200], mx: 0.25, display: { xs: 'none', sm: 'block' } }} />
          {categories.map(([cat, count]) => (
            <FilterChip
              key={cat}
              label={cat}
              count={count}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            />
          ))}
          {hasActiveFilters && (
            <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none', fontWeight: 700, ml: 0.5 }}>
              Clear filters
            </Button>
          )}
        </Stack>

        <Typography sx={{ mt: 1.25, fontSize: '0.75rem', color: slate[500] }}>
          {loading ? 'Loading…' : (
            <>
              Showing <Box component="span" sx={{ fontWeight: 800, color: slate[800] }}>{filtered.length}</Box>
              {filtered.length !== items.length && <> of {items.length}</>}
              {' '}item{filtered.length === 1 ? '' : 's'}
              {search.trim() && <> matching “{search.trim()}”</>}
            </>
          )}
        </Typography>
      </Paper>

      {/* Stock list */}
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${slate[200]}`,
          borderRadius: 2,
          overflow: 'hidden',
          bgcolor: '#fff',
          minHeight: 280,
        }}
      >
        {loading ? (
          <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 7, px: 3, textAlign: 'center' }}>
            <Inventory2 sx={{ fontSize: 36, color: slate[300], mb: 1 }} />
            <Typography sx={{ fontWeight: 700, color: slate[700], mb: 0.5 }}>
              No matching stock
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: slate[500], mb: 1.5 }}>
              {items.length === 0
                ? 'Items appear here when purchase bills are saved.'
                : 'Try another search or clear filters.'}
            </Typography>
            {hasActiveFilters && (
              <Button size="small" variant="outlined" onClick={clearFilters} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Clear filters
              </Button>
            )}
          </Box>
        ) : (
          grouped.map(([category, rows], gIdx) => (
            <Box key={category}>
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: gIdx % 2 === 0 ? alpha('#0f766e', 0.04) : alpha(slate[900], 0.03),
                  borderBottom: `1px solid ${slate[100]}`,
                  borderTop: gIdx > 0 ? `1px solid ${slate[100]}` : 'none',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: slate[600],
                  }}
                >
                  {category}
                </Typography>
                <Chip
                  size="small"
                  label={rows.length}
                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: '#fff', border: `1px solid ${slate[200]}` }}
                />
              </Box>

              {rows.map((row) => {
                const tone = stockTone(row);
                const suppliers = row.suppliers || [];
                return (
                  <Box
                    key={row.id}
                    onClick={() => openDetail(row)}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: '1fr auto',
                        md: 'minmax(140px, 1.1fr) minmax(180px, 1.6fr) minmax(100px, 0.9fr) 120px 88px',
                      },
                      gap: { xs: 1, md: 1.5 },
                      alignItems: 'center',
                      px: { xs: 1.5, sm: 2 },
                      py: 1.35,
                      cursor: 'pointer',
                      borderBottom: `1px solid ${slate[100]}`,
                      bgcolor: tone.key === 'low' ? alpha('#f59e0b', 0.04) : 'transparent',
                      transition: 'background-color 0.12s ease',
                      '&:hover': { bgcolor: alpha('#0f766e', 0.05) },
                      '&:last-child': { borderBottom: 0 },
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <InventoryItemParticulars item={row} compact />
                      <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, display: { xs: 'flex', md: 'none' }, flexWrap: 'wrap' }}>
                        <PropertyCards item={row} dense />
                      </Stack>
                      {suppliers.length > 0 && (
                        <Typography
                          sx={{
                            mt: 0.4,
                            fontSize: '0.7rem',
                            color: slate[500],
                            display: { xs: 'block', md: 'none' },
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {suppliers.join(', ')}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
                      <PropertyCards item={row} dense />
                    </Box>

                    <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
                      {suppliers.length === 0 ? (
                        <Typography sx={{ fontSize: '0.78rem', color: slate[400] }}>—</Typography>
                      ) : (
                        <Typography
                          sx={{
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: slate[700],
                            lineHeight: 1.35,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {suppliers.join(', ')}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ justifySelf: 'end' }}>
                      <StockQty row={row} />
                    </Box>

                    <Stack
                      direction="row"
                      spacing={0.25}
                      justifyContent="flex-end"
                      onClick={(e) => e.stopPropagation()}
                      sx={{ display: { xs: 'none', md: 'flex' } }}
                    >
                      <Tooltip title="History">
                        <IconButton size="small" onClick={() => openDetail(row)}>
                          <History fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Release to production">
                        <span>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={(parseFloat(row.current_stock) || 0) <= 0}
                            onClick={(e) => openRelease(row, e)}
                          >
                            <Outbound fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          ))
        )}
      </Paper>

      {/* Detail dialog */}
      <Dialog open={Boolean(detailItem)} onClose={closeDetail} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Stock details
          {summary && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {fmtQty(summary.current_stock)} {summary.unit} on hand
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
                    <Typography className="font-numeric" variant="h6" fontWeight={700}>
                      {fmtQty(summary.total_received)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Released
                    </Typography>
                    <Typography className="font-numeric" variant="h6" fontWeight={700}>
                      {fmtQty(summary.total_released)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      On hand
                    </Typography>
                    <Typography className="font-numeric" variant="h6" fontWeight={700} color="primary.main">
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
                            <TableCell className="font-numeric">{fmtQty(src.quantity)}</TableCell>
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
                    <Typography className="font-numeric" variant="body2" fontWeight={700}>
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
              onClick={() => openRelease(detailItem)}
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
