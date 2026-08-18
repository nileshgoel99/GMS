import React from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
} from '@mui/material';
import { Login, OpenInNew } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { slate } from '../theme/appTheme';
import BrandLogo from './BrandLogo';

/** Public shell for shareable documentation — no login required. */
export default function PublicDocsLayout({ children, isAuthenticated = false }) {

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: alpha('#ffffff', 0.92),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${slate[200]}`,
          color: 'text.primary',
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: { xs: 60, sm: 68 } }}>
          <Box
            component={RouterLink}
            to="/documentation"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <BrandLogo variant="lockup" tone="light" size={36} showTagline tagline="Documentation" />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {isAuthenticated ? (
            <Button
              component={RouterLink}
              to="/"
              variant="contained"
              startIcon={<OpenInNew />}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Open app
            </Button>
          ) : (
            <Button
              component={RouterLink}
              to="/login"
              variant="contained"
              startIcon={<Login />}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Sign in
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 1.25, sm: 1.5 }, px: { xs: 2, sm: 3 } }}>
        {children}
      </Container>
    </Box>
  );
}
