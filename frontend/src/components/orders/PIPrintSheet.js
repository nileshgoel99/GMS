import React from 'react';
import { Box } from '@mui/material';

/**
 * PI body in normal block flow so the browser can break on the space left
 * on the page. The page header and footer are margin text from the print
 * stylesheet, so they stay at the top and foot of each page.
 */
export default function PIPrintSheet({ children }) {
  return (
    <Box
      className="pi-print-sheet"
      sx={{
        width: '100%',
        fontFamily: '"Times New Roman", Times, serif',
      }}
    >
      {children}
    </Box>
  );
}
