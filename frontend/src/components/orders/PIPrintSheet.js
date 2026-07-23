import React from 'react';
import { Box } from '@mui/material';

/**
 * Wraps PI content in a print sheet table.
 * The tfoot repeats at the bottom of every printed page and consumes layout
 * space (unlike position:fixed), so it cannot cover Value / Date / etc.
 */
export default function PIPrintSheet({
  companyName = 'J B INTERNATIONAL',
  centerText = 'PROFORMA INVOICE',
  children,
}) {
  return (
    <Box
      component="table"
      className="pi-print-sheet"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontFamily: '"Times New Roman", Times, serif',
      }}
    >
      {/* tfoot first is valid HTML and required for some print engines to repeat it */}
      <Box component="tfoot" className="pi-print-sheet-foot" sx={{ display: 'table-footer-group' }}>
        <Box component="tr">
          <Box
            component="td"
            sx={{
              border: 'none',
              padding: 0,
              verticalAlign: 'bottom',
            }}
          >
            <Box
              className="pi-sheet-footer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.5,
                pt: 1,
                mt: 1,
                borderTop: '0.6pt solid #888',
                fontSize: '8pt',
                lineHeight: 1.2,
                color: '#333',
              }}
            >
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
        </Box>
      </Box>
      <Box component="tbody" className="pi-print-sheet-body">
        <Box component="tr">
          <Box
            component="td"
            sx={{
              border: 'none',
              padding: 0,
              verticalAlign: 'top',
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
