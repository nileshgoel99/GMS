import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Button, Typography,
  Divider, IconButton, Chip, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import { Close, ReceiptLong, Edit } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { purchaseBillAPI } from '../../services/api';
import { formatDateDisplay } from '../../utils/formatDate';
import { slate } from '../../theme/appTheme';
import BillLineParticulars from './BillLineParticulars';
import PurchaseBillDocuments from './PurchaseBillDocuments';

const STATUS_COLOR = {
  DRAFT: 'default',
  OPEN: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  CANCELLED: 'error',
};

const fmt = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return `₹ ${num.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
};

export default function PurchaseBillViewModal({ open, billId, onClose, onEdit }) {
  const theme = useTheme();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !billId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await purchaseBillAPI.getById(billId);
        if (!cancelled) setBill(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, billId]);

  const handleClose = () => {
    setBill(null);
    onClose?.();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}>
      <Box sx={{
        px: 2.5, py: 2, display: 'flex', alignItems: 'center', gap: 1.5,
        bgcolor: alpha(theme.palette.primary.main, 0.06),
        borderBottom: `1px solid ${slate[200]}`,
      }}>
        <ReceiptLong color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
            Purchase Bill {bill?.internal_ref || ''}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            Supplier invoice: {bill?.bill_number || '—'}
          </Typography>
        </Box>
        {bill && (
          <Chip label={bill.status} size="small" color={STATUS_COLOR[bill.status] || 'default'}
            sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }} />
        )}
        <IconButton size="small" onClick={handleClose}><Close /></IconButton>
      </Box>

      <DialogContent sx={{ px: 2.5, py: 2 }}>
        {loading || !bill ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading…</Typography>
        ) : (
          <>
            <GridMeta bill={bill} />
            <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5, mt: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: slate[50] }}>
                    {['#', 'Item', 'HSN', 'Qty', 'Unit', 'Rate', 'Amount'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem' }} align={h === 'Qty' || h === 'Rate' || h === 'Amount' ? 'right' : 'left'}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(bill.items || []).map((row, i) => {
                    const ordered = row.quantity_ordered;
                    const prev = row.quantity_received_previous;
                    return (
                      <TableRow key={row.id ?? i}>
                        <TableCell>{row.serial_no || i + 1}</TableCell>
                        <TableCell sx={{ width: 220, maxWidth: 220, verticalAlign: 'top' }}>
                          <BillLineParticulars row={row} />
                          {(ordered != null || prev != null) && (
                            <Typography sx={{ fontSize: '0.62rem', color: slate[500], mt: 0.75 }}>
                              {ordered != null && <>Ordered {ordered}</>}
                              {prev != null && prev > 0 && <> · Received earlier {prev}</>}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>{row.hsn_code || '—'}</TableCell>
                        <TableCell align="right">
                          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{row.quantity_billed}</Typography>
                        </TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell align="right">{row.unit_price}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(row.total_price)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: slate[50], border: `1px solid ${slate[200]}` }}>
              <MetaRow label="Subtotal" value={fmt(bill.subtotal)} />
              {bill.tax_mode === 'IGST' ? (
                <MetaRow label={`IGST (${bill.igst_percent}%)`} value={fmt(bill.igst_amount)} />
              ) : (
                <>
                  <MetaRow label={`CGST (${bill.cgst_percent}%)`} value={fmt(bill.cgst_amount)} />
                  <MetaRow label={`SGST (${bill.sgst_percent}%)`} value={fmt(bill.sgst_amount)} />
                </>
              )}
              <MetaRow label="Round Off" value={fmt(bill.round_off)} />
              <MetaRow label="Bill Total" value={fmt(bill.total_amount)} bold />
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: slate[500], mb: 1 }}>
                Invoice Documents
              </Typography>
              <PurchaseBillDocuments
                billId={bill.id}
                documents={bill.documents || []}
                readOnly
              />
            </Box>
          </>
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        {onEdit && bill && (
          <Button startIcon={<Edit />} onClick={() => onEdit(bill.id)} sx={{ textTransform: 'none', fontWeight: 600 }}>
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

function GridMeta({ bill }) {
  const pairs = [
    ['Supplier', bill.supplier_name],
    ['Supplier PO', bill.po_number || '—'],
    ['Bill Date', formatDateDisplay(bill.bill_date)],
    ['Payment Terms', bill.payment_terms || '—'],
    ['Payment Due', formatDateDisplay(bill.due_date || bill.payment_due_date)],
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
