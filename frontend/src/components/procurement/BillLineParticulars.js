import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { slate } from '../../theme/appTheme';
import { parseParticulars } from '../../utils/parseParticulars';

export { parseParticulars as parseBillParticulars };

/** Expand "Color: X · Width: Y" (or newline-separated) into display lines. */
const expandPropertyLines = (lines) => {
  const out = [];
  (lines || []).forEach((line) => {
    const trimmed = (line || '').trim();
    if (!trimmed || trimmed.startsWith('_pi_fabric_key:')) return;
    if (trimmed.includes(' · ')) {
      trimmed.split(/\s·\s/).map((p) => p.trim()).filter(Boolean).forEach((p) => out.push(p));
    } else {
      out.push(trimmed);
    }
  });
  return out;
};

/** Read-only trim / item display for purchase bill / PO lines. */
export default function BillLineParticulars({ row }) {
  const parsed = parseParticulars(row.particulars);
  const name = (row.trim_name || parsed.name || row.particulars || '').trim() || '—';
  const rawProps = parsed.properties.length
    ? parsed.properties
    : (parsed.name && row.trim_name && parsed.name !== row.trim_name ? [parsed.name] : []);
  const properties = expandPropertyLines(rawProps);

  return (
    <Box sx={{ py: 0.5, pr: 1 }}>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '0.84rem',
          lineHeight: 1.35,
          color: slate[800],
          wordBreak: 'break-word',
        }}
      >
        {name}
      </Typography>
      {properties.length > 0 && (
        <Box
          sx={{
            mt: 0.75,
            px: 0.85,
            py: 0.55,
            borderRadius: 1,
            width: 'fit-content',
            maxWidth: 320,
            bgcolor: alpha(slate[900], 0.03),
            border: `1px solid ${alpha(slate[900], 0.08)}`,
          }}
        >
          {properties.map((line) => (
            <Typography
              key={line}
              sx={{
                fontSize: '0.72rem',
                color: slate[600],
                lineHeight: 1.45,
                fontWeight: 500,
                wordBreak: 'break-word',
              }}
            >
              {line}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
