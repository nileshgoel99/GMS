import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

const ACCENTS = ['primary', 'success', 'warning', 'info', 'secondary', 'error'];

const StatCard = ({ title, value, subtitle, icon, accent = 'primary' }) => {
  const key = ACCENTS.includes(accent) ? accent : 'primary';

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: (theme) => theme.shadows[1],
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: (theme) => theme.shadows[2],
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: (theme) => theme.palette[key].main,
        },
      }}
    >
      <CardContent sx={{ p: 2.25, pl: 2.5 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: '0.06em', fontSize: '0.6875rem' }}
            >
              {title}
            </Typography>
            <Typography
              variant="h4"
              className="font-numeric"
              sx={{
                fontWeight: 600,
                letterSpacing: '-0.02em',
                mt: 0.75,
                lineHeight: 1.15,
                color: 'text.primary',
              }}
            >
              {value}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 400 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              bgcolor: (theme) => alpha(theme.palette[key].main, 0.08),
              color: (theme) => theme.palette[key].dark,
              border: '1px solid',
              borderColor: (theme) => alpha(theme.palette[key].main, 0.2),
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default StatCard;
