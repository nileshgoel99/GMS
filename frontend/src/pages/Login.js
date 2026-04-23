import React, { useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  Grid,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Button,
  Paper,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { navChrome, slate, warm } from '../theme/appTheme';

const BRAND_NAME = 'Fabricon';
/** Short mark used in the logo tile */
const BRAND_MARK = 'F';
const BRAND_TAGLINE = 'From order to production—one connected operation.';

const highlightConfig = (theme) => [
  {
    text: 'PI-to-production traceability across every order',
    Icon: LocalShippingIcon,
    bg: alpha(theme.palette.primary.main, 0.2),
    border: alpha(theme.palette.primary.light, 0.45),
  },
  {
    text: 'Inventory, procurement, and shop-floor releases in one system',
    Icon: Inventory2Icon,
    bg: alpha(theme.palette.info.main, 0.18),
    border: alpha(theme.palette.info.main, 0.4),
  },
  {
    text: 'Clear workflows for large manufacturing teams and partner visibility',
    Icon: HandshakeIcon,
    bg: alpha('#f59e0b', 0.12),
    border: alpha('#f59e0b', 0.35),
  },
];

const Login = () => {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const highlights = highlightConfig(theme);

  const pageBg = `
    radial-gradient(ellipse 100% 80% at 0% 0%, ${alpha(theme.palette.primary.main, 0.12)} 0%, transparent 55%),
    radial-gradient(ellipse 80% 60% at 100% 10%, ${alpha(theme.palette.info.main, 0.1)} 0%, transparent 50%),
    radial-gradient(ellipse 60% 50% at 50% 100%, ${alpha('#f59e0b', 0.06)} 0%, transparent 45%),
    linear-gradient(180deg, ${warm.canvas} 0%, ${slate[50]} 100%)
  `;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await login(username, password);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <Grid container component="main" sx={{ minHeight: '100vh', background: pageBg }}>
      <Grid
        item
        xs={12}
        md={6}
        sx={{
          display: { xs: 'none', md: 'flex' },
          position: 'relative',
          color: '#fff',
          p: { md: 5, lg: 7 },
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          background: navChrome.gradient,
          boxShadow: `4px 0 32px ${alpha(slate[900], 0.2)}, inset 4px 0 0 0 ${navChrome.rail}`,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: navChrome.sheen,
            pointerEvents: 'none',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.4,
            background: `
              repeating-linear-gradient(
                -12deg,
                ${alpha('#fff', 0.03)} 0px,
                ${alpha('#fff', 0.03)} 1px,
                transparent 1px,
                transparent 7px
              )
            `,
            pointerEvents: 'none',
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: '12%',
            right: '-8%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.25)} 0%, transparent 70%)`,
            filter: 'blur(1px)',
            pointerEvents: 'none',
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Stack direction="row" spacing={1.75} alignItems="center" sx={{ mb: 5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                fontWeight: 800,
                fontSize: '1.15rem',
                letterSpacing: -0.5,
                color: '#fff',
                background: `linear-gradient(145deg, ${alpha(theme.palette.primary.light, 0.35)} 0%, ${alpha('#fff', 0.1)} 100%)`,
                border: `1px solid ${alpha('#fff', 0.25)}`,
                boxShadow: `0 8px 24px ${alpha('#000', 0.2)}`,
              }}
            >
              {BRAND_MARK}
            </Box>
            <Box>
              <Typography
                component="h1"
                variant="h5"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                  color: '#fff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                }}
              >
                {BRAND_NAME}
              </Typography>
              <Typography
                sx={{
                  mt: 0.25,
                  color: alpha('#fff', 0.9),
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  lineHeight: 1.35,
                  textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                  maxWidth: 360,
                }}
              >
                {BRAND_TAGLINE}
              </Typography>
            </Box>
          </Stack>

          <Typography
            component="p"
            variant="h3"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              maxWidth: 520,
              fontSize: { md: '1.7rem', lg: '1.95rem' },
              color: '#fff',
              textShadow: '0 2px 14px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            Factory operations
            <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
              that scale with you
            </Box>
          </Typography>
          <Typography
            sx={{
              mt: 2,
              color: alpha('#fff', 0.92),
              maxWidth: 500,
              fontSize: '1.02rem',
              lineHeight: 1.65,
              fontWeight: 400,
              textShadow: '0 1px 8px rgba(0,0,0,0.35)',
            }}
          >
            One professional workspace for commercial teams—orders, materials, purchasing, and production—
            with an audit trail your clients can trust.
          </Typography>

          <List sx={{ mt: 3.5, maxWidth: 540 }} disablePadding>
            {highlights.map(({ text, Icon, bg, border }) => (
              <ListItem
                key={text}
                sx={{
                  alignItems: 'flex-start',
                  py: 1.25,
                  px: 0,
                  borderRadius: 2,
                  mb: 0.5,
                }}
              >
                <ListItemIcon sx={{ minWidth: 48, mt: 0.1 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: bg,
                      border: `1px solid ${border}`,
                      color: alpha('#fff', 0.95),
                    }}
                  >
                    <Icon sx={{ fontSize: 22 }} />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={text}
                  primaryTypographyProps={{
                    sx: { color: alpha('#fff', 0.92), fontWeight: 500, lineHeight: 1.5, fontSize: '0.95rem' },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ position: 'relative', zIndex: 1, color: alpha('#fff', 0.45) }}
        >
          <CheckCircleIcon sx={{ fontSize: 16, opacity: 0.7 }} />
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            © {new Date().getFullYear()} {BRAND_NAME} · Enterprise operations
          </Typography>
        </Stack>
      </Grid>

      <Grid
        item
        xs={12}
        md={6}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 3, md: 4 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420 }}>
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                  fontWeight: 800,
                  color: '#fff',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                }}
              >
                {BRAND_MARK}
              </Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                  {BRAND_NAME}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.3, display: 'block' }}>
                  {BRAND_TAGLINE}
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.5, sm: 3.5 },
              borderRadius: '20px',
              background: alpha(warm.paper, 0.92),
              backdropFilter: 'blur(16px) saturate(160%)',
              WebkitBackdropFilter: 'blur(16px) saturate(160%)',
              border: `1px solid ${alpha(slate[200], 0.95)}`,
              boxShadow: `${alpha(slate[900], 0.08)} 0 4px 24px, ${alpha(slate[900], 0.04)} 0 1px 2px`,
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 4,
                background: `linear-gradient(90deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 50%, ${theme.palette.info.main} 100%)`,
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
              },
            }}
          >
            <Box sx={{ pt: 0.5 }}>
              <Typography
                variant="overline"
                sx={{
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  color: theme.palette.primary.main,
                }}
              >
                Secure access
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.03em', mt: 0.5, color: slate[800] }}>
                Sign in
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6, fontWeight: 500 }}>
                Enter your organization credentials to open the operations workspace.
              </Typography>
            </Box>

            {error ? (
              <Alert severity="error" sx={{ mt: 2, borderRadius: 2, fontWeight: 500 }}>
                {error}
              </Alert>
            ) : null}

            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2.5 }}>
              <Stack spacing={2.25}>
                <TextField
                  id="login-username"
                  name="username"
                  label="Username"
                  required
                  fullWidth
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonOutlineIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  id="login-password"
                  name="password"
                  label="Password"
                  type="password"
                  required
                  fullWidth
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockOutlinedIcon sx={{ color: 'text.secondary', fontSize: 22 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  mt: 2.5,
                  py: 1.35,
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  borderRadius: 2,
                  textTransform: 'none',
                  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
                  background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  '&:hover': {
                    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.45)}`,
                    background: `linear-gradient(180deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                  },
                }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign in'}
              </Button>

              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 2, textAlign: 'center', lineHeight: 1.5, fontWeight: 500 }}
              >
                Use of this system is subject to your organization&apos;s security policies.
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Grid>
    </Grid>
  );
};

export default Login;
