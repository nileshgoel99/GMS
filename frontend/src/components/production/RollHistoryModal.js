import React, { useEffect, useState } from 'react';
import {
  Box, Dialog, DialogContent, DialogTitle, IconButton, Table, TableBody,
  TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { Close, History } from '@mui/icons-material';
import { productionAPI } from '../../services/api';
import { formatDateDisplay } from '../../utils/formatDate';
import { slate } from '../../theme/appTheme';

const fmt = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

export default function RollHistoryModal({ open, rollNo, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !rollNo) {
      setData(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await productionAPI.getFabricRollHistory(rollNo);
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setData({ roll_no: rollNo, usages: [], exists: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, rollNo]);

  const usages = data?.usages || [];
  const unit = data?.unit || 'MTRS';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <History color="primary" fontSize="small" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
            Roll {rollNo || '—'}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {data
              ? `Balance ${fmt(data.current_balance)} ${unit} · Original ${fmt(data.original_meters)} ${unit}`
              : 'Usage history'}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: 2.5, py: 2 }}>
        {loading ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Loading…</Typography>
        ) : usages.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No prior cuttings for this roll yet.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: slate[50] }}>
                  {['Date', 'Cutting #', 'Buyer PO', 'Item', 'Total', 'Used', 'Rejected', 'Balance'].map((h) => (
                    <TableCell
                      key={h}
                      align={['Total', 'Used', 'Rejected', 'Balance'].includes(h) ? 'right' : 'left'}
                      sx={{ fontWeight: 700, fontSize: '0.72rem', whiteSpace: 'nowrap' }}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {usages.map((u) => (
                  <TableRow key={`${u.cutting_id}-${u.cutting_number}`}>
                    <TableCell>{formatDateDisplay(u.cutting_date)}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                      {u.cutting_number}
                    </TableCell>
                    <TableCell>{u.buyer_po_number || '—'}</TableCell>
                    <TableCell>
                      {[u.item_name, u.color].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell align="right">{fmt(u.total_meters)}</TableCell>
                    <TableCell align="right">{fmt(u.used_meters)}</TableCell>
                    <TableCell align="right">{fmt(u.rejected_meters)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(u.balance_meters)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
