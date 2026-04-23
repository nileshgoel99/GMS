import React from 'react';
import { TextField, IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { Delete } from '@mui/icons-material';

export const SIZE_KEYS = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

export const emptySizeRow = (color) => ({
  color,
  sizes: Object.fromEntries(SIZE_KEYS.map((k) => [k, 0])),
});

export const defaultSizeRows = () => [emptySizeRow('Orange'), emptySizeRow('Yellow')];

export const totalForSizes = (sizes) => SIZE_KEYS.reduce((s, k) => s + (parseInt(sizes[k], 10) || 0), 0);

export const normalizeSizeRowsFromApi = (raw) => {
  if (!Array.isArray(raw) || !raw.length) {
    return defaultSizeRows();
  }
  return raw.map((row) => {
    const base = Object.fromEntries(SIZE_KEYS.map((k) => [k, 0]));
    const incoming = row.sizes && typeof row.sizes === 'object' ? row.sizes : {};
    return {
      color: String(row.color || 'Colour').slice(0, 80),
      sizes: { ...base, ...incoming },
    };
  });
};

export const buildSizeBreakdownForPayload = (sizeRows) =>
  sizeRows.map((row) => {
    const sizes = { ...row.sizes };
    SIZE_KEYS.forEach((k) => {
      if (sizes[k] === '' || sizes[k] == null) sizes[k] = 0;
      else sizes[k] = parseInt(sizes[k], 10) || 0;
    });
    const t = totalForSizes(sizes);
    return { color: row.color, sizes, total: t };
  });

/**
 * Per-colour, per-size grid (mirrors Excel "Item / size details" blocks).
 */
export function IntentSizeColourGrid({ sizeRows, onChange }) {
  return (
    <Table size="small" sx={{ minWidth: 520 }}>
      <TableHead>
        <TableRow>
          <TableCell>Colour</TableCell>
          {SIZE_KEYS.map((k) => (
            <TableCell key={k} align="right" width={64}>
              {k}
            </TableCell>
          ))}
          <TableCell align="right" width={88}>
            Line total
          </TableCell>
          <TableCell width={40} />
        </TableRow>
      </TableHead>
      <TableBody>
        {sizeRows.map((row, i) => (
          <TableRow key={i}>
            <TableCell sx={{ pr: 1, verticalAlign: 'middle' }}>
              <TextField
                size="small"
                fullWidth
                value={row.color}
                onChange={(e) => {
                  const v = e.target.value;
                  const next = sizeRows.map((r, j) => (j === i ? { ...r, color: v } : r));
                  onChange(next);
                }}
                placeholder="e.g. Orange"
              />
            </TableCell>
            {SIZE_KEYS.map((k) => (
              <TableCell key={k} align="right" sx={{ p: 0.5, verticalAlign: 'middle' }}>
                <TextField
                  size="small"
                  type="number"
                  inputProps={{ min: 0, style: { textAlign: 'right' } }}
                  value={row.sizes[k] === undefined || row.sizes[k] === null ? '' : row.sizes[k]}
                  onChange={(e) => {
                    const n = e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0;
                    const next = sizeRows.map((r, j) => {
                      if (j !== i) return r;
                      return { ...r, sizes: { ...r.sizes, [k]: n } };
                    });
                    onChange(next);
                  }}
                />
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 800, color: 'primary.main', verticalAlign: 'middle' }}>
              {totalForSizes(row.sizes)}
            </TableCell>
            <TableCell>
              {sizeRows.length > 1 ? (
                <IconButton
                  size="small"
                  onClick={() => onChange(sizeRows.filter((_, j) => j !== i))}
                  aria-label="Remove colour row"
                >
                  <Delete fontSize="small" />
                </IconButton>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={SIZE_KEYS.length + 2} align="right" sx={{ fontWeight: 800, border: 0 }}>
            Grand total (all colours)
          </TableCell>
          <TableCell align="right" sx={{ fontWeight: 800, border: 0, color: 'primary.main' }}>
            {sizeRows.reduce((s, r) => s + totalForSizes(r.sizes), 0)}
          </TableCell>
          <TableCell sx={{ border: 0 }} />
        </TableRow>
      </TableBody>
    </Table>
  );
}
