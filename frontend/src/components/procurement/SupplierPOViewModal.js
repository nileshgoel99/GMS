import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography, Chip, Divider, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, Grid, IconButton,
} from '@mui/material';
import { Close, LocalShipping } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { procurementAPI } from '../../services/api';
import { slate } from '../../theme/appTheme';
import { formatDateDisplay } from '../../utils/formatDate';
import BillLineParticulars from './BillLineParticulars';

const STATUS_COLOR = {
  DRAFT: 'default',
  ORDERED: 'info',
  PARTIAL: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const val = (v) => (v != null && String(v).trim() !== '' ? v : '—');

const formatMoney = (n) => {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const viewHeadSx = {
  fontWeight: 700,
  fontSize: '0.78rem',
  py: 1,
  px: 1.25,
  whiteSpace: 'nowrap',
  bgcolor: alpha(slate[900], 0.04),
  borderBottom: `1px solid ${slate[200]}`,
};

const viewCellSx = (align = 'left') => ({
  py: 1.25,
  px: 1.25,
  fontSize: '0.85rem',
  verticalAlign: 'middle !important',
  textAlign: align,
  borderBottom: `1px solid ${slate[100]}`,
  lineHeight: 1.5,
});

const InfoItem = ({ label, value }) => (
  <Box>
    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.25 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, whiteSpace: 'pre-line' }}>{val(value)}</Typography>
  </Box>
);

const PartyBlock = ({ title, content, accent }) => (
  <Box
    sx={{
      p: 1.5,
      borderRadius: 1.5,
      border: `1px solid ${alpha(accent, 0.25)}`,
      bgcolor: alpha(accent, 0.06),
      minHeight: 100,
      maxHeight: 140,
      overflow: 'auto',
    }}
  >
    <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.75 }}>
      {title}
    </Typography>
    <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, whiteSpace: 'pre-line', lineHeight: 1.55 }}>
      {val(content)}
    </Typography>
  </Box>
);

export default function SupplierPOViewModal({ open, poId, onClose, onEdit }) {
  const [loading, setLoading] = useState(false);
  const [po, setPo] = useState(null);

  useEffect(() => {
    if (!open || !poId) {
      setPo(null);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await procurementAPI.getById(poId);
        setPo(res.data);
      } catch (e) {
        console.error(e);
        alert('Failed to load purchase order.');
        onClose?.();
      } finally {
        setLoading(false);
      }
    })();
  }, [open, poId, onClose]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 2, maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2, px: 2.5 }}>
        <LocalShipping sx={{ color: 'primary.main' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', fontFamily: 'monospace' }}>
            {po ? po.po_number : 'Supplier PO'}
          </Typography>
          {po && (
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              {po.vendor_name} · {formatDateDisplay(po.order_date)}
            </Typography>
          )}
        </Box>
        {po && (
          <Chip
            label={po.status}
            size="small"
            color={STATUS_COLOR[po.status] || 'default'}
            sx={{ fontWeight: 700, fontSize: '0.68rem', mr: 1 }}
          />
        )}
        <IconButton size="small" onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ px: 2.5, py: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && po && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}><InfoItem label="Order Date" value={formatDateDisplay(po.order_date)} /></Grid>
              <Grid item xs={6} sm={3}><InfoItem label="Expected Delivery" value={formatDateDisplay(po.expected_delivery_date)} /></Grid>
              <Grid item xs={6} sm={3}><InfoItem label="Reference (Buyer PO)" value={po.reference_number || po.buyer_po_number} /></Grid>
              <Grid item xs={6} sm={3}><InfoItem label="PI Reference" value={po.pi_number} /></Grid>
            </Grid>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <PartyBlock title="Supplier" content={[po.vendor_name, po.vendor_address, po.attention && `Attn: ${po.attention}`].filter(Boolean).join('\n')} accent={slate[700]} />
              </Grid>
              <Grid item xs={12} md={4}>
                <PartyBlock title="Bill To" content={po.bill_to} accent="#0f766e" />
              </Grid>
              <Grid item xs={12} md={4}>
                <PartyBlock title="Ship To" content={po.ship_to} accent="#b45309" />
              </Grid>
            </Grid>

            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', mb: 1 }}>Line Items</Typography>
              <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
                <Table size="small" sx={{ minWidth: 720 }}>
                  <TableHead>
                    <TableRow>
                      {['#', 'Particulars', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount'].map((h, i) => (
                        <TableCell key={h} sx={{ ...viewHeadSx, textAlign: i >= 3 ? 'right' : 'left' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(po.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} sx={{ ...viewCellSx('center'), color: 'text.disabled' }}>No line items</TableCell>
                      </TableRow>
                    ) : (
                      (po.items || []).map((item) => (
                        <TableRow key={item.id} hover>
                          <TableCell sx={viewCellSx()}>{item.serial_no}</TableCell>
                          <TableCell sx={{ ...viewCellSx(), minWidth: 220 }}>
                            <BillLineParticulars row={item} />
                          </TableCell>
                          <TableCell sx={{ ...viewCellSx(), fontFamily: 'monospace', fontSize: '0.8rem' }}>{val(item.hsn_code)}</TableCell>
                          <TableCell sx={viewCellSx('right')}>{formatMoney(item.quantity_ordered)}</TableCell>
                          <TableCell sx={viewCellSx('center')}>{val(item.unit)}</TableCell>
                          <TableCell sx={viewCellSx('right')}>{formatMoney(item.unit_price)}</TableCell>
                          <TableCell sx={{ ...viewCellSx('right'), fontWeight: 700 }}>{formatMoney(item.total_price)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <InfoItem label="Payment Terms" value={po.payment_terms} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoItem label="Delivery Terms" value={po.delivery_terms} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoItem
                  label="Transport"
                  value={
                    po.transport_paid_by === 'SUPPLIER'
                      ? 'To be paid by Supplier'
                      : po.transport_paid_by === 'BUYER'
                        ? 'To be paid by Buyer'
                        : null
                  }
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Box sx={{ minWidth: 260, p: 2, borderRadius: 1.5, bgcolor: alpha(slate[900], 0.03), border: `1px solid ${slate[200]}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Subtotal</Typography>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} className="font-numeric">{formatMoney(po.subtotal)}</Typography>
                </Box>
                {po.tax_mode === 'IGST' ? (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>IGST ({po.igst_percent}%)</Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} className="font-numeric">{formatMoney(po.igst_amount)}</Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>CGST ({po.cgst_percent}%)</Typography>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} className="font-numeric">{formatMoney(po.cgst_amount)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>SGST ({po.sgst_percent}%)</Typography>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} className="font-numeric">{formatMoney(po.sgst_amount)}</Typography>
                    </Box>
                  </>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Round Off</Typography>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }} className="font-numeric">{formatMoney(po.round_off)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>Total</Typography>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: 'primary.main', whiteSpace: 'nowrap' }} className="font-numeric">
                    ₹ {formatMoney(po.total_amount)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
        {onEdit && po && (
          <Button variant="contained" onClick={() => onEdit(po.id)} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Edit / Print
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
