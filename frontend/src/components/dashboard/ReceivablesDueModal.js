import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  Box, Button, Typography, Chip, Divider, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import { Close, AccountBalanceWallet, Visibility } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { formatDateDisplay } from '../../utils/formatDate';
import { slate } from '../../theme/appTheme';
import { BuyerPoDetailDialog } from '../../pages/BuyerPOs';

const STATUS_COLOR = {
  RECEIVED: 'default',
  ACKNOWLEDGED: 'info',
  IN_PRODUCTION: 'warning',
  SHIPPED: 'secondary',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const formatMoney = (amount, currency = 'USD') => {
  const num = Number(amount);
  if (Number.isNaN(num)) return '—';
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export default function ReceivablesDueModal({ open, onClose, monthLabel, summary, items = [] }) {
  const [detailId, setDetailId] = useState(null);
  const totalAmount = items.reduce((sum, row) => sum + (Number(row.total_value) || 0), 0);

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
            bgcolor: alpha('#059669', 0.08),
            borderBottom: `1px solid ${alpha('#059669', 0.2)}`,
          }}
        >
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha('#059669', 0.15),
              color: '#047857',
              border: `1px solid ${alpha('#059669', 0.3)}`,
            }}
          >
            <AccountBalanceWallet sx={{ fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: slate[900] }}>
              Receivables Due — {monthLabel || 'This Month'}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
              Buyer purchase orders with ex-factory date in the current month
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
              bgcolor: alpha('#059669', 0.06),
              border: `1px solid ${alpha('#059669', 0.18)}`,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#047857' }}>
                Total Receivable
              </Typography>
              <Typography
                className="font-numeric"
                sx={{ fontWeight: 800, fontSize: '1.35rem', color: '#047857', mt: 0.25, whiteSpace: 'nowrap' }}
              >
                {formatMoney(summary?.total_amount || totalAmount, 'USD')}
              </Typography>
            </Box>
            <Chip
              label={`${summary?.count ?? items.length} order(s)`}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: alpha('#059669', 0.12),
                color: '#047857',
                border: `1px solid ${alpha('#059669', 0.25)}`,
              }}
            />
          </Box>

          {items.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No receivables due for collection this month.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    {['PO Number', 'Buyer', 'Ex-Factory', 'Qty', 'Amount', 'Status', ''].map((h) => (
                      <TableCell key={h || 'actions'} sx={{ ...headSx, textAlign: h === 'Amount' || h === 'Qty' ? 'right' : 'left' }}>
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
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: alpha('#059669', 0.04) } }}
                      onClick={() => setDetailId(row.id)}
                    >
                      <TableCell sx={{ ...cellSx(), fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                        {row.po_number}
                      </TableCell>
                      <TableCell sx={cellSx()}>{row.buyer_name || row.customer_name || '—'}</TableCell>
                      <TableCell sx={cellSx()}>{formatDateDisplay(row.ex_factory_date)}</TableCell>
                      <TableCell sx={cellSx('right')} className="font-numeric">
                        {row.total_qty != null ? Number(row.total_qty).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell sx={{ ...cellSx('right'), fontWeight: 700 }} className="font-numeric">
                        {formatMoney(row.total_value, row.currency || 'USD')}
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

      {detailId && (
        <BuyerPoDetailDialog
          poId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  );
}
