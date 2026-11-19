import React from 'react';
import { Box } from '@mui/material';

/**
 * PI body in normal block flow so the browser can break on the space left
 * on the page. Header, continuation line, and footer live in the page
 * margin (see documentPrint.js) and are hidden on screen.
 */
export default function PIPrintSheet({
  companyName = 'J B INTERNATIONAL',
  centerText = 'PROFORMA INVOICE',
  children,
}) {
  return (
    <Box
      className="pi-print-sheet"
      sx={{
        width: '100%',
        fontFamily: '"Times New Roman", Times, serif',
      }}
    >
      <Box className="doc-run-header">{companyName} · {centerText}</Box>
      <Box className="doc-run-continued">Continued from last page</Box>
      {children}
      <Box className="doc-run-footer pi-sheet-footer">
        <Box
          component="span"
          className="pi-sf-left"
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {companyName}
        </Box>
        <Box
          component="span"
          className="pi-sf-center"
          sx={{
            flex: '0 1 auto',
            maxWidth: '55%',
            color: '#555',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
          }}
        >
          {centerText}
        </Box>
      </Box>
    </Box>
  );
}
