import React, { Fragment, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
  Stack,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  Factory as ManufacturingIcon,
  ListAlt as ListAltIcon,
  Public as PublicIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { layoutDrawerWidth, navChrome, slate } from '../theme/appTheme';

const DRAWER_COLLAPSED_WIDTH = 88;

const navGroups = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ text: 'Plant dashboard', icon: <DashboardIcon />, path: '/' }],
  },
  {
    id: 'commercial',
    label: 'Merchandising & sales',
    items: [
      { text: 'Buyers & accounts', icon: <PublicIcon />, path: '/customers' },
      { text: 'Proforma invoices', icon: <AssignmentIcon />, path: '/orders' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    items: [{ text: 'Intents & indents', icon: <ListAltIcon />, path: '/intents' }],
  },
  {
    id: 'supply',
    label: 'Materials & buying',
    items: [
      { text: 'Fabrics, trims & stock', icon: <InventoryIcon />, path: '/inventory' },
      { text: 'Mill & vendor POs', icon: <ShoppingCartIcon />, path: '/procurement' },
    ],
  },
  {
    id: 'floor',
    label: 'Shop floor',
    items: [{ text: 'Cutting, sewing & finishing', icon: <ManufacturingIcon />, path: '/production' }],
  },
  {
    id: 'organization',
    label: 'Organization',
    items: [{ text: 'Company details', icon: <BusinessIcon />, path: '/company' }],
  },
];

const routeMeta = {
  '/': { title: 'Plant dashboard' },
  '/customers': { title: 'Buyers & accounts' },
  '/orders': { title: 'Proforma invoices' },
  '/intents': { title: 'Intents' },
  '/inventory': { title: 'Inventory' },
  '/procurement': { title: 'Procurement' },
  '/production': { title: 'Production' },
  '/company': { title: 'Company details' },
};

const pathMatchesNav = (pathname, path) => {
  if (path === '/') return pathname === '/';
  if (path === '/orders') return pathname === '/orders' || pathname.startsWith('/orders/');
  return pathname === path || pathname.startsWith(`${path}/`);
};

const Layout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const compactNav = collapsed && !(isMobile && mobileOpen);
  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : layoutDrawerWidth;
  const sidebarBorder = navChrome.border;

  const header = useMemo(() => {
    if (location.pathname.startsWith('/orders/pi/')) {
      return { title: 'Proforma invoice' };
    }
    const meta = routeMeta[location.pathname] || { title: 'GMS' };
    return { title: meta.title };
  }, [location.pathname]);

  const initials = useMemo(() => {
    const name = user?.username || 'U';
    const parts = name.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [user?.username]);

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: navChrome.gradient,
        color: navChrome.text,
        borderRight: `1px solid ${sidebarBorder}`,
        boxShadow: `inset 4px 0 0 0 ${navChrome.rail}`,
        position: 'relative',
        '&::before': {
          content: '""',
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          opacity: 1,
          background: navChrome.sheen,
        },
        '&::after': {
          content: '""',
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          opacity: 0.35,
          backgroundImage: `repeating-linear-gradient(
            -12deg,
            ${alpha('#fff', 0.02)} 0px,
            ${alpha('#fff', 0.02)} 1px,
            transparent 1px,
            transparent 7px
          )`,
        },
      }}
    >
      <Toolbar
        sx={{
          minHeight: { xs: 68, sm: 76 },
          px: compactNav ? 1.5 : 2.75,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compactNav ? 'center' : 'space-between',
          gap: 1,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minWidth: 0,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: '12px',
              display: 'grid',
              placeItems: 'center',
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontWeight: 700,
              letterSpacing: -0.5,
              color: '#fff',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              boxShadow: `0 2px 10px ${alpha(theme.palette.primary.main, 0.35)}`,
              flexShrink: 0,
            }}
          >
            G
          </Box>
          {!compactNav ? (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.15,
                  color: '#ffffff',
                  letterSpacing: '-0.03em',
                  textTransform: 'none',
                }}
              >
                GMS
              </Typography>
              <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.78), fontWeight: 600 }}>
                Garment production suite
              </Typography>
            </Box>
          ) : null}
        </Box>
        <IconButton
          size="small"
          onClick={() => setCollapsed((c) => !c)}
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            color: '#ffffff',
            border: `1px solid ${sidebarBorder}`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            transition: 'background-color 0.2s ease, transform 0.15s ease',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08), transform: 'scale(1.04)' },
          }}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </Toolbar>

      <Divider sx={{ borderColor: sidebarBorder, position: 'relative', zIndex: 1 }} />

      <List sx={{ px: compactNav ? 1 : 1.25, flex: 1, position: 'relative', zIndex: 1, py: 0.5 }}>
        {navGroups.map((group) => (
          <Fragment key={group.id}>
            {!compactNav ? (
              <ListSubheader
                disableSticky
                component="div"
                sx={{
                  bgcolor: 'transparent',
                  color: alpha('#ffffff', 0.72),
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  lineHeight: 2.2,
                  mt: group.id === 'overview' ? 0 : 1,
                  pl: 1.25,
                  pr: 1,
                }}
              >
                {group.label}
              </ListSubheader>
            ) : null}
            {group.items.map((item) => {
              const selected = pathMatchesNav(location.pathname, item.path);
              const button = (
                <ListItemButton
                  selected={selected}
                  onClick={() => {
                    navigate(item.path);
                    setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: '10px',
                    py: 1.2,
                    px: compactNav ? 1 : 1.35,
                    justifyContent: compactNav ? 'center' : 'flex-start',
                    color: '#ffffff',
                    transition: 'background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
                    '& .MuiListItemText-primary': {
                      color: selected ? '#ffffff' : alpha('#ffffff', 0.92),
                      fontWeight: selected ? 600 : 500,
                      fontSize: '0.875rem',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.35,
                    },
                    '&.Mui-selected': {
                      color: '#ffffff',
                      bgcolor: alpha(theme.palette.primary.main, 0.26),
                      borderLeft: `3px solid ${theme.palette.primary.light}`,
                      pl: compactNav ? 1 : 1.05,
                      boxShadow: `0 1px 0 ${alpha('#fff', 0.06)} inset`,
                      '& .MuiListItemText-primary': { color: '#ffffff' },
                    },
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      transform: compactNav ? 'none' : 'translateX(2px)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: compactNav ? 0 : 44,
                      color: selected ? theme.palette.primary.light : alpha('#ffffff', 0.78),
                      justifyContent: 'center',
                      transition: 'color 0.2s ease',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {!compactNav ? (
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontWeight: selected ? 600 : 500,
                        fontSize: '0.875rem',
                        letterSpacing: '-0.01em',
                        lineHeight: 1.35,
                        sx: { color: 'inherit' },
                      }}
                    />
                  ) : null}
                </ListItemButton>
              );
              return (
                <ListItem key={item.path} disablePadding sx={{ mb: 0.35 }}>
                  {compactNav ? (
                    <Tooltip title={item.text} placement="right" arrow>
                      <span>{button}</span>
                    </Tooltip>
                  ) : (
                    button
                  )}
                </ListItem>
              );
            })}
          </Fragment>
        ))}
      </List>

      <Box sx={{ p: compactNav ? 1 : 2, mt: 'auto', position: 'relative', zIndex: 1 }}>
        <Box
          sx={{
            borderRadius: '12px',
            border: `1px solid ${sidebarBorder}`,
            bgcolor: alpha(theme.palette.background.paper, 0.72),
            backdropFilter: 'blur(12px) saturate(150%)',
            WebkitBackdropFilter: 'blur(12px) saturate(150%)',
            p: compactNav ? 1 : 1.75,
          }}
        >
          {!compactNav ? (
            <Typography variant="caption" sx={{ color: alpha('#ffffff', 0.72), fontWeight: 700, letterSpacing: '0.08em' }}>
              Signed in
            </Typography>
          ) : null}
          {!compactNav ? (
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 700, mt: 0.5 }} noWrap title={user?.username}>
              {user?.username || 'User'}
            </Typography>
          ) : (
            <Stack direction="row" justifyContent="center" sx={{ py: 0.5 }}>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                  color: 'primary.dark',
                  fontWeight: 600,
                  fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                }}
              >
                {initials}
              </Avatar>
            </Stack>
          )}
          <Button
            fullWidth
            variant="outlined"
            startIcon={compactNav ? null : <LogoutIcon />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
            sx={{
              mt: 1.35,
              borderColor: sidebarBorder,
              color: '#ffffff',
              '&:hover': {
                borderColor: alpha(theme.palette.primary.main, 0.45),
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              },
            }}
          >
            {compactNav ? <LogoutIcon fontSize="small" /> : 'Sign out'}
          </Button>
        </Box>
        {!compactNav ? (
            <Typography variant="caption" sx={{ display: 'block', mt: 1.75, color: alpha('#ffffff', 0.65), px: 0.5 }}>
            GMS · Cut &amp; sew operations
          </Typography>
        ) : null}
      </Box>
    </Box>
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'transparent' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: `linear-gradient(180deg, ${alpha('#ffffff', 0.94)} 0%, ${alpha(slate[50], 0.9)} 100%)`,
          backdropFilter: 'blur(18px) saturate(165%)',
          WebkitBackdropFilter: 'blur(18px) saturate(165%)',
          borderBottom: `1px solid ${alpha(slate[200], 0.95)}`,
          boxShadow: `inset 0 3px 0 0 ${theme.palette.primary.main}, 0 4px 24px ${alpha(slate[900], 0.06)}`,
          color: 'text.primary',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 68, sm: 76 }, gap: 2, px: { xs: 1.5, sm: 2.5 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 0.5, display: { sm: 'none' } }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="h5"
              component="p"
              sx={{
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              {header.title}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', lg: 'block' } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
                Operator
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                {user?.username || '—'}
              </Typography>
            </Box>
            <Avatar
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: 'primary.dark',
                fontWeight: 600,
                fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              }}
            >
              {initials}
            </Avatar>
            <Button variant="outlined" color="inherit" onClick={handleLogout} sx={{ borderColor: alpha(theme.palette.text.primary, 0.12) }}>
              Sign out
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: layoutDrawerWidth, border: 'none' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              border: 'none',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.shorter,
              }),
              overflowX: 'hidden',
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 68, sm: 76 } }} />
        <Box
          sx={{
            p: { xs: 2, sm: 3, md: 4 },
            pb: { xs: 5, md: 6 },
            maxWidth: 1720,
            mx: 'auto',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
