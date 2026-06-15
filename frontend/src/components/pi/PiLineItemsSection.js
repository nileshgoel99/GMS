import { useState } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  lineValue,
  sumSizeQty,
  STANDARD_SIZES,
  splitSizeBreakdown,
  mergeQuickAndExtra,
} from '../../utils/piLineHelpers';

const segmentPanel = (theme, accent) => ({
  position: 'relative',
  zIndex: 1,
  mt: 3,
  borderRadius: '14px',
  bgcolor: theme.palette.common.white,
  border: `1px solid ${alpha(theme.palette.common.black, 0.1)}`,
  borderTop: `4px solid ${accent}`,
  boxShadow: `0 4px 24px ${alpha(theme.palette.common.black, 0.06)}`,
  overflow: 'hidden',
});

const segmentHeaderSx = (t) => ({
  px: 2,
  py: 1.5,
  bgcolor: t.palette.common.white,
  borderBottom: `1px solid ${alpha(t.palette.divider, 0.9)}`,
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  flexWrap: 'wrap',
});

const segmentContentSx = (t) => ({
  p: { xs: 2, sm: 2.5 },
  bgcolor: '#f1f5f9',
  borderTop: `1px solid ${alpha(t.palette.divider, 0.85)}`,
});

const sectionChipSx = (accent) => ({
  fontWeight: 700,
  bgcolor: alpha(accent, 0.1),
  color: accent,
  border: `1px solid ${alpha(accent, 0.28)}`,
});

const compactField = {
  '& .MuiOutlinedInput-root': { borderRadius: 1.25, bgcolor: '#fff' },
  '& .MuiInputBase-input': { fontSize: '0.875rem', fontWeight: 600 },
};

function OptionalBlock({ title, open, onToggle, children }) {
  return (
    <Box sx={{ mt: 1.25 }}>
      <Button
        size="small"
        color="inherit"
        onClick={onToggle}
        endIcon={
          <ExpandMoreIcon
            fontSize="small"
            sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        }
        sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary', px: 0, minWidth: 0 }}
      >
        {title}
      </Button>
      <Collapse in={open}>{children}</Collapse>
    </Box>
  );
}

export default function PiLineItemsSection({
  lines = [],
  onAddLine,
  onRemoveLine,
  onLineChange,
  onDuplicateLine,
  segmentId = 'pi-section-lines',
  accent = '#0ea5e9',
  sectionChip = 'Section 2',
}) {
  const theme = useTheme();
  const [notesOpen, setNotesOpen] = useState({});
  const [extraOpen, setExtraOpen] = useState({});

  const toggleNotes = (i) => setNotesOpen((s) => ({ ...s, [i]: !s[i] }));
  const toggleExtra = (i) => setExtraOpen((s) => ({ ...s, [i]: !s[i] }));

  const setQuickSize = (idx, line, sz, raw) => {
    const v = raw.replace(/[^0-9]/g, '');
    const { quick: q0, extra: ex0 } = splitSizeBreakdown(line.size_breakdown);
    onLineChange(idx, { size_breakdown: mergeQuickAndExtra({ ...q0, [sz]: v }, ex0) });
  };

  const updateExtraSize = (idx, line, extraIndex, patch) => {
    const { quick, extra } = splitSizeBreakdown(line.size_breakdown);
    const list = extra.length ? [...extra] : [{ size: '', qty: '' }];
    list[extraIndex] = { ...list[extraIndex], ...patch };
    onLineChange(idx, { size_breakdown: mergeQuickAndExtra(quick, list) });
  };

  const removeExtraSize = (idx, line, extraIndex) => {
    const { quick, extra } = splitSizeBreakdown(line.size_breakdown);
    onLineChange(idx, { size_breakdown: mergeQuickAndExtra(quick, extra.filter((_, i) => i !== extraIndex)) });
  };

  const addExtraSize = (idx, line) => {
    const { quick, extra } = splitSizeBreakdown(line.size_breakdown);
    onLineChange(idx, { size_breakdown: mergeQuickAndExtra(quick, [...extra, { size: '', qty: '' }]) });
    setExtraOpen((s) => ({ ...s, [idx]: true }));
  };

  return (
    <Box id={segmentId} data-pi-segment="lines" sx={{ ...segmentPanel(theme, accent), scrollMarginTop: { xs: '100px', sm: '108px' } }}>
      <Box sx={segmentHeaderSx(theme)}>
        <Typography component="span" variant="subtitle1" color="text.secondary" fontWeight={600} sx={{ flex: 1, minWidth: 160 }}>
          Line items
        </Typography>
        <Chip size="small" label={sectionChip} sx={sectionChipSx(accent)} />
        <Button size="small" variant="contained" onClick={onAddLine} startIcon={<AddIcon fontSize="small" />}>
          Add line
        </Button>
      </Box>

      <Box sx={segmentContentSx(theme)}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 640, lineHeight: 1.55 }}>
          Enter <strong>style</strong>, <strong>price</strong>, and <strong>quantities per size</strong>. Total pieces update automatically.
        </Typography>

        <Stack spacing={1.5}>
          {lines.map((line, idx) => {
            const { quick, extra: extraRows } = splitSizeBreakdown(line.size_breakdown);
            const sizeSum = sumSizeQty(line.size_breakdown);
            const lineTotal = lineValue(line.quantity_pcs, line.unit_price_usd);
            const showNotes = notesOpen[idx] || !!(line.description || line.material);
            const showExtra = extraOpen[idx] || extraRows.length > 0;
            const extraList = extraRows.length ? extraRows : [{ size: '', qty: '' }];

            return (
              <Box
                key={idx}
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.common.black, 0.1)}`,
                  bgcolor: '#fff',
                  boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
                  overflow: 'hidden',
                }}
              >
                <Box sx={{ p: 1.5, pb: 1.25 }}>
                  <Stack direction="row" flexWrap="wrap" alignItems="flex-start" gap={1.25} sx={{ mb: 1.25 }}>
                    <Chip size="small" label={`Line ${idx + 1}`} sx={{ fontWeight: 700, mt: 0.5 }} />
                    <TextField
                      size="small"
                      label="Style / item"
                      required
                      value={line.item_name}
                      onChange={(e) => onLineChange(idx, { item_name: e.target.value })}
                      placeholder="e.g. Hoodie style A"
                      sx={{ flex: '1 1 220px', minWidth: 180, ...compactField }}
                    />
                    <TextField
                      size="small"
                      label="Colour"
                      value={line.color}
                      onChange={(e) => onLineChange(idx, { color: e.target.value })}
                      placeholder="Navy"
                      sx={{ flex: '0 1 120px', minWidth: 100, ...compactField }}
                    />
                    <TextField
                      size="small"
                      label="FOB (USD)"
                      required
                      value={line.unit_price_usd}
                      onChange={(e) => onLineChange(idx, { unit_price_usd: e.target.value })}
                      type="number"
                      inputProps={{ min: 0, step: '0.01' }}
                      InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                      sx={{ flex: '0 1 110px', minWidth: 100, ...compactField }}
                    />
                    <Stack direction="row" spacing={0.25} sx={{ ml: { sm: 'auto' }, mt: { xs: 0, sm: 0.5 } }}>
                      <Tooltip title="Duplicate line">
                        <IconButton size="small" onClick={() => onDuplicateLine(idx)} aria-label="Duplicate">
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove line">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => onRemoveLine(idx)}
                            disabled={lines.length <= 1}
                            aria-label="Remove"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>

                  <Box
                    sx={{
                      borderRadius: 1.5,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      overflow: 'hidden',
                      bgcolor: alpha(theme.palette.primary.main, 0.03),
                    }}
                  >
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${STANDARD_SIZES.length}, 1fr)`,
                        gap: 0,
                        borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                        bgcolor: alpha(theme.palette.primary.dark, 0.08),
                      }}
                    >
                      {STANDARD_SIZES.map((sz) => (
                        <Typography
                          key={sz}
                          variant="caption"
                          align="center"
                          sx={{ py: 0.75, fontWeight: 800, letterSpacing: '0.04em', color: 'primary.dark' }}
                        >
                          {sz}
                        </Typography>
                      ))}
                    </Box>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${STANDARD_SIZES.length}, 1fr)`,
                        gap: 0.5,
                        p: 0.75,
                      }}
                    >
                      {STANDARD_SIZES.map((sz) => (
                        <TextField
                          key={sz}
                          size="small"
                          value={quick[sz] ?? ''}
                          onChange={(e) => setQuickSize(idx, line, sz, e.target.value)}
                          type="number"
                          inputProps={{ min: 0, step: 1, inputMode: 'numeric', 'aria-label': `${sz} quantity` }}
                          placeholder="0"
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 1 },
                            '& .MuiInputBase-input': { textAlign: 'center', fontWeight: 700, py: 0.85, px: 0.5 },
                          }}
                        />
                      ))}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      mt: 1.25,
                      px: 1.25,
                      py: 0.85,
                      borderRadius: 1.25,
                      bgcolor: alpha(theme.palette.success.main, 0.08),
                      border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    {sizeSum > 0 ? (
                      <Typography variant="body2" fontWeight={700} color="success.dark">
                        Total: {sizeSum} pcs
                        {lineTotal ? ` · $${lineTotal}` : ''}
                      </Typography>
                    ) : (
                      <TextField
                        size="small"
                        label="Total pcs (no size split)"
                        value={line.quantity_pcs}
                        onChange={(e) => onLineChange(idx, { quantity_pcs: e.target.value.replace(/[^0-9]/g, '') })}
                        type="number"
                        inputProps={{ min: 0, step: 1 }}
                        sx={{ width: 160, ...compactField }}
                      />
                    )}
                    {sizeSum > 0 && lineTotal && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                        {line.unit_price_usd ? `@ $${line.unit_price_usd}` : ''}
                      </Typography>
                    )}
                  </Box>

                  <OptionalBlock title="Notes for PI (optional)" open={showNotes} onToggle={() => toggleNotes(idx)}>
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      maxRows={4}
                      value={line.description || line.material || ''}
                      onChange={(e) => onLineChange(idx, { description: e.target.value, material: '' })}
                      placeholder="Fabric, composition, branding — appears on the proforma if filled"
                      sx={{ mt: 1, ...compactField }}
                    />
                  </OptionalBlock>

                  <OptionalBlock
                    title={extraRows.length ? `Other sizes (${extraRows.length})` : 'Other sizes (5XL, OS… — optional)'}
                    open={showExtra}
                    onToggle={() => toggleExtra(idx)}
                  >
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {extraList.map((row, sidx) => (
                        <Stack key={sidx} direction="row" spacing={1} alignItems="center">
                          <TextField
                            size="small"
                            label="Size"
                            value={row.size}
                            onChange={(e) => updateExtraSize(idx, line, sidx, { size: e.target.value })}
                            placeholder="5XL / OS"
                            sx={{ flex: 1, ...compactField }}
                          />
                          <TextField
                            size="small"
                            label="Qty"
                            value={row.qty}
                            onChange={(e) => updateExtraSize(idx, line, sidx, { qty: e.target.value.replace(/[^0-9]/g, '') })}
                            type="number"
                            inputProps={{ min: 0, step: 1 }}
                            sx={{ width: 90, ...compactField }}
                          />
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeExtraSize(idx, line, sidx)}
                            disabled={extraRows.length === 0}
                            aria-label="Remove size"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ))}
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon fontSize="small" />}
                        onClick={() => addExtraSize(idx, line)}
                        sx={{ alignSelf: 'flex-start' }}
                      >
                        Add other size
                      </Button>
                    </Stack>
                  </OptionalBlock>
                </Box>
              </Box>
            );
          })}
        </Stack>

        {lines.length === 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
            No line items. Click &quot;Add line&quot; to start.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
