import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  Box, Button, Typography, Chip, Divider, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import { Close, Payments, Visibility } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { formatDateDisplay } from '../../utils/formatDate';
import { slate } from '../../theme/appTheme';
import SupplierPOViewModal from '../procurement/SupplierPOViewModal';

const STATUS_COLOR = {
  DRAFT: 'default',
  ORDERED: 'info',
  PARTIAL: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const formatMoney = (amount, prefix = '₹') => {
  const num = Number(amount);
  if (Number.isNaN(num)) return '—';
  return `${prefix} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const headSx = {
  fontWeight: 700,
  fontSize: '0.75rem',
  py: 1,
  px: 1.5,
  whiteSpace: 'nowrap',
  bgcolor: alpha(slate[900], 0.04),
  borderBottom: `1px solid ${slate[200]}`,
  color: slate[600],
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const cellSx = (align = 'left') => ({
  py: 1.25,
  px: 1.5,
  fontSize: '0.85rem',
  verticalAlign: 'middle',
  textAlign: align,
  borderBottom: `1px solid ${slate[100]}`,
});

export default function PayablesDueModal({ open, onClose, monthLabel, summary, items = [] }) {
  const theme = useTheme();
  const accent = theme.palette.error.dark;
  const [detailId, setDetailId] = useState(null);
  const totalAmount = items.reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0);

  const handleClose = () => {
    setDetailId(null);
    onClose?.();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh', overflow: 'hidden' } }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: alpha(theme.palette.error.main, 0.08),
            borderBottom: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.error.main, 0.15),
              color: accent,
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
            }}
          >
            <Payments sx={{ fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: slate[900] }}>
              Payables Due — {monthLabel || 'This Month'}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
              Supplier POs with payment due this month (based on payment terms)
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose}><Close /></IconButton>
        </Box>

        <DialogContent sx={{ px: 2.5, py: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              mb: 2,
              p: 1.75,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.error.main, 0.06),
              border: `1px solid ${alpha(theme.palette.error.main, 0.18)}`,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: accent }}>
                Total Payable
              </Typography>
              <Typography
                className="font-numeric"
                sx={{ fontWeight: 800, fontSize: '1.35rem', color: accent, mt: 0.25, whiteSpace: 'nowrap' }}
              >
                {formatMoney(summary?.total_amount || totalAmount)}
              </Typography>
            </Box>
            <Chip
              label={`${summary?.count ?? items.length} PO(s)`}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: alpha(theme.palette.error.main, 0.12),
                color: accent,
                border: `1px solid ${alpha(theme.palette.error.main, 0.25)}`,
              }}
            />
          </Box>

          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No payables due this month.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
              <Table size="small" sx={{ minWidth: 680 }}>
                <TableHead>
                  <TableRow>
                    {['PO Number', 'Supplier', 'Payment Due', 'Reference', 'Amount', 'Status', ''].map((h) => (
                      <TableCell key={h || 'actions'} sx={{ ...headSx, textAlign: h === 'Amount' ? 'right' : 'left' }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.04) } }}
                      onClick={() => setDetailId(row.id)}
                    >
                      <TableCell sx={{ ...cellSx(), fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                        {row.po_number}
                      </TableCell>
                      <TableCell sx={cellSx()}>{row.vendor_name || row.supplier_name || '—'}</TableCell>
                      <TableCell sx={cellSx()}>{formatDateDisplay(row.payment_due_date || row.expected_delivery_date)}</TableCell>
                      <TableCell sx={cellSx()}>{row.reference_number || row.buyer_po_number || '—'}</TableCell>
                      <TableCell sx={{ ...cellSx('right'), fontWeight: 700 }} className="font-numeric">
                        {formatMoney(row.total_amount)}
                      </TableCell>
                      <TableCell sx={cellSx()}>
                        <Chip
                          label={row.status?.replaceAll('_', ' ') || '—'}
                          size="small"
                          color={STATUS_COLOR[row.status] || 'default'}
                          sx={{ fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase' }}
                        />
                      </TableCell>
                      <TableCell sx={cellSx()} align="center">
                        <IconButton size="small" color="primary" onClick={(e) => { e.stopPropagation(); setDetailId(row.id); }}>
                          <Visibility fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>

        <Divider />
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button onClick={handleClose} sx={{ textTransform: 'none', fontWeight: 600 }}>Close</Button>
        </DialogActions>
      </Dialog>

      <SupplierPOViewModal
        open={Boolean(detailId)}
        poId={detailId}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}
