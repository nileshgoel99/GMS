import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        sx={{
          background: `radial-gradient(1200px 600px at 20% 0%, ${alpha(theme.palette.primary.main, 0.14)}, transparent), ${theme.palette.background.default}`,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '12px',
            display: 'grid',
            placeItems: 'center',
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontWeight: 700,
            color: '#fff',
            mb: 2,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}`,
          }}
        >
          G
        </Box>
        <CircularProgress size={28} thickness={5} sx={{ color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontWeight: 600 }}>
          Loading workspace…
        </Typography>
      </Box>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
