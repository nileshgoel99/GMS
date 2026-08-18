import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import markSrc from '../assets/weavecore-mark.png';
import { slate } from '../theme/appTheme';

export const WEAVECORE_MARK = markSrc;

const CORE_TEAL = '#5ec4b6';
const CORE_TEAL_DEEP = '#0f766e';

/**
 * WeaveCore brand lockup that follows page chrome instead of the dark artwork plate.
 *   variant: mark | lockup
 *   tone:    light (landing/docs) | dark (sidebar/login)
 */
export default function BrandLogo({
  variant = 'lockup',
  tone = 'light',
  size = 40,
  showTagline = false,
  tagline = 'From order to production',
  alt = 'WeaveCore',
  sx,
}) {
  const dark = tone === 'dark';
  const nameColor = dark ? '#ffffff' : slate[950];
  const coreColor = dark ? CORE_TEAL : CORE_TEAL_DEEP;
  const tagColor = dark ? alpha('#ffffff', 0.55) : slate[500];
  const markOnly = variant === 'mark';

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.35}
      sx={{ minWidth: 0, ...sx }}
    >
      <Box
        sx={{
          width: size,
          height: size,
          flexShrink: 0,
          borderRadius: `${Math.round(size * 0.28)}px`,
          overflow: 'hidden',
          bgcolor: '#152826',
          boxShadow: dark
            ? `0 0 0 1px ${alpha('#fff', 0.16)}`
            : `0 6px 16px ${alpha('#142422', 0.18)}, 0 0 0 1px ${alpha('#142422', 0.08)}`,
        }}
      >
        <Box
          component="img"
          src={markSrc}
          alt={markOnly ? alt : ''}
          draggable={false}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            userSelect: 'none',
          }}
        />
      </Box>

      {!markOnly ? (
        <Box sx={{ minWidth: 0, lineHeight: 1 }}>
          <Typography
            component="span"
            sx={{
              display: 'block',
              fontWeight: 800,
              letterSpacing: '-0.045em',
              lineHeight: 1.05,
              fontSize: size >= 44 ? '1.35rem' : size >= 38 ? '1.12rem' : '1.02rem',
              color: nameColor,
            }}
          >
            Weave
            <Box component="span" sx={{ color: coreColor, fontWeight: 700 }}>
              Core
            </Box>
          </Typography>
          {showTagline ? (
            <Typography
              component="span"
              sx={{
                display: 'block',
                mt: 0.4,
                fontSize: size >= 44 ? '0.58rem' : '0.52rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: tagColor,
                whiteSpace: 'nowrap',
              }}
            >
              {tagline}
            </Typography>
          ) : null}
        </Box>
      ) : null}
    </Stack>
  );
}
