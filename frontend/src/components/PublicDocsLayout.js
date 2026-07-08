import React from 'react';
import {
  AppBar,
  Box,
  Button,
  Container,
  Toolbar,
  Typography,
} from '@mui/material';
import { Login, OpenInNew } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';
import { slate } from '../theme/appTheme';

/** Public shell for shareable documentation — no login required. */
export default function PublicDocsLayout({ children, isAuthenticated = false }) {
  const theme = useTheme();

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
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                fontWeight: 700,
                color: '#fff',
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              G
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                GMS Documentation
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Fabricon · Garment production guides
              </Typography>
            </Box>
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

      <Container maxWidth="xl" sx={{ py: { xs: 2, sm: 3, md: 4 } }}>
        {children}
      </Container>
    </Box>
  );
}
