import React from 'react';
import { Paper } from '@mui/material';

const DataGridShell = ({ children, sx }) => (
  <Paper
    elevation={1}
    sx={{
      borderRadius: '12px',
      overflow: 'hidden',
      bgcolor: 'background.paper',
      transition: 'box-shadow 0.25s cubic-bezier(0.2, 0, 0, 1)',
      '&:hover': {
        boxShadow: (theme) => theme.shadows[4],
      },
      ...sx,
    }}
  >
    {children}
  </Paper>
);

export default DataGridShell;
