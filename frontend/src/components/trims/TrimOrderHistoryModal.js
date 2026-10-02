import React, { useEffect, useState } from 'react';
import {
  Box, Dialog, DialogTitle, DialogContent, IconButton, Typography,
  CircularProgress, Chip, Divider,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { ordersAPI } from '../../services/api';
import { slate } from '../../theme/appTheme';
import { formatDateDMY } from '../../utils/formatDate';

const statusColor = {
  ORDERED: 'info',
  PARTIAL: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  DRAFT: 'default',
};

const qty = (n) => {
  const v = parseFloat(n);
  if (!Number.isFinite(v)) return '—';
  return Number(v.toFixed(2)).toLocaleString();
};

export default function TrimOrderHistoryModal({ open, trim, orders: presetOrders, onClose }) {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    if (presetOrders) {
      setOrders(presetOrders);
      setLoading(false);
      return undefined;
    }
    if (!trim?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    ordersAPI.getTrimOrderHistory(trim.id)
      .then((res) => {
        if (!cancelled) setOrders(res.data?.orders || []);
      })
      .catch(() => {
        if (!cancelled) setOrders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, trim?.id, presetOrders]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Order history</Typography>
          <Typography sx={{ fontSize: '0.82rem', color: slate[500] }}>{trim?.name}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: slate[50] }}>
        {loading && (
          <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {!loading && !orders.length && (
          <Typography sx={{ py: 4, textAlign: 'center', color: slate[500] }}>
            No supplier order has been placed for this trim yet.
          </Typography>
        )}
        {!loading && orders.map((row) => (
          <Box
            key={row.line_id}
            sx={{
              mb: 1.5,
              p: 2,
              bgcolor: '#fff',
              borderRadius: 2,
              border: `1px solid ${slate[200]}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
              <Typography sx={{ fontWeight: 800 }}>{row.po_number}</Typography>
              <Chip size="small" label={row.status} color={statusColor[row.status] || 'default'} sx={{ height: 22, fontWeight: 700 }} />
              <Typography sx={{ ml: 'auto', fontSize: '0.8rem', color: slate[500], fontWeight: 700 }}>
                Placed {row.order_date ? formatDateDMY(row.order_date) : '—'}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }}>{row.supplier_name || 'Supplier not set'}</Typography>
            {(row.supplier_phone || row.supplier_email) && (
              <Typography sx={{ fontSize: '0.8rem', color: slate[600] }}>
                {[row.supplier_phone, row.supplier_email].filter(Boolean).join(' · ')}
              </Typography>
            )}
            {row.supplier_address && (
              <Typography sx={{ fontSize: '0.78rem', color: slate[500], whiteSpace: 'pre-line', mt: 0.25 }}>
                {row.supplier_address}
              </Typography>
            )}
            <Divider sx={{ my: 1.25 }} />
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: slate[400], letterSpacing: '0.06em' }}>ORDERED</Typography>
                <Typography sx={{ fontWeight: 800 }}>{qty(row.quantity_ordered)} {row.unit}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: slate[400], letterSpacing: '0.06em' }}>ARRIVED</Typography>
                <Typography sx={{ fontWeight: 800, color: '#047857' }}>{qty(row.quantity_received)} {row.unit}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: slate[400], letterSpacing: '0.06em' }}>PENDING</Typography>
                <Typography sx={{ fontWeight: 800, color: parseFloat(row.quantity_pending) > 0 ? '#b45309' : slate[700] }}>
                  {qty(row.quantity_pending)} {row.unit}
                </Typography>
              </Box>
            </Box>
            {(row.pi_numbers?.length > 0 || row.buyer_pos?.length > 0) && (
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
                {(row.pi_numbers || []).map((n) => (
                  <Chip key={`pi-${n}`} size="small" label={`PI ${n}`} sx={{ height: 22, bgcolor: alpha('#0369a1', 0.08), fontWeight: 700 }} />
                ))}
                {(row.buyer_pos || []).map((b) => (
                  <Chip key={`po-${b.id}`} size="small" label={`Buyer PO ${b.po_number}`} sx={{ height: 22, fontWeight: 700 }} />
                ))}
              </Box>
            )}
          </Box>
        ))}
      </DialogContent>
    </Dialog>
  );
}
