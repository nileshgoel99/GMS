import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Collapse,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Visibility, ReceiptLong } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate, warm } from '../theme/appTheme';
import { ordersAPI } from '../services/api';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'RECEIVED',      label: 'Received',      color: 'default'   },
  { value: 'ACKNOWLEDGED',  label: 'Acknowledged',   color: 'info'      },
  { value: 'IN_PRODUCTION', label: 'In Production',  color: 'warning'   },
  { value: 'SHIPPED',       label: 'Shipped',        color: 'secondary' },
  { value: 'COMPLETED',     label: 'Completed',      color: 'success'   },
  { value: 'CANCELLED',     label: 'Cancelled',      color: 'error'     },
];
const statusColor = (v) => STATUS_OPTIONS.find((s) => s.value === v)?.color ?? 'default';
const statusLabel = (v) => STATUS_OPTIONS.find((s) => s.value === v)?.label ?? v;

const fmtNum   = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtMoney = (n, ccy = 'USD') =>
  n == null
    ? '—'
    : `${ccy} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Detail dialog (read-only) ─────────────────────────────────────────────────
export function BuyerPoDetailDialog({ poId, onClose, onEdit, onGeneratePI }) {
  const theme = useTheme();
  const [po, setPo] = useState(null);
  const [showBuyer, setShowBuyer] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    ordersAPI.getBuyerPO(poId).then((r) => setPo(r.data)).catch(console.error);
  }, [poId]);

  // Compact label+value block
  const F = ({ label, value, mono = false }) =>
    value ? (
      <Box>
        <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: slate[400], mb: 0.3 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: slate[800], whiteSpace: 'pre-line', fontFamily: mono ? '"IBM Plex Mono", monospace' : 'inherit' }}>
          {value}
        </Typography>
      </Box>
    ) : null;

  // Section heading strip
  const SectionHead = ({ label, accent = slate[400] }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, mt: 0.5 }}>
      <Box sx={{ width: 3, height: 16, bgcolor: accent, borderRadius: 1, flexShrink: 0 }} />
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: slate[500] }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: '1px', bgcolor: slate[100] }} />
    </Box>
  );

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      {/* ── Header banner ── */}
      <Box sx={{ bgcolor: slate[900], px: 3, py: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.45), mb: 0.25 }}>
            Purchase Order
          </Typography>
          <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 900, fontSize: '1.3rem', color: '#fff', letterSpacing: '0.02em' }}>
            {po?.po_number || '…'}
          </Typography>
        </Box>
        {po && (
          <Chip
            label={statusLabel(po.status)}
            color={statusColor(po.status) === 'default' ? undefined : statusColor(po.status)}
            size="small"
            sx={{
              fontWeight: 800,
              fontSize: '0.7rem',
              letterSpacing: '0.04em',
              ml: 'auto',
              ...(statusColor(po.status) === 'default' && {
                bgcolor: alpha('#fff', 0.15),
                color: '#fff',
                border: `1px solid ${alpha('#fff', 0.35)}`,
              }),
            }}
          />
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: alpha('#fff', 0.5), '&:hover': { color: '#fff' } }}>
          ✕
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
        {!po ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ color: slate[400] }}>Loading…</Typography>
          </Box>
        ) : (
          <Box>
            {/* ── PO Identity row ── */}
            <Box sx={{ bgcolor: '#fff', px: 3, py: 2.5, borderBottom: `1px solid ${slate[100]}` }}>
              <Grid container spacing={3}>
                <Grid item xs={6} sm={3}><F label="PO Date"         value={po.po_date} /></Grid>
                <Grid item xs={6} sm={3}><F label="Ex-Factory Date" value={po.ex_factory_date} /></Grid>
                <Grid item xs={6} sm={3}><F label="Currency"        value={po.currency} /></Grid>
                <Grid item xs={6} sm={3}><F label="Supplier Code"   value={po.supplier_code} mono /></Grid>
              </Grid>
            </Box>

            {/* ── Buyer + Terms (collapsible row) ── */}
            <Box sx={{ borderBottom: `1px solid ${slate[100]}`, bgcolor: '#fff' }}>
              <Grid container>
                {/* Buyer block */}
                <Grid item xs={12} sm={6} sx={{ borderRight: { sm: `1px solid ${slate[100]}` } }}>
                  <Box
                    onClick={() => setShowBuyer(v => !v)}
                    sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', userSelect: 'none',
                      '&:hover': { bgcolor: alpha('#0369a1', 0.03) } }}
                  >
                    <Box sx={{ width: 3, height: 14, bgcolor: '#0369a1', borderRadius: 1, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: slate[500], flex: 1 }}>
                      Buyer Details
                    </Typography>
                    {po.buyer_name && (
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: slate[600], mr: 1 }} noWrap>
                        {po.buyer_name}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '0.75rem', color: slate[400] }}>{showBuyer ? '▲' : '▼'}</Typography>
                  </Box>
                  <Collapse in={showBuyer}>
                    <Box sx={{ px: 3, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <F label="Company"  value={po.buyer_name} />
                      <F label="Contact"  value={po.buyer_contact} />
                      {po.buyer_address && <F label="Address" value={po.buyer_address} />}
                    </Box>
                  </Collapse>
                </Grid>

                {/* Commercial Terms block */}
                <Grid item xs={12} sm={6}>
                  <Box
                    onClick={() => setShowTerms(v => !v)}
                    sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer', userSelect: 'none',
                      '&:hover': { bgcolor: alpha('#0f766e', 0.03) } }}
                  >
                    <Box sx={{ width: 3, height: 14, bgcolor: '#0f766e', borderRadius: 1, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: slate[500], flex: 1 }}>
                      Commercial Terms
                    </Typography>
                    {po.delivery_terms && (
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: slate[600], mr: 1 }} noWrap>
                        {po.delivery_terms}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '0.75rem', color: slate[400] }}>{showTerms ? '▲' : '▼'}</Typography>
                  </Box>
                  <Collapse in={showTerms}>
                    <Box sx={{ px: 3, pb: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {po.delivery_terms  && <F label="Terms of Delivery" value={po.delivery_terms} />}
                      {po.payment_terms   && <F label="Terms of Payment"  value={po.payment_terms} />}
                      <Grid container spacing={2}>
                        {po.delivery_method && <Grid item xs={12} sm={4}><F label="Delivery Method"  value={po.delivery_method} /></Grid>}
                        {po.freight_terms   && <Grid item xs={12} sm={4}><F label="Freight Terms"    value={po.freight_terms} /></Grid>}
                        {po.packaging_terms && <Grid item xs={12} sm={4}><F label="Packaging Terms"  value={po.packaging_terms} /></Grid>}
                      </Grid>
                    </Box>
                  </Collapse>
                </Grid>
              </Grid>
            </Box>

            {/* ── Line Items ── */}
            <Box sx={{ px: 3, py: 2.5 }}>
              <SectionHead label={`Line Items · ${(po.lines || []).length} Styles`} accent="#0f766e" />

              {(po.lines || []).map((line, i) => (
                <Paper
                  key={line.id}
                  elevation={0}
                  sx={{
                    mb: 1.5,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: `1px solid ${i % 2 === 0 ? slate[200] : alpha('#0f766e', 0.18)}`,
                    bgcolor: i % 2 === 0 ? '#fff' : alpha('#0f766e', 0.03),
                  }}
                >
                  {/* Line header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, bgcolor: i % 2 === 0 ? slate[50] : alpha('#0f766e', 0.06), borderBottom: `1px solid ${i % 2 === 0 ? slate[100] : alpha('#0f766e', 0.12)}`, flexWrap: 'wrap' }}>
                    <Box sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.65rem', fontWeight: 800, color: '#fff', bgcolor: slate[700], px: 1, py: 0.3, borderRadius: 0.75 }}>
                      L{i + 1}
                    </Box>
                    {line.item_code && (
                      <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.8rem', fontWeight: 700, color: '#0f766e', bgcolor: alpha('#0f766e', 0.08), px: 0.75, borderRadius: 0.75 }}>
                        {line.item_code}
                      </Typography>
                    )}
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', color: slate[800] }}>{line.item_name}</Typography>
                    {line.color && <Chip label={line.color} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }} />}
                    <Box sx={{ flex: 1 }} />
                    {line.unit_price && (
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: slate[500] }}>
                        ${parseFloat(line.unit_price).toFixed(2)}{line.uom ? `/${line.uom}` : '/pc'}
                        {line.discount ? ` · ${line.discount}% off` : ''}
                      </Typography>
                    )}
                    {line.line_amount && (
                      <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f766e' }}>
                        {fmtMoney(line.line_amount)}
                      </Typography>
                    )}
                  </Box>

                  {/* Line body */}
                  <Box sx={{ px: 2, py: 1.5 }}>
                    {(line.fabric || line.customer_ref || line.delivery_date) && (
                      <Grid container spacing={2} sx={{ mb: line.size_breakdown?.length ? 1.5 : 0 }}>
                        {line.fabric        && <Grid item xs={12} sm={6}><F label="Fabric" value={line.fabric} /></Grid>}
                        {line.customer_ref  && <Grid item xs={6}  sm={3}><F label="Customer Ref" value={line.customer_ref} /></Grid>}
                        {line.delivery_date && <Grid item xs={6}  sm={3}><F label="Delivery Date" value={line.delivery_date} /></Grid>}
                      </Grid>
                    )}
                    {(line.size_breakdown || []).length > 0 && (
                      <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ '& td, & th': { px: 1.5, py: 0.75, borderColor: slate[100], textAlign: 'center' } }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: slate[50] }}>
                              {line.size_breakdown.map((r, si) => (
                                <TableCell key={si} sx={{ fontWeight: 800, fontSize: '0.75rem', color: slate[600] }}>{r.size}</TableCell>
                              ))}
                              <TableCell sx={{ fontWeight: 800, fontSize: '0.75rem', color: slate[700], bgcolor: slate[100] }}>Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            <TableRow>
                              {line.size_breakdown.map((r, si) => (
                                <TableCell key={si} sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{fmtNum(r.qty)}</TableCell>
                              ))}
                              <TableCell sx={{ fontWeight: 900, fontSize: '0.95rem', color: slate[800], bgcolor: alpha(slate[100], 0.5) }}>
                                {fmtNum(line.quantity)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </Box>
                    )}
                  </Box>
                </Paper>
              ))}

              {/* ── Order totals ── */}
              <Box sx={{ mt: 2, bgcolor: slate[900], borderRadius: 2, px: 3, py: 2, display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4), mb: 0.3 }}>Styles</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#f1f5f9' }}>{(po.lines || []).length}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4), mb: 0.3 }}>Total Pcs</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#f1f5f9', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(po.total_qty)}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: alpha('#fff', 0.4), mb: 0.3 }}>Order Value</Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.5rem', color: theme.palette.primary.light, fontVariantNumeric: 'tabular-nums' }}>
                    {fmtMoney(po.total_value, po.currency)}
                  </Typography>
                </Box>
              </Box>

              {po.notes && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#fffbf0', border: `1px solid ${alpha('#b45309', 0.2)}`, borderRadius: 2 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#b45309', mb: 0.5 }}>Internal Notes</Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: slate[700], whiteSpace: 'pre-line' }}>{po.notes}</Typography>
                </Box>
              )}

              {/* PO Document */}
              {po.po_document && (
                <Box sx={{ mt: 2, p: 2, bgcolor: alpha('#0f766e', 0.04), border: `1px solid ${alpha('#0f766e', 0.2)}`, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0f766e', flex: 1 }}>
                    📎 Original PO Document
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    component="a"
                    href={po.po_document}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ fontWeight: 700, textTransform: 'none', borderColor: '#0f766e', color: '#0f766e', borderRadius: 1.5, fontSize: '0.78rem' }}
                  >
                    Open / Download
                  </Button>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, bgcolor: '#fff', borderTop: `1px solid ${slate[100]}`, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: slate[500], fontWeight: 700 }}>Close</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" onClick={onEdit} sx={{ fontWeight: 700, borderRadius: 1.5 }}>
          Edit PO
        </Button>
        <Button
          variant="contained"
          startIcon={<ReceiptLong />}
          onClick={onGeneratePI}
          sx={{ fontWeight: 700, borderRadius: 1.5, bgcolor: '#0f766e', '&:hover': { bgcolor: '#0d6560' } }}
        >
          {po?.pi_ref ? 'View PI' : 'Generate PI'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── List page ─────────────────────────────────────────────────────────────────
export default function BuyerPOs() {
  const theme    = useTheme();
  const navigate = useNavigate();

  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [detailId,  setDetailId]  = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersAPI.getBuyerPOs();
      setRows(res.data.results ?? res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this PO?')) return;
    await ordersAPI.deleteBuyerPO(id);
    loadData();
  };

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.po_number?.toLowerCase().includes(q) ||
        r.buyer_name?.toLowerCase().includes(q) ||
        r.customer_name?.toLowerCase().includes(q) ||
        r.buyer_contact?.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalPcs = useMemo(() => filteredRows.reduce((s, r) => s + (r.total_qty || 0), 0), [filteredRows]);
  const totalVal = useMemo(() => filteredRows.reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0), [filteredRows]);

  // Shared cell wrapper — vertically centres content and respects column alignment
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

  // Grid styles
  const gridSx = {
    ...dataGridSx,
    width: '100%',
    bgcolor: '#fff',
    borderRadius: 2,
    border: `1px solid ${slate[200]}`,
    '& .MuiDataGrid-columnHeaders': {
      ...(dataGridSx['& .MuiDataGrid-columnHeaders'] || {}),
      bgcolor: slate[50],
      borderBottom: `2px solid ${slate[200]}`,
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 800,
      fontSize: '0.72rem',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      color: slate[500],
    },
    '& .MuiDataGrid-cell': {
      borderBottom: `1px solid ${slate[100]}`,
      display: 'flex',
      alignItems: 'center',
    },
    '& .MuiDataGrid-row:hover': {
      bgcolor: `${alpha(theme.palette.primary.main, 0.04)} !important`,
    },
    '& .po-row--alt': {
      bgcolor: `${alpha(slate[100], 0.6)} !important`,
    },
    '& .po-row--alt:hover': {
      bgcolor: `${alpha(theme.palette.primary.main, 0.06)} !important`,
    },
  };

  const columns = [
    {
      field: 'po_number',
      headerName: 'PO Number',
      minWidth: 140,
      flex: 0.9,
      headerAlign: 'left',
      renderCell: (p) => cell('left',
        <Typography
          sx={{
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '0.82rem',
            fontWeight: 800,
            color: theme.palette.primary.dark,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            px: 1.25,
            py: 0.4,
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            letterSpacing: '0.02em',
          }}
        >
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'po_date',
      headerName: 'PO Date',
      minWidth: 105,
      flex: 0.6,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: slate[700] }}>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'buyer_name',
      headerName: 'Buyer',
      minWidth: 180,
      flex: 1.4,
      headerAlign: 'left',
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.2 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.3, color: slate[900] }}>
            {p.value || p.row.customer_name || '—'}
          </Typography>
          {p.row.buyer_contact && (
            <Typography sx={{ fontSize: '0.72rem', color: slate[500], fontWeight: 500 }}>
              {p.row.buyer_contact}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'lines_count',
      headerName: 'Lines',
      minWidth: 72,
      flex: 0.4,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Box
          sx={{
            minWidth: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: slate[100],
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: slate[700] }}>
            {p.value ?? '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'total_qty',
      headerName: 'Total Pcs',
      minWidth: 100,
      flex: 0.6,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums', color: slate[800] }}>
          {fmtNum(p.value)}
        </Typography>
      ),
    },
    {
      field: 'total_value',
      headerName: 'Order Value',
      minWidth: 145,
      flex: 0.85,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', fontVariantNumeric: 'tabular-nums', color: theme.palette.primary.dark }}>
          {fmtMoney(p.value, p.row.currency || 'USD')}
        </Typography>
      ),
    },
    {
      field: 'ex_factory_date',
      headerName: 'Ex-Factory',
      minWidth: 110,
      flex: 0.65,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: p.value ? slate[700] : slate[300] }}>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      minWidth: 130,
      flex: 0.7,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Chip
          label={statusLabel(p.value)}
          color={statusColor(p.value)}
          size="small"
          sx={{ fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.03em' }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 116,
      flex: 0.4,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => { setDetailId(p.row.id); setDetailRow(p.row); }}
              sx={{ color: slate[400], '&:hover': { color: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
              <Visibility sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => navigate(`/buyer-pos/${p.row.id}`)}
              sx={{ color: slate[400], '&:hover': { color: theme.palette.info.main, bgcolor: alpha(theme.palette.info.main, 0.08) } }}>
              <Edit sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={() => handleDelete(p.row.id)}
              sx={{ color: slate[400], '&:hover': { color: theme.palette.error.main, bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
              <Delete sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PageHeader title="Buyer POs" subtitle="Purchase orders received from buyers" />

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search PO number, buyer, contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{
            width: 280,
            '& .MuiOutlinedInput-root': { borderRadius: 1.5 },
            '& .MuiInputBase-input': { fontSize: '0.875rem' },
          }}
        />
        <Box sx={{ flex: 1 }} />
        {filteredRows.length > 0 && (
          <Typography sx={{ fontSize: '0.8rem', color: slate[500], fontVariantNumeric: 'tabular-nums' }}>
            {filteredRows.length} POs · {fmtNum(totalPcs)} pcs · {fmtMoney(totalVal)}
          </Typography>
        )}
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/buyer-pos/new')} size="small">
          New Buyer PO
        </Button>
      </Box>

      {/* Grid */}
      <DataGridShell>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowClassName={(p) =>
            filteredRows.findIndex((r) => r.id === p.id) % 2 === 1 ? 'po-row--alt' : ''
          }
          loading={loading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          rowHeight={64}
          columnHeaderHeight={48}
          onRowDoubleClick={(p) => { setDetailId(p.row.id); setDetailRow(p.row); }}
          sx={{ ...gridSx, height: '100%', border: 'none' }}
        />
      </DataGridShell>

      {/* Detail modal */}
      {detailId != null && (
        <BuyerPoDetailDialog
          poId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => { setDetailId(null); navigate(`/buyer-pos/${detailId}`); }}
          onGeneratePI={() => {
            setDetailId(null);
            if (detailRow?.pi_id) {
              navigate(`/orders/pi/${detailRow.pi_id}/view`);
            } else {
              navigate(`/buyer-pos/${detailId}/generate-pi`);
            }
          }}
        />
      )}
    </Box>
  );
}
