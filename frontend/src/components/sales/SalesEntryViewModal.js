import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Button, Typography,
  Divider, IconButton, Chip, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import { Close, PointOfSale, Edit } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { salesEntryAPI } from '../../services/api';
import { formatDateDisplay } from '../../utils/formatDate';
import { slate } from '../../theme/appTheme';

const STATUS_COLOR = {
  DRAFT: 'default',
  OPEN: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  CANCELLED: 'error',
};

const fmt = (n, currency = 'USD') => {
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return `${currency} ${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function SalesEntryViewModal({ open, entryId, onClose, onEdit }) {
  const theme = useTheme();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !entryId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await salesEntryAPI.getById(entryId);
        if (!cancelled) setEntry(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, entryId]);

  const handleClose = () => {
    setEntry(null);
    onClose?.();
  };

  const currency = entry?.currency || 'USD';

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}>
      <Box sx={{
        px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5,
        bgcolor: alpha(theme.palette.success.main, 0.06),
        borderBottom: `1px solid ${slate[200]}`,
      }}>
        <PointOfSale color="success" />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
            Sales Entry {entry?.internal_ref || ''}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            Invoice: {entry?.invoice_number || '—'}
          </Typography>
        </Box>
        {entry && (
          <Chip label={entry.status} size="small" color={STATUS_COLOR[entry.status] || 'default'}
            sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }} />
        )}
        <IconButton size="small" onClick={handleClose}><Close /></IconButton>
      </Box>

      <DialogContent sx={{ px: 2.5, py: 2 }}>
        {loading || !entry ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading…</Typography>
        ) : (
          <>
            <GridMeta entry={entry} />
            <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5, mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: slate[50] }}>
                    {['#', 'Item', 'Code', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(entry.items || []).map((row, i) => (
                    <TableRow key={row.id ?? i}>
                      <TableCell>{row.serial_no || i + 1}</TableCell>
                      <TableCell>{row.item_name || '—'}</TableCell>
                      <TableCell>{row.item_code || '—'}</TableCell>
                      <TableCell align="right">{row.quantity}</TableCell>
                      <TableCell>{row.unit}</TableCell>
                      <TableCell align="right">{row.unit_price}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(row.total_price, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: slate[50], border: `1px solid ${slate[200]}` }}>
              <MetaRow label="Total" value={fmt(entry.total_amount, currency)} bold />
              <MetaRow label="Amount Received" value={fmt(entry.amount_received, currency)} />
              <MetaRow label="Balance Due" value={fmt(entry.balance_due, currency)} bold accent />
            </Box>
          </>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        {onEdit && entry && (
          <Button startIcon={<Edit />} onClick={() => onEdit(entry.id)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Edit
          </Button>
        )}
        <Button onClick={handleClose} sx={{ textTransform: 'none', fontWeight: 600 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function MetaRow({ label, value, bold, accent }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.4 }}>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: bold ? 700 : 500 }}>{label}</Typography>
      <Typography className="font-numeric" sx={{ fontWeight: 700, color: accent ? 'error.dark' : slate[800] }}>{value}</Typography>
    </Box>
  );
}

function GridMeta({ entry }) {
  const pairs = [
    ['Buyer', entry.customer_name],
    ['Buyer PO', entry.buyer_po_number || '—'],
    ['Sale Date', formatDateDisplay(entry.sale_date)],
    ['Collection Due', formatDateDisplay(entry.collection_due_date || entry.due_date)],
    ['Payment Terms', entry.payment_terms || '—'],
    ['Currency', entry.currency || 'USD'],
  ];
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}>
      {pairs.map(([label, value]) => (
        <Box key={label}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: slate[500] }}>{label}</Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{value}</Typography>
        </Box>
      ))}
    </Box>
  );
}
