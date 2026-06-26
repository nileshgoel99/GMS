import React, { useEffect, useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography, Chip, Divider, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, Grid, IconButton,
} from '@mui/material';
import { Close, Assignment } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { ordersAPI } from '../../services/api';
import { slate } from '../../theme/appTheme';
import { formatDateDisplay } from '../../utils/formatDate';

const STATUS_COLOR = { DRAFT: 'default', CONFIRMED: 'success' };

const formatTrimVariant = (row) => {
  const pv = row.property_values || {};
  const fromProps = Object.entries(pv)
    .filter(([, v]) => v != null && String(v).trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  if (fromProps) return fromProps;
  return [row.color_variant, row.size_variant].filter(Boolean).join(' / ') || '—';
};

const buildColorQty = (piLines) => {
  const map = {};
  (piLines || []).forEach((l) => {
    if (l.color) map[l.color] = (map[l.color] || 0) + (l.quantity_pcs || 0);
  });
  return map;
};

const val = (v) => (v != null && String(v).trim() !== '' ? v : '—');

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

const viewTableSx = {
  minWidth: 900,
  tableLayout: 'fixed',
  '& .MuiTableCell-root': {
    verticalAlign: 'middle !important',
  },
  '& .MuiTableBody-root .MuiTableRow-root': {
    height: 48,
  },
};

const InfoItem = ({ label, value }) => (
  <Box>
    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.25 }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>{val(value)}</Typography>
  </Box>
);

export default function IndentViewModal({ open, indentId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [indent, setIndent] = useState(null);
  const [trimsMap, setTrimsMap] = useState({});

  useEffect(() => {
    if (!open || !indentId) {
      setIndent(null);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const [indentRes, trimsRes] = await Promise.all([
          ordersAPI.getIndent(indentId),
          ordersAPI.getTrimsMaster(),
        ]);
        setIndent(indentRes.data);
        const trims = Array.isArray(trimsRes.data) ? trimsRes.data : trimsRes.data?.results || [];
        setTrimsMap(Object.fromEntries(trims.map((t) => [t.id, t])));
      } catch (e) {
        console.error(e);
        alert('Failed to load indent.');
        onClose?.();
      } finally {
        setLoading(false);
      }
    })();
  }, [open, indentId, onClose]);

  const activeLines = useMemo(() => {
    if (!indent?.pi_lines) return [];
    const ids = indent.selected_pi_line_ids || [];
    if (!ids.length) return indent.pi_lines;
    return indent.pi_lines.filter((l) => ids.includes(l.id));
  }, [indent]);

  const colorQty = useMemo(() => buildColorQty(activeLines), [activeLines]);
  const totalQty = useMemo(() => Object.values(colorQty).reduce((s, v) => s + v, 0), [colorQty]);

  const supplierForTrim = (row) => {
    const master = row.trim ? trimsMap[row.trim] : null;
    if (!master?.supplier_name) return '—';
    return master.supplier_country
      ? `${master.supplier_name} · ${master.supplier_country}`
      : master.supplier_name;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 2, maxHeight: '92vh' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2, px: 2.5 }}>
        <Assignment sx={{ color: 'primary.main' }} />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
            {indent ? `Indent ${indent.indent_number}` : 'Indent Details'}
          </Typography>
          {indent && (
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              PI {indent.pi_number} · {formatDateDisplay(indent.indent_date)}
            </Typography>
          )}
        </Box>
        {indent && (
          <Chip label={indent.status} size="small" color={STATUS_COLOR[indent.status] || 'default'}
            sx={{ fontWeight: 700, fontSize: '0.68rem', mr: 1 }} />
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

        {!loading && indent && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Summary */}
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}><InfoItem label="Indent No" value={indent.indent_number} /></Grid>
              <Grid item xs={6} sm={3}><InfoItem label="Date" value={formatDateDisplay(indent.indent_date)} /></Grid>
              <Grid item xs={6} sm={3}><InfoItem label="PI Reference" value={indent.pi_number} /></Grid>
              <Grid item xs={6} sm={3}><InfoItem label="Created By" value={indent.created_by_name} /></Grid>
            </Grid>

            {/* PI lines */}
            {activeLines.length > 0 && (
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 1, color: 'text.secondary' }}>
                  PI Line Items ({activeLines.length})
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {activeLines.map((line) => (
                    <Chip
                      key={line.id}
                      size="small"
                      label={`${line.item_name}${line.color ? ` · ${line.color}` : ''} · ${(line.quantity_pcs || 0).toLocaleString()} pcs`}
                      sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                    />
                  ))}
                </Box>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, mt: 1 }}>
                  Total quantity: {totalQty.toLocaleString()} pcs
                </Typography>
              </Box>
            )}

            {/* Carton & sign-off */}
            <Grid container spacing={2}>
              <Grid item xs={4} sm={2}><InfoItem label="Pcs/Box" value={indent.pcs_per_carton} /></Grid>
              <Grid item xs={4} sm={2}><InfoItem label="Carton PLY" value={indent.carton_ply} /></Grid>
              <Grid item xs={4} sm={3}>
                <InfoItem
                  label={`Dimensions (${indent.carton_dimensions_unit === 'INCH' ? 'Inches' : 'CMS'})`}
                  value={indent.carton_dimensions}
                />
              </Grid>
              <Grid item xs={12} sm={5}><InfoItem label="Prepared By" value={indent.prepared_by} /></Grid>
              <Grid item xs={6} sm={4}><InfoItem label="Received By" value={indent.received_by} /></Grid>
              <Grid item xs={6} sm={4}><InfoItem label="Approved By" value={indent.approved_by} /></Grid>
            </Grid>

            {/* Fabric */}
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', mb: 1 }}>Fabric</Typography>
              <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
                <Table size="small" sx={viewTableSx}>
                  <TableHead>
                    <TableRow>
                      {[
                        { h: 'Material', a: 'left', w: '22%' },
                        { h: 'Color', a: 'left', w: '10%' },
                        { h: 'GSM', a: 'right', w: '8%' },
                        { h: 'Roll W (CMS)', a: 'right', w: '10%' },
                        { h: 'Cons./pc', a: 'right', w: '10%' },
                        { h: 'Unit', a: 'center', w: '8%' },
                        { h: 'Total', a: 'right', w: '10%' },
                        { h: 'Remarks', a: 'left', w: '22%' },
                      ].map((col) => (
                        <TableCell key={col.h} sx={{ ...viewHeadSx, textAlign: col.a, width: col.w }}>{col.h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(indent.fabric_lines || []).filter((r) => r.material?.trim()).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ ...viewCellSx('center'), color: 'text.disabled' }}>No fabric rows</TableCell>
                      </TableRow>
                    ) : (
                      (indent.fabric_lines || []).filter((r) => r.material?.trim()).map((row, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={viewCellSx('left')}>{row.material}</TableCell>
                          <TableCell sx={viewCellSx('left')}>{val(row.color)}</TableCell>
                          <TableCell sx={viewCellSx('right')}>{row.gsm ? `${row.gsm} GSM` : '—'}</TableCell>
                          <TableCell sx={viewCellSx('right')}>{row.roll_width ? `${row.roll_width} CMS` : '—'}</TableCell>
                          <TableCell sx={viewCellSx('right')}>{val(row.consumption_per_pc)}</TableCell>
                          <TableCell sx={{ ...viewCellSx('center'), fontWeight: 600 }}>{val(row.unit)}</TableCell>
                          <TableCell sx={{ ...viewCellSx('right'), fontWeight: 700 }}>{val(row.total_consumption)}</TableCell>
                          <TableCell sx={viewCellSx('left')}>{val(row.remarks)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>

            {/* Trims */}
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', mb: 1 }}>Trims & Accessories</Typography>
              <Box sx={{ overflowX: 'auto', border: `1px solid ${slate[200]}`, borderRadius: 1.5 }}>
                <Table size="small" sx={{ ...viewTableSx, minWidth: 1000 }}>
                  <TableHead>
                    <TableRow>
                      {[
                        { h: 'Trim Name', a: 'left', w: '20%' },
                        { h: 'Properties', a: 'left', w: '18%' },
                        { h: 'Supplier', a: 'left', w: '14%' },
                        { h: 'Cons./pc', a: 'right', w: '9%' },
                        { h: 'Unit', a: 'center', w: '7%' },
                        { h: 'Total', a: 'right', w: '9%' },
                        { h: 'Tot. Unit', a: 'center', w: '8%' },
                        { h: 'Remarks', a: 'left', w: '15%' },
                      ].map((col) => (
                        <TableCell key={col.h} sx={{ ...viewHeadSx, textAlign: col.a, width: col.w }}>{col.h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(indent.trim_lines || []).filter((r) => r.trim_name?.trim()).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ ...viewCellSx('center'), color: 'text.disabled' }}>No trim rows</TableCell>
                      </TableRow>
                    ) : (
                      (indent.trim_lines || []).filter((r) => r.trim_name?.trim()).map((row, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={viewCellSx('left')}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{row.trim_name}</Typography>
                            {row.category && (
                              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{row.category}</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={viewCellSx('left')}>{formatTrimVariant(row)}</TableCell>
                          <TableCell sx={viewCellSx('left')}>{supplierForTrim(row)}</TableCell>
                          <TableCell sx={viewCellSx('right')}>{val(row.consumption_per_pc)}</TableCell>
                          <TableCell sx={{ ...viewCellSx('center'), fontWeight: 600 }}>{val(row.unit)}</TableCell>
                          <TableCell sx={{ ...viewCellSx('right'), fontWeight: 700 }}>{val(row.total_consumption)}</TableCell>
                          <TableCell sx={{ ...viewCellSx('center'), fontWeight: 600 }}>{val(row.total_unit || row.unit)}</TableCell>
                          <TableCell sx={viewCellSx('left')}>{val(row.remarks)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Box>
            </Box>

            {indent.notes && (
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.5, color: 'text.secondary' }}>Notes</Typography>
                <Typography sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap' }}>{indent.notes}</Typography>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2 }}>
        <Button onClick={onClose} sx={{ fontWeight: 700, textTransform: 'none' }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
