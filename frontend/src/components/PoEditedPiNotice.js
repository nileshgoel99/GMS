import React from 'react';
import { Alert } from '@mui/material';

export default function PoEditedPiNotice({ show, sx }) {
  if (!show) return null;
  return (
    <Alert
      severity="warning"
      sx={{
        py: 0.5,
        px: 1.5,
        borderRadius: 1.5,
        fontSize: '0.78rem',
        fontWeight: 600,
        alignItems: 'center',
        '& .MuiAlert-message': { py: 0.25 },
        ...sx,
      }}
    >
      This PO was edited. Regenerate the PI to apply the changes.
    </Alert>
  );
}
