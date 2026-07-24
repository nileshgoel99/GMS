import React from 'react';
import { Box, Typography } from '@mui/material';
import { companyContactLines } from '../../utils/formatCompanyPhone';

/**
 * Closing footer for Proforma Invoice documents (screen + print content end).
 */
export default function PIDocumentFooter({ company, refLabel }) {
  if (!company) return null;

  const { phone, email } = companyContactLines(company);
  const contact = [
    phone && `Tel: ${phone}`,
    email && `Email: ${email}`,
    company.website,
  ].filter(Boolean).join('  ·  ');

  const address = [
    company.address_line1,
    company.address_line2,
    [company.city, company.region_state, company.postal_code].filter(Boolean).join(', '),
    company.country,
  ].filter(Boolean).join(', ');

  return (
    <Box
      className="pi-doc-footer"
      sx={{
        mt: 4,
        pt: 1.5,
        borderTop: '1.5px solid #000',
        fontFamily: '"Times New Roman", Times, serif',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontFamily: 'inherit', fontWeight: 700, fontSize: '8.5pt', color: '#000', lineHeight: 1.35 }}>
            {company.legal_name || 'J B INTERNATIONAL'}
          </Typography>
          {address && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '7.5pt', color: '#444', mt: 0.35, lineHeight: 1.4 }}>
              {address}
            </Typography>
          )}
          {contact && (
            <Typography sx={{ fontFamily: 'inherit', fontSize: '7.5pt', color: '#444', mt: 0.25, lineHeight: 1.4 }}>
              {contact}
            </Typography>
          )}
          {company.pdf_footer_note && (
            <Typography
              sx={{
                fontFamily: 'inherit',
                fontSize: '7pt',
                color: '#666',
                mt: 0.75,
                whiteSpace: 'pre-line',
                lineHeight: 1.4,
              }}
            >
              {company.pdf_footer_note}
            </Typography>
          )}
        </Box>
        {refLabel && (
          <Typography
            sx={{
              fontFamily: 'inherit',
              fontSize: '8pt',
              color: '#555',
              textAlign: 'right',
              flexShrink: 0,
              fontWeight: 600,
              lineHeight: 1.35,
              whiteSpace: 'pre-line',
            }}
          >
            {refLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
