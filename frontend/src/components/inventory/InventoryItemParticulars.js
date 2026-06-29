import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { slate } from '../../theme/appTheme';
import {
  extractTrimProperties,
  getItemDisplayName,
} from '../../utils/extractTrimProperties';

const PROPERTY_CARD_THEME = {
  bg: alpha('#2563eb', 0.1),
  border: alpha('#2563eb', 0.35),
  label: slate[600],
  value: slate[800],
};

/** Individual highlighted property cards — Color, Width, Washes, etc. */
export function PropertyCards({ item, properties: propsOverride, dense = false }) {
  const properties = propsOverride || extractTrimProperties(item || {});

  if (!properties.length) {
    return (
      <Typography variant="caption" color="text.secondary">
        —
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: dense ? 0.55 : 0.7 }}>
      {properties.map(({ label, value }) => (
        <Box
          key={`${label}-${value}`}
          sx={{
            px: dense ? 0.9 : 1.05,
            py: dense ? 0.5 : 0.6,
            borderRadius: 1.25,
            bgcolor: PROPERTY_CARD_THEME.bg,
            border: `1.5px solid ${PROPERTY_CARD_THEME.border}`,
            minWidth: 64,
            boxShadow: `0 1px 0 ${alpha(PROPERTY_CARD_THEME.border, 0.25)}`,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.58rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: PROPERTY_CARD_THEME.label,
              lineHeight: 1.15,
              display: 'block',
            }}
          >
            {label}
          </Typography>
          <Typography
            sx={{
              fontSize: dense ? '0.76rem' : '0.82rem',
              fontWeight: 800,
              color: PROPERTY_CARD_THEME.value,
              lineHeight: 1.3,
              wordBreak: 'break-word',
              mt: 0.15,
            }}
          >
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export { extractTrimProperties as getItemProperties };

/** Item name only (properties shown separately via PropertyCards). */
export default function InventoryItemParticulars({ item, compact = false }) {
  const name = getItemDisplayName(item);

  return (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: compact ? '0.78rem' : '0.84rem',
        lineHeight: 1.35,
        color: slate[800],
        wordBreak: 'break-word',
        py: compact ? 0.25 : 0.5,
      }}
    >
      {name}
    </Typography>
  );
}

/** Name + property cards stacked (dialogs). */
export function InventoryItemFull({ item, compact = false }) {
  const properties = extractTrimProperties(item);
  return (
    <Box>
      <InventoryItemParticulars item={item} compact={compact} />
      {properties.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <PropertyCards item={item} properties={properties} dense={compact} />
        </Box>
      )}
    </Box>
  );
}
