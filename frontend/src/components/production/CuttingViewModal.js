import React, { useEffect, useState } from 'react';
import {
  Box, Button, Dialog, DialogActions, DialogContent, Divider, IconButton,
  Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { ArrowBack, Close, ContentCut, Edit } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { productionAPI } from '../../services/api';
import { formatDateDisplay } from '../../utils/formatDate';
import { slate } from '../../theme/appTheme';

const fmtQty = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const rollLabel = (r) => (typeof r === 'string' ? r : r?.roll_no || '—');

function MetaRow({ label, value, bold }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.35, gap: 2 }}>
      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.85rem', fontWeight: bold ? 700 : 600, textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}

/**
 * Modal for a Buyer PO group: list cuttings → tap one for full detail → Edit opens editor page.
 */
export default function CuttingViewModal({
  open,
  group,
  initialCuttingId,
  onClose,
  onEdit,
}) {
  const theme = useTheme();
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open) {
      setDetailId(null);
      setDetail(null);
      return;
    }
    if (initialCuttingId) {
      setDetailId(initialCuttingId);
    } else {
      setDetailId(null);
      setDetail(null);
    }
  }, [open, initialCuttingId, group?.buyer_po]);

  useEffect(() => {
    if (!open || !detailId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingDetail(true);
      try {
        const res = await productionAPI.getCutting(detailId);
        if (!cancelled) setDetail(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, detailId]);

  const handleClose = () => {
    setDetailId(null);
    setDetail(null);
    onClose?.();
  };

  const cuttings = group?.cuttings || [];
  const unit = detail?.consumption_unit || cuttings[0]?.consumption_unit || 'MTRS';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2, maxHeight: '90vh' } }}
    >
      <Box sx={{
        px: 2.5,
        py: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: alpha(theme.palette.primary.main, 0.06),
        borderBottom: `1px solid ${slate[200]}`,
      }}>
        {detailId ? (
          <IconButton size="small" onClick={() => { setDetailId(null); setDetail(null); }}>
            <ArrowBack fontSize="small" />
          </IconButton>
        ) : (
          <ContentCut color="primary" />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
            {detailId
              ? (detail?.cutting_number || 'Cutting')
              : `Buyer PO ${group?.buyer_po_number || '—'}`}
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            {detailId
              ? [detail?.item_name, detail?.color].filter(Boolean).join(' · ')
              : `PI ${group?.pi_number || '—'} · ${cuttings.length} cutting record(s)`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}><Close /></IconButton>
      </Box>

      <DialogContent sx={{ px: 2.5, py: 2 }}>
        {!detailId ? (
          <>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 1.5,
              mb: 2,
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: slate[50],
              border: `1px solid ${slate[200]}`,
            }}>
              {[
                ['Cuttings', cuttings.length],
                ['Total pcs', fmtQty(group?.total_pcs)],
                ['Fabric used', `${fmtQty(group?.total_used)} ${unit}`],
                ['Latest', formatDateDisplay(group?.latest_date)],
              ].map(([label, val]) => (
                <Box key={label}>
                  <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: slate[500], textTransform: 'uppercase' }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontWeight: 700 }}>{val}</Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: slate[50] }}>
                    {['Cutting #', 'Date', 'Item', 'Color', 'Pcs', 'Used', ''].map((h) => (
                      <TableCell key={h || 'act'} sx={{ fontWeight: 700, fontSize: '0.72rem' }} align={h === 'Pcs' || h === 'Used' ? 'right' : 'left'}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cuttings.map((c) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setDetailId(c.id)}
                    >
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'primary.main' }}>
                        {c.cutting_number}
                      </TableCell>
                      <TableCell>{formatDateDisplay(c.cutting_date)}</TableCell>
                      <TableCell>{c.item_name || '—'}</TableCell>
                      <TableCell>{c.color || '—'}</TableCell>
                      <TableCell align="right">{fmtQty(c.total_pcs)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{fmtQty(c.total_consumption)}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="small"
                          onClick={() => setDetailId(c.id)}
                          sx={{ textTransform: 'none', minWidth: 0, px: 1 }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Click a row to see full cutting details.
            </Typography>
          </>
        ) : loadingDetail || !detail ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Loading…</Typography>
        ) : (
          <CuttingDetailBody detail={detail} fmtQty={fmtQty} />
        )}
      </DialogContent>

      <Divider />
      <DialogActions sx={{ px: 2.5, py: 1.5 }}>
        {detailId && detail && onEdit ? (
          <Button
            startIcon={<Edit />}
            variant="contained"
            onClick={() => onEdit(detail.id)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Edit
          </Button>
        ) : null}
        <Button onClick={handleClose} sx={{ textTransform: 'none', fontWeight: 600 }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function CuttingDetailBody({ detail, fmtQty }) {
  const unit = detail.consumption_unit || 'MTRS';
  const rolls = Array.isArray(detail.roll_numbers) ? detail.roll_numbers : [];
  const sizes = Array.isArray(detail.size_breakdown) ? detail.size_breakdown : [];

  return (
    <>
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: 1.5,
        mb: 2,
      }}>
        {[
          ['Date', formatDateDisplay(detail.cutting_date)],
          ['Buyer PO', detail.buyer_po_number || '—'],
          ['PI', detail.pi_number || '—'],
          ['Fabric', detail.fabric || '—'],
          ['Color', detail.color || '—'],
          ['Roll width', detail.roll_width || '—'],
          ['Cons/pc', fmtQty(detail.consumption_per_pc)],
        ].map(([label, value]) => (
          <Box key={label}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: slate[500] }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: slate[50], border: `1px solid ${slate[200]}`, mb: 2 }}>
        <MetaRow label="Actual used (rolls)" value={`${fmtQty(detail.total_consumption)} ${unit}`} bold />
        <MetaRow label="Ideal (cons × pcs)" value={`${fmtQty(detail.ideal_consumption)} ${unit}`} />
        <MetaRow label="Cut pcs" value={fmtQty(detail.total_pcs)} bold />
      </Box>

      {rolls.length > 0 ? (
        <>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1 }}>Rolls</Typography>
          <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5, mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: slate[50] }}>
                  {['Roll no.', 'Total m', 'Used m', 'Rejected m', 'Balance'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem' }} align={h === 'Roll no.' ? 'left' : 'right'}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rolls.map((r, i) => {
                  const total = parseFloat(r.total_meters);
                  const used = parseFloat(r.used_meters);
                  const rejected = parseFloat(r.rejected_meters);
                  const balance = r.balance_meters != null
                    ? r.balance_meters
                    : (!Number.isNaN(total) && !Number.isNaN(used)
                      ? (total - used - (Number.isNaN(rejected) ? 0 : rejected)).toFixed(4)
                      : '—');
                  return (
                    <TableRow key={rollLabel(r) + i}>
                      <TableCell sx={{ fontWeight: 600 }}>{rollLabel(r)}</TableCell>
                      <TableCell align="right">{r.total_meters ?? '—'}</TableCell>
                      <TableCell align="right">{r.used_meters ?? '—'}</TableCell>
                      <TableCell align="right">{r.rejected_meters ?? '0'}</TableCell>
                      <TableCell align="right">{balance}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </>
      ) : null}

      {sizes.length > 0 ? (
        <>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1 }}>Cut by size</Typography>
          <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: slate[50] }}>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }} align="right">Cut pcs</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sizes.map((row) => (
                  <TableRow key={row.size}>
                    <TableCell>{row.size}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{row.qty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      ) : null}

      {detail.notes ? (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: slate[500] }}>Notes</Typography>
          <Typography sx={{ fontSize: '0.85rem', mt: 0.5 }}>{detail.notes}</Typography>
        </Box>
      ) : null}
    </>
  );
}
