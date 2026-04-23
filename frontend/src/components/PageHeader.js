import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Page header: kicker, display title, subtitle, optional actions — generous spacing for SaaS-style layouts.
 */
const PageHeader = ({ kicker, title, subtitle, actions }) => (
  <Box
    sx={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: { xs: 2, sm: 2.5 },
      mb: { xs: 3, sm: 3.5, md: 4 },
      pt: { xs: 0.5, md: 0 },
    }}
  >
    <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
      {kicker ? (
        <Typography
          variant="overline"
          color="primary"
          sx={{
            display: 'block',
            mb: 0.75,
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          {kicker}
        </Typography>
      ) : null}
      <Box sx={{ position: 'relative' }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: 'text.primary',
            lineHeight: 1.25,
          }}
        >
          {title}
        </Typography>
        <Box
          sx={{
            mt: 1,
            height: 3,
            width: 72,
            borderRadius: '8px',
            bgcolor: 'primary.main',
            opacity: 0.95,
          }}
        />
      </Box>
      {subtitle ? (
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{
            mt: { xs: 1, sm: 1.25 },
            maxWidth: 760,
            fontWeight: 500,
            lineHeight: 1.65,
          }}
        >
          {subtitle}
        </Typography>
      ) : null}
    </Box>
    {actions ? (
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.25,
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {actions}
      </Box>
    ) : null}
  </Box>
);

export default PageHeader;
