import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableFooter from '@mui/material/TableFooter';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { alpha, useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import {
  lineValue,
  fmtSizePreview,
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
  backgroundImage: `linear-gradient(180deg, ${alpha(t.palette.common.white, 1)} 0%, ${alpha('#f8fafc', 1)} 100%)`,
  borderBottom: `1px solid ${alpha(t.palette.divider, 0.9)}`,
  display: 'flex',
  alignItems: 'center',
  gap: 1.25,
  flexWrap: 'wrap',
});

const segmentHeaderTitleProps = {
  component: 'span',
  variant: 'subtitle1',
  color: 'text.secondary',
  fontWeight: 600,
  letterSpacing: '-0.01em',
  flex: 1,
  minWidth: 200,
};

/** Canvas: distinct from cards so each line item reads as a “sheet” on a tray */
const segmentContentSx = (t) => ({
  p: { xs: 2, sm: 2.5 },
  bgcolor: '#e8edf3',
  backgroundImage: `
    linear-gradient(180deg, ${alpha('#cbd5e1', 0.25)} 0%, transparent 32%),
    linear-gradient(90deg, ${alpha(t.palette.common.white, 0.4)} 0%, transparent 50%)
  `,
  borderTop: `1px solid ${alpha(t.palette.divider, 0.85)}`,
});

const sectionChipSx = (accent) => ({
  fontWeight: 700,
  bgcolor: alpha(accent, 0.1),
  color: accent,
  border: `1px solid ${alpha(accent, 0.28)}`,
});

/** One shared look for the “on proforma” row — all single-line, same height, no jagged multiline. */
const copyFieldRowSx = {
  '& .MuiOutlinedInput-root': { borderRadius: 1.25, bgcolor: '#fff' },
  '& .MuiInputBase-input': { fontSize: '0.875rem' },
};

export default function PiLineItemsSection({
  lines = [],
  onAddLine,
  onRemoveLine,
  onLineChange,
  onMoveLine,
  onDuplicateLine,
  onAddSizeRow,
  onUpdateSizeRow,
  onRemoveSizeRow,
  onSyncQtyFromSizes,
  segmentId = 'pi-section-lines',
  accent = '#0ea5e9',
  sectionChip = 'Section 2',
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState({});
  const prevLenRef = useRef(lines.length);

  useEffect(() => {
    const n = lines.length;
    const prev = prevLenRef.current;
    if (n === 0) {
      setExpanded({});
      prevLenRef.current = n;
      return;
    }
    if (n < prev) {
      setExpanded(Object.fromEntries([...Array(n).keys()].map((i) => [i, n > 4 ? false : true])));
    } else if (n > prev) {
      setExpanded((e) => {
        const next = { ...e };
        for (let i = 0; i < n; i += 1) {
          if (next[i] === undefined) next[i] = n <= 4;
        }
        next[n - 1] = true;
        Object.keys(next).forEach((k) => {
          if (Number(k) >= n) delete next[Number(k)];
        });
        return next;
      });
    } else {
      setExpanded((e) => {
        const next = { ...e };
        for (let i = 0; i < n; i += 1) {
          if (next[i] === undefined) next[i] = n <= 4;
        }
        return next;
      });
    }
    prevLenRef.current = n;
  }, [lines.length]);

  const isExpanded = (i) => expanded[i] !== false;

  const setAll = (open) => {
    setExpanded(Object.fromEntries(lines.map((_, i) => [i, open])));
  };

  const toggle = (i) => {
    setExpanded((e) => ({ ...e, [i]: e[i] === false }));
  };

  return (
    <Box
      id={segmentId}
      data-pi-segment="lines"
      sx={{
        ...segmentPanel(theme, accent),
        scrollMarginTop: { xs: '100px', sm: '108px' },
      }}
    >
      <Box sx={segmentHeaderSx(theme)}>
        <Typography {...segmentHeaderTitleProps}>
          Line items — style, description &amp; size splits
        </Typography>
        <Chip size="small" label={sectionChip} sx={sectionChipSx(accent)} />
        <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center" sx={{ ml: 'auto' }}>
          <Button size="small" variant="outlined" onClick={onAddLine} startIcon={<AddIcon fontSize="small" />}>
            Add line
          </Button>
          <Button size="small" color="inherit" onClick={() => setAll(true)} startIcon={<UnfoldMoreIcon fontSize="small" />}>
            Expand all
          </Button>
          <Button size="small" color="inherit" onClick={() => setAll(false)} startIcon={<UnfoldLessIcon fontSize="small" />}>
            Collapse all
          </Button>
        </Stack>
      </Box>
      <Box sx={segmentContentSx(theme)}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block', maxWidth: 720, lineHeight: 1.5 }}>
          Compact row = style &amp; prices. Expand for description, quick S–3XL, and the size table. Many lines? Use{' '}
          <strong>Collapse all</strong>, then open only what you need.
        </Typography>
        <Stack spacing={1.5}>
          {lines.map((line, idx) => {
            const { quick, extra: extraFromSplit } = splitSizeBreakdown(line.size_breakdown);
            const preview = fmtSizePreview(line.size_breakdown, line.quantity_pcs);
            const open = isExpanded(idx);

            return (
              <Box
                key={idx}
                sx={{
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.common.black, 0.1)}`,
                  bgcolor: theme.palette.common.white,
                  boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.07)}`,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1,
                    p: 1.25,
                    pl: 1.5,
                    bgcolor: alpha('#f8fafc', 0.7),
                    borderBottom: open ? `1px solid ${alpha(theme.palette.divider, 0.9)}` : 'none',
                  }}
                >
                  <Chip size="small" label={`#${idx + 1}`} variant="outlined" sx={{ fontWeight: 700, borderRadius: 1 }} />
                  <TextField
                    size="small"
                    label="Style / item *"
                    value={line.item_name}
                    onChange={(e) => onLineChange(idx, { item_name: e.target.value })}
                    required
                    sx={{ flex: '1.2 1 200px', minWidth: 180 }}
                  />
                  <TextField
                    size="small"
                    label="FOB (USD) *"
                    value={line.unit_price_usd}
                    onChange={(e) => onLineChange(idx, { unit_price_usd: e.target.value })}
                    required
                    type="number"
                    inputProps={{ min: 0, step: '0.01' }}
                    InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
                    sx={{ width: 120 }}
                  />
                  <TextField
                    size="small"
                    label="Total pcs *"
                    value={line.quantity_pcs}
                    onChange={(e) => onLineChange(idx, { quantity_pcs: e.target.value })}
                    required
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    sx={{ width: 100 }}
                  />
                  <TextField
                    size="small"
                    label="Line (USD)"
                    value={lineValue(line.quantity_pcs, line.unit_price_usd) || '—'}
                    InputProps={{ readOnly: true }}
                    sx={{ width: 96 }}
                  />
                  <Tooltip title={preview.length > 60 ? preview : ''}>
                    <Chip
                      size="small"
                      label={preview.length > 40 ? `${preview.slice(0, 38)}…` : preview}
                      variant="outlined"
                      sx={{ maxWidth: 220, fontFamily: 'IBM Plex Mono, ui-monospace, monospace', fontSize: '0.7rem' }}
                    />
                  </Tooltip>
                  <Box sx={{ display: 'flex', alignItems: 'center', ml: { xs: 0, sm: 'auto' } }}>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton size="small" onClick={() => onMoveLine(idx, -1)} disabled={idx === 0} aria-label="Move line up">
                          <KeyboardArrowUpIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => onMoveLine(idx, 1)}
                          disabled={idx === lines.length - 1}
                          aria-label="Move line down"
                        >
                          <KeyboardArrowDownIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Duplicate this line (inserted below)">
                      <IconButton size="small" onClick={() => onDuplicateLine(idx)} aria-label="Duplicate line">
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <IconButton
                      onClick={() => toggle(idx)}
                      size="small"
                      aria-label={open ? 'Collapse line details' : 'Expand line details'}
                      sx={{ transform: open ? 'rotate(180deg)' : 'none' }}
                    >
                      <ExpandMoreIcon />
                    </IconButton>
                    <IconButton onClick={() => onRemoveLine(idx)} size="small" color="error" disabled={lines.length <= 1} aria-label="Remove line">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                <Collapse in={open} timeout="auto" unmountOnExit={false}>
                  <Box
                    sx={{
                      p: 1.5,
                      pt: 1.5,
                      bgcolor: '#fafbfc',
                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
                    }}
                  >
                    <Box
                      sx={{
                        borderRadius: 2,
                        overflow: 'hidden',
                        border: `1px solid ${alpha(theme.palette.divider, 0.95)}`,
                        bgcolor: alpha(theme.palette.common.white, 0.95),
                        boxShadow: `0 1px 2px ${alpha(theme.palette.common.black, 0.04)}`,
                      }}
                    >
                      <Box
                        sx={{
                          px: 1.5,
                          py: 0.9,
                          bgcolor: alpha(theme.palette.text.primary, 0.04),
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.06em' }}>
                          On the proforma
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          p: 1.5,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1.5,
                          bgcolor: alpha(theme.palette.grey[50], 0.5),
                        }}
                      >
                        <TextField
                          fullWidth
                          size="small"
                          label="Description"
                          value={line.description}
                          onChange={(e) => onLineChange(idx, { description: e.target.value })}
                          placeholder="Composition, branding, what prints on the PI…"
                          inputProps={{ 'aria-label': 'Description for proforma invoice' }}
                          variant="outlined"
                          sx={copyFieldRowSx}
                        />
                        <Grid container spacing={1.5} alignItems="stretch">
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Material (extra)"
                              value={line.material}
                              onChange={(e) => onLineChange(idx, { material: e.target.value })}
                              placeholder="e.g. 100% cotton"
                              inputProps={{ 'aria-label': 'Material' }}
                              variant="outlined"
                              sx={copyFieldRowSx}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              size="small"
                              label="Colour"
                              value={line.color}
                              onChange={(e) => onLineChange(idx, { color: e.target.value })}
                              placeholder="e.g. Navy"
                              inputProps={{ 'aria-label': 'Colour' }}
                              variant="outlined"
                              sx={copyFieldRowSx}
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    </Box>

                    <Box sx={{ mt: 1.75 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" letterSpacing="0.04em" textTransform="uppercase" sx={{ mb: 1 }}>
                        Quick S–3XL (pcs)
                        {extraFromSplit.length > 0 ? ' — use table below for duplicate / non-standard sizes' : ''}
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(6, 1fr)' },
                          gap: 1,
                          p: 1.5,
                          borderRadius: 1.5,
                          bgcolor: theme.palette.common.white,
                          border: `1px solid ${alpha(theme.palette.common.black, 0.08)}`,
                        }}
                      >
                        {STANDARD_SIZES.map((sz) => (
                          <TextField
                            key={sz}
                            size="small"
                            label={sz}
                            value={quick[sz] ?? ''}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^0-9]/g, '');
                              const { quick: q0, extra: ex0 } = splitSizeBreakdown(line.size_breakdown);
                              const nextQ = { ...q0, [sz]: v };
                              onLineChange(idx, { size_breakdown: mergeQuickAndExtra(nextQ, ex0) });
                            }}
                            type="number"
                            inputProps={{ min: 0, step: 1, inputMode: 'numeric' }}
                            placeholder="—"
                            sx={{ '& .MuiInputBase-input': { fontWeight: 600, textAlign: 'center' } }}
                          />
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ mt: 1.75 }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          Size &amp; quantity breakdown{sumSizeQty(line.size_breakdown) ? ` (Σ ${sumSizeQty(line.size_breakdown)} pcs)` : ''}
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                          <Button size="small" variant="outlined" onClick={() => onAddSizeRow(idx)} startIcon={<AddIcon fontSize="small" />}>
                            Add size row
                          </Button>
                          <Button size="small" variant="text" onClick={() => onSyncQtyFromSizes(idx)}>
                            Set total = sum of sizes
                          </Button>
                        </Stack>
                      </Box>
                      <TableContainer
                        component={Box}
                        sx={{
                          maxWidth: 640,
                          width: '100%',
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: `1px solid ${alpha(theme.palette.primary.dark, 0.22)}`,
                          boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.06)}`,
                          // Theme MuiOutlinedInput `input` uses fontWeight: 500; override so body cells are visibly bold
                          '& .MuiOutlinedInput-input, & .MuiInputBase-input': {
                            fontWeight: '700 !important',
                          },
                        }}
                      >
                        <Table
                          size="small"
                          stickyHeader
                          sx={{
                            borderCollapse: 'separate',
                            fontWeight: 700,
                            '& .MuiTableCell-root': {
                              borderColor: alpha(theme.palette.divider, 0.85),
                            },
                            '& .MuiTableHead-root .MuiTableCell-root': { fontWeight: 700 },
                            '& .MuiTableBody-root .MuiTableCell-root': { fontWeight: 700 },
                            '& .MuiTableFooter-root .MuiTableCell-root': { fontWeight: 800 },
                          }}
                        >
                          <TableHead>
                            <TableRow
                              sx={{
                                background: `linear-gradient(180deg, ${theme.palette.primary.dark} 0%, ${alpha(theme.palette.primary.main, 0.92)} 100%)`,
                              }}
                            >
                              <TableCell
                                scope="col"
                                sx={{
                                  color: theme.palette.primary.contrastText,
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  py: 1.1,
                                  borderBottom: 'none',
                                }}
                              >
                                Size
                              </TableCell>
                              <TableCell
                                align="right"
                                scope="col"
                                sx={{
                                  color: theme.palette.primary.contrastText,
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  py: 1.1,
                                  borderBottom: 'none',
                                }}
                              >
                                Qty (pcs)
                              </TableCell>
                              <TableCell
                                width={48}
                                padding="none"
                                align="center"
                                scope="col"
                                aria-label="Remove size row"
                                sx={{
                                  color: alpha(theme.palette.primary.contrastText, 0.7),
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  borderBottom: 'none',
                                }}
                              >
                                {'\u00a0'}
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(line.size_breakdown && line.size_breakdown.length
                              ? line.size_breakdown
                              : [{ size: '', qty: '' }]
                            ).map((srow, sidx) => {
                              const stripe = sidx % 2 === 0;
                              return (
                                <TableRow
                                  key={sidx}
                                  hover
                                  sx={{
                                    bgcolor: stripe ? alpha(theme.palette.primary.main, 0.04) : theme.palette.common.white,
                                    transition: 'background-color 0.12s ease',
                                    '&:hover': {
                                      bgcolor: alpha(theme.palette.info.main, 0.1),
                                    },
                                  }}
                                >
                                  <TableCell sx={{ py: 0.9, verticalAlign: 'middle' }}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      placeholder="5XL / OS"
                                      value={srow.size}
                                      onChange={(e) => onUpdateSizeRow(idx, sidx, { size: e.target.value })}
                                      variant="outlined"
                                      inputProps={{ style: { fontWeight: 700 } }}
                                      sx={{
                                        minWidth: 88,
                                        '& .MuiOutlinedInput-input, & .MuiInputBase-input': {
                                          fontWeight: '700 !important',
                                        },
                                        '& .MuiOutlinedInput-root': {
                                          bgcolor: theme.palette.common.white,
                                          fontSize: '0.875rem',
                                        },
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 0.9, verticalAlign: 'middle' }}>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={srow.qty}
                                      onChange={(e) => onUpdateSizeRow(idx, sidx, { qty: e.target.value.replace(/[^0-9]/g, '') })}
                                      inputProps={{ min: 0, step: 1, style: { fontWeight: 700 } }}
                                      variant="outlined"
                                      sx={{
                                        maxWidth: 120,
                                        ml: 'auto',
                                        display: 'block',
                                        '& .MuiOutlinedInput-input, & .MuiInputBase-input': {
                                          textAlign: 'right',
                                          fontFeatureSettings: '"tnum"',
                                          fontWeight: '700 !important',
                                        },
                                        '& .MuiOutlinedInput-root': {
                                          bgcolor: theme.palette.common.white,
                                          fontSize: '0.875rem',
                                        },
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell align="center" sx={{ py: 0.5, verticalAlign: 'middle' }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => onRemoveSizeRow(idx, sidx)}
                                      disabled={!line.size_breakdown?.length}
                                      sx={{
                                        color: theme.palette.error.main,
                                        opacity: 0.85,
                                        '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) },
                                        '&.Mui-disabled': { opacity: 0.35 },
                                      }}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                          <TableFooter>
                            <TableRow
                              sx={{
                                background: `linear-gradient(90deg, ${alpha(theme.palette.success.main, 0.12)} 0%, ${alpha(theme.palette.info.main, 0.1)} 100%)`,
                              }}
                            >
                              <TableCell
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.72rem',
                                  letterSpacing: '0.06em',
                                  textTransform: 'uppercase',
                                  color: theme.palette.text.secondary,
                                  borderTop: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                                  py: 1,
                                }}
                              >
                                Σ pieces (this line)
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.95rem',
                                  fontFamily: 'IBM Plex Mono, ui-monospace, monospace',
                                  color: theme.palette.success.dark,
                                  borderTop: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                                  py: 1,
                                }}
                              >
                                {sumSizeQty(line.size_breakdown)}
                              </TableCell>
                              <TableCell
                                align="center"
                                sx={{ borderTop: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`, py: 1 }}
                              />
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </TableContainer>
                    </Box>
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Stack>
        {lines.length === 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
            No line items. Click &quot;Add line&quot; to get started.
          </Typography>
        )}
      </Box>
    </Box>
  );
}
