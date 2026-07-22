import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { hasModuleAccess, moduleForPath, getHomePath } from '../config/permissions';

const LoadingScreen = () => {
  const theme = useTheme();
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
};

const AccessDenied = ({ homePath = '/' }) => (
  <Box sx={{ p: 4, textAlign: 'center' }}>
    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Access denied</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
      Your role does not have permission to view this page.
    </Typography>
    <Button variant="contained" href={homePath} sx={{ textTransform: 'none', fontWeight: 700 }}>
      Go to dashboard
    </Button>
  </Box>
);

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.module] — optional explicit module; otherwise derived from URL
 * @param {boolean} [props.adminOnly] — require admin role
 */
const PrivateRoute = ({ children, module: moduleProp, adminOnly = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const homePath = getHomePath(user);
  const isAdminUser = Boolean(user?.is_admin || user?.role === 'ADMIN');

  if (adminOnly && !isAdminUser) {
    if (location.pathname === homePath) {
      return <AccessDenied homePath={homePath} />;
    }
    return <Navigate to={homePath} replace />;
  }

  const module = moduleProp || moduleForPath(location.pathname);

  if (module && !hasModuleAccess(user, module)) {
    if (location.pathname === homePath) {
      return <AccessDenied homePath={homePath} />;
    }
    return <Navigate to={homePath} replace />;
  }

  return children;
};

export default PrivateRoute;
