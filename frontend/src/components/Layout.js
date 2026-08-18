import React, { Fragment, useMemo, useState, useEffect, useCallback } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
  ShoppingCart as ShoppingCartIcon,
  ListAlt as ListAltIcon,
  Public as PublicIcon,
  Logout as LogoutIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  Business as BusinessIcon,
  ReceiptLong as ReceiptLongIcon,
  PointOfSale as PointOfSaleIcon,
  LocalShipping as LocalShippingIcon,
  Inventory2 as InventoryIcon,
  ManageAccounts as ManageAccountsIcon,
  MenuBook as MenuBookIcon,
  Storefront as StorefrontIcon,
  Warehouse as WarehouseIcon,
  ConfirmationNumber as ConfirmationNumberIcon,
  BugReport as BugReportIcon,
  ContentCut as ContentCutIcon,
  PrecisionManufacturing as PrecisionManufacturingIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { layoutDrawerWidth, navChrome, slate } from '../theme/appTheme';
import BrandLogo from './BrandLogo';
import { hasModuleAccess, dashboardTitleForUser } from '../config/permissions';
import ReportTicketModal from './ReportTicketModal';

const DRAWER_COLLAPSED_WIDTH = 72;
const NAV_EXPANDED_KEY = 'gms.nav.expandedGroups';
const NAV_COLLAPSED_KEY = 'gms.nav.collapsed';

const defaultExpandedState = {
  overview: true,
  commercial: true,
  planning: false,
  production: true,
  supply: false,
  stock: false,
  organization: false,
  support: true,
};

const navGroups = [
  {
    id: 'overview',
    label: 'Overview',
    icon: <DashboardIcon sx={{ fontSize: 16 }} />,
    accent: '#14b8a6',
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', module: null },
      { text: 'Documentation', icon: <MenuBookIcon />, path: '/documentation', module: null },
    ],
  },
  {
    id: 'commercial',
    label: 'Sales & buyers',
    icon: <StorefrontIcon sx={{ fontSize: 16 }} />,
    accent: '#6366f1',
    items: [
      { text: 'Buyers', icon: <PublicIcon />, path: '/customers', module: 'customers' },
      { text: 'Buyer POs', icon: <ReceiptLongIcon />, path: '/buyer-pos', module: 'buyer_pos' },
      { text: 'Sales', icon: <PointOfSaleIcon />, path: '/sales', module: 'sales' },
      { text: 'Proforma invoices', icon: <AssignmentIcon />, path: '/orders', module: 'pi' },
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: <ListAltIcon sx={{ fontSize: 16 }} />,
    accent: '#0ea5e9',
    items: [{ text: 'Indents', icon: <ListAltIcon />, path: '/indents', module: 'indents' }],
  },
  {
    id: 'production',
    label: 'Production',
    icon: <PrecisionManufacturingIcon sx={{ fontSize: 16 }} />,
    accent: '#0891b2',
    items: [
      { text: 'Cutting', icon: <ContentCutIcon />, path: '/production/cutting', module: 'production' },
    ],
  },
  {
    id: 'supply',
    label: 'Procurement',
    icon: <LocalShippingIcon sx={{ fontSize: 16 }} />,
    accent: '#f59e0b',
    items: [
      { text: 'Trims library', icon: <ListAltIcon />, path: '/trims', module: 'trims' },
      { text: 'Suppliers', icon: <LocalShippingIcon />, path: '/suppliers', module: 'suppliers' },
      { text: 'Supplier POs', icon: <ShoppingCartIcon />, path: '/procurement', module: 'supplier_po' },
      { text: 'Purchase', icon: <ReceiptLongIcon />, path: '/purchase-bills', module: 'purchase_bills' },
    ],
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: <WarehouseIcon sx={{ fontSize: 16 }} />,
    accent: '#10b981',
    items: [{ text: 'Inventory', icon: <InventoryIcon />, path: '/inventory', module: 'inventory' }],
  },
  {
    id: 'organization',
    label: 'Organization',
    icon: <BusinessIcon sx={{ fontSize: 16 }} />,
    accent: '#94a3b8',
    items: [
      { text: 'Company details', icon: <BusinessIcon />, path: '/company', module: 'company' },
      { text: 'Users & roles', icon: <ManageAccountsIcon />, path: '/users', module: 'users' },
    ],
  },
  {
    id: 'support',
    label: 'Support',
    icon: <ConfirmationNumberIcon sx={{ fontSize: 16 }} />,
    accent: '#ef4444',
    items: [
      { text: 'Tickets', icon: <ConfirmationNumberIcon />, path: '/tickets', module: null, adminOnly: true },
    ],
  },
];

const routeMeta = {
  '/': { title: 'WeaveCore' },
  '/dashboard': { title: 'Plant dashboard' },
  '/customers': { title: 'Buyers' },
  '/orders': { title: 'Proforma invoices' },
  '/indents': { title: 'Indents' },
  '/indents/new': { title: 'New Indent' },
  '/trims': { title: 'Trims Library' },
  '/suppliers': { title: 'Suppliers' },
  '/inventory': { title: 'Inventory' },
    '/procurement': { title: 'Supplier purchase orders' },
    '/procurement/new': { title: 'Raise PO' },
    '/purchase-bills': { title: 'Purchase' },
    '/purchase-bills/new': { title: 'Purchase Bill' },
    '/sales': { title: 'Sales' },
    '/sales/new': { title: 'New sales entry' },
  '/production': { title: 'Production' },
  '/production/cutting': { title: 'Cutting' },
  '/production/cutting/new': { title: 'Record Cutting' },
  '/company': { title: 'Company details' },
  '/profile': { title: 'My profile' },
  '/documentation': { title: 'Documentation' },
  '/users': { title: 'Users & roles' },
  '/tickets': { title: 'Tickets' },
};

const pathMatchesNav = (pathname, path) => {
  if (path === '/') return pathname === '/';
  if (path === '/dashboard') return pathname === '/dashboard';
  if (path === '/documentation') return pathname === '/documentation';
  if (path === '/orders') return pathname === '/orders' || pathname.startsWith('/orders/');
  if (path === '/indents') return pathname === '/indents' || pathname.startsWith('/indents/');
  if (path === '/purchase-bills') return pathname === '/purchase-bills' || pathname.startsWith('/purchase-bills/');
  if (path === '/sales') return pathname === '/sales' || pathname.startsWith('/sales/');
  if (path === '/users') return pathname === '/users' || pathname.startsWith('/users/');
  if (path === '/tickets') return pathname === '/tickets' || pathname.startsWith('/tickets/');
  if (path === '/inventory') return pathname === '/inventory' || pathname.startsWith('/inventory/');
  return pathname === path || pathname.startsWith(`${path}/`);
};

const loadExpandedGroups = () => {
  try {
    const raw = localStorage.getItem(NAV_EXPANDED_KEY);
    return raw ? { ...defaultExpandedState, ...JSON.parse(raw) } : { ...defaultExpandedState };
  } catch {
    return { ...defaultExpandedState };
  }
};

const loadNavCollapsed = () => {
  try {
    return localStorage.getItem(NAV_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

const Layout = ({ children }) => {
  // Prefer <Outlet /> under createBrowserRouter; keep children for any legacy wrap.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(loadNavCollapsed);
  const [expandedGroups, setExpandedGroups] = useState(loadExpandedGroups);
  const [reportOpen, setReportOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const isAdminUser = Boolean(user?.is_admin || user?.role === 'ADMIN');

  const compactNav = collapsed && !(isMobile && mobileOpen);
  const drawerWidth = collapsed ? DRAWER_COLLAPSED_WIDTH : layoutDrawerWidth;
  const sidebarBorder = navChrome.border;

  const visibleNavGroups = useMemo(() => navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.adminOnly && !isAdminUser) return false;
        return !item.module || hasModuleAccess(user, item.module);
      }),
    }))
    .filter((group) => group.items.length > 0), [user, isAdminUser]);

  const activeGroupId = useMemo(() => {
    const match = visibleNavGroups.find((group) =>
      group.items.some((item) => pathMatchesNav(location.pathname, item.path))
    );
    return match?.id ?? null;
  }, [location.pathname, visibleNavGroups]);

  useEffect(() => {
    if (!activeGroupId) return;
    setExpandedGroups((prev) => {
      if (prev[activeGroupId]) return prev;
      return { ...prev, [activeGroupId]: true };
    });
  }, [activeGroupId]);

  useEffect(() => {
    localStorage.setItem(NAV_EXPANDED_KEY, JSON.stringify(expandedGroups));
  }, [expandedGroups]);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  const toggleNavCollapsed = useCallback(() => {
    setCollapsed((c) => !c);
  }, []);

  const toggleGroup = useCallback((groupId) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  const expandAllGroups = useCallback(() => {
    const next = {};
    visibleNavGroups.forEach((g) => { next[g.id] = true; });
    setExpandedGroups(next);
  }, [visibleNavGroups]);

  const collapseAllGroups = useCallback(() => {
    const next = {};
    visibleNavGroups.forEach((g) => {
      next[g.id] = g.id === activeGroupId;
    });
    setExpandedGroups(next);
  }, [visibleNavGroups, activeGroupId]);

  const renderNavItem = (item) => {
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
          py: 1.05,
          px: compactNav ? 1 : 1.35,
          pl: compactNav ? 1 : 1.75,
          justifyContent: compactNav ? 'center' : 'flex-start',
          color: '#ffffff',
          transition: 'background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
          '& .MuiListItemText-primary': {
            color: selected ? '#ffffff' : alpha('#ffffff', 0.92),
            fontWeight: selected ? 600 : 500,
            fontSize: '0.84rem',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
          },
          '&.Mui-selected': {
            color: '#ffffff',
            bgcolor: alpha(theme.palette.primary.main, 0.26),
            borderLeft: `3px solid ${theme.palette.primary.light}`,
            pl: compactNav ? 1 : 1.45,
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
            minWidth: compactNav ? 0 : 40,
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
              fontSize: '0.84rem',
              letterSpacing: '-0.01em',
              lineHeight: 1.35,
              sx: { color: 'inherit' },
            }}
          />
        ) : null}
      </ListItemButton>
    );
    return (
      <ListItem key={item.path} disablePadding sx={{ mb: 0.25 }}>
        {compactNav ? (
          <Tooltip title={item.text} placement="right" arrow>
            <span>{button}</span>
          </Tooltip>
        ) : (
          button
        )}
      </ListItem>
    );
  };

  const header = useMemo(() => {
    if (location.pathname.startsWith('/orders/pi/')) {
      return { title: 'Proforma Invoice' };
    }
    if (location.pathname.startsWith('/purchase-bills/') && location.pathname !== '/purchase-bills/new') {
      return { title: 'Purchase Bill' };
    }
    if (location.pathname === '/purchase-bills/new') {
      return { title: 'Purchase Bill' };
    }
    if (location.pathname === '/' || location.pathname === '/dashboard') {
      return { title: dashboardTitleForUser(user) };
    }
    if (location.pathname === '/procurement/new') {
      const params = new URLSearchParams(location.search);
      return {
        title: params.get('mode') === 'fabric' ? 'Raise Fabric PO' : 'Raise Trim PO',
      };
    }
    const path = location.pathname;
    let meta = routeMeta[path];
    if (!meta && path.startsWith('/production/cutting/')) {
      meta = routeMeta['/production/cutting/new'] || { title: 'Cutting' };
    }
    if (!meta) meta = { title: 'WeaveCore' };
    return { title: meta.title };
  }, [location.pathname, location.search, user]);

  const displayName = useMemo(() => {
    const full = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim();
    return full || user?.username || 'User';
  }, [user?.first_name, user?.last_name, user?.username]);

  const initials = useMemo(() => {
    const fn = user?.first_name?.trim();
    const ln = user?.last_name?.trim();
    if (fn || ln) {
      const letters = `${fn?.[0] || ''}${ln?.[0] || ''}`.toUpperCase();
      if (letters) return letters;
    }
    const name = user?.username || 'U';
    const parts = name.replace(/[^a-zA-Z0-9]/g, ' ').trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }, [user?.first_name, user?.last_name, user?.username]);

  const drawer = (
    <Box
      sx={{
        minHeight: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        color: navChrome.text,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        aria-hidden
        sx={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          background: navChrome.gradient,
          zIndex: 0,
        }}
      />
      <Box
        aria-hidden
        sx={{
          pointerEvents: 'none',
          position: 'absolute',
          inset: 0,
          background: navChrome.sheen,
          zIndex: 0,
        }}
      />
      <Box
        aria-hidden
        sx={{
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
          zIndex: 0,
        }}
      />
      <Toolbar
        sx={{
          minHeight: { xs: 68, sm: compactNav ? 96 : 76 },
          px: compactNav ? 1 : 2.75,
          display: 'flex',
          flexDirection: compactNav ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: compactNav ? 'center' : 'space-between',
          gap: compactNav ? 0.75 : 1,
          py: compactNav ? 1.25 : 0,
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
            width: compactNav ? 'auto' : undefined,
          }}
          onClick={() => navigate('/dashboard')}
        >
          {compactNav ? (
            <BrandLogo variant="mark" tone="dark" size={40} />
          ) : (
            <BrandLogo
              variant="lockup"
              tone="dark"
              size={38}
              showTagline
              tagline="One connected operation"
            />
          )}
        </Box>
        <Tooltip
          title={collapsed ? 'Expand navigation' : 'Minimise navigation'}
          placement={compactNav ? 'right' : 'bottom'}
          arrow
        >
          <IconButton
            size="small"
            onClick={toggleNavCollapsed}
            sx={{
              display: { xs: 'none', sm: 'inline-flex' },
              color: '#ffffff',
              width: compactNav ? 36 : 32,
              height: compactNav ? 36 : 32,
              border: `1px solid ${alpha('#fff', 0.22)}`,
              bgcolor: alpha('#fff', 0.08),
              transition: 'background-color 0.2s ease, transform 0.15s ease',
              '&:hover': { bgcolor: alpha('#fff', 0.16), transform: 'scale(1.04)' },
            }}
            aria-label={collapsed ? 'Expand navigation' : 'Minimise navigation'}
          >
            {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Toolbar>

      <Divider sx={{ borderColor: sidebarBorder, position: 'relative', zIndex: 1 }} />

      <List sx={{
        px: compactNav ? 1 : 1.25,
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        position: 'relative',
        zIndex: 1,
        py: 0.5,
      }}>
        {!compactNav && visibleNavGroups.some((g) => g.items.length > 1) && (
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ px: 0.75, pb: 1, pt: 0.25, justifyContent: 'flex-end' }}
          >
            <Button
              size="small"
              onClick={expandAllGroups}
              startIcon={<UnfoldMoreIcon sx={{ fontSize: '14px !important' }} />}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.25,
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'none',
                color: alpha('#fff', 0.72),
                '&:hover': { bgcolor: alpha('#fff', 0.08), color: '#fff' },
              }}
            >
              Expand
            </Button>
            <Button
              size="small"
              onClick={collapseAllGroups}
              startIcon={<UnfoldLessIcon sx={{ fontSize: '14px !important' }} />}
              sx={{
                minWidth: 0,
                px: 1,
                py: 0.25,
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'none',
                color: alpha('#fff', 0.72),
                '&:hover': { bgcolor: alpha('#fff', 0.08), color: '#fff' },
              }}
            >
              Collapse
            </Button>
          </Stack>
        )}

        {visibleNavGroups.map((group, groupIndex) => {
          const isExpanded = expandedGroups[group.id] !== false;
          const hasActiveItem = group.items.some((item) => pathMatchesNav(location.pathname, item.path));
          const isSingleItem = group.items.length === 1;

          if (isSingleItem) {
            return (
              <Fragment key={group.id}>
                {!compactNav && groupIndex > 0 && (
                  <Divider sx={{ my: 0.75, borderColor: alpha('#fff', 0.08) }} />
                )}
                {renderNavItem(group.items[0])}
              </Fragment>
            );
          }

          return (
            <Fragment key={group.id}>
              {!compactNav ? (
                <>
                  {groupIndex > 0 && (
                    <Divider sx={{ my: 0.75, borderColor: alpha('#fff', 0.08) }} />
                  )}
                  <ListItemButton
                    onClick={() => toggleGroup(group.id)}
                    sx={{
                      borderRadius: '10px',
                      py: 0.85,
                      px: 1.1,
                      mb: 0.25,
                      color: alpha('#fff', 0.88),
                      bgcolor: hasActiveItem ? alpha(group.accent, 0.12) : alpha('#fff', 0.04),
                      border: `1px solid ${hasActiveItem ? alpha(group.accent, 0.35) : alpha('#fff', 0.08)}`,
                      transition: 'background-color 0.2s ease, border-color 0.2s ease',
                      '&:hover': {
                        bgcolor: alpha(group.accent, 0.16),
                        borderColor: alpha(group.accent, 0.4),
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: '8px',
                        display: 'grid',
                        placeItems: 'center',
                        mr: 1.1,
                        flexShrink: 0,
                        bgcolor: alpha(group.accent, 0.22),
                        color: group.accent,
                        border: `1px solid ${alpha(group.accent, 0.35)}`,
                      }}
                    >
                      {group.icon}
                    </Box>
                    <ListItemText
                      primary={group.label}
                      secondary={!isExpanded ? `${group.items.length} items hidden` : undefined}
                      primaryTypographyProps={{
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: hasActiveItem ? '#fff' : alpha('#fff', 0.9),
                      }}
                      secondaryTypographyProps={{
                        fontSize: '0.62rem',
                        color: alpha('#fff', 0.5),
                        mt: 0.15,
                      }}
                    />
                    <Box
                      sx={{
                        ml: 0.5,
                        px: 0.65,
                        py: 0.15,
                        borderRadius: 999,
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        bgcolor: alpha(group.accent, 0.2),
                        color: group.accent,
                        lineHeight: 1.4,
                      }}
                    >
                      {group.items.length}
                    </Box>
                    {isExpanded ? (
                      <ExpandLessIcon sx={{ ml: 0.5, fontSize: 18, color: alpha('#fff', 0.7) }} />
                    ) : (
                      <ExpandMoreIcon sx={{ ml: 0.5, fontSize: 18, color: alpha('#fff', 0.7) }} />
                    )}
                  </ListItemButton>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <Box sx={{ pl: 0.5, pb: 0.25 }}>
                      {group.items.map((item) => renderNavItem(item))}
                    </Box>
                  </Collapse>
                </>
              ) : (
                <>
                  {groupIndex > 0 && (
                    <Divider sx={{ my: 0.5, borderColor: alpha('#fff', 0.1) }} />
                  )}
                  {group.items.map((item) => renderNavItem(item))}
                </>
              )}
            </Fragment>
          );
        })}
      </List>
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

          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ textAlign: 'right', display: { xs: 'none', lg: 'block' } }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: '0.08em' }}>
                Operator
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                {displayName}
              </Typography>
            </Box>
            <Tooltip title="My profile">
              <IconButton
                onClick={() => navigate('/profile')}
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.14) },
                }}
                aria-label="My profile"
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: 'primary.dark',
                    fontWeight: 600,
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              color="error"
              onClick={handleLogout}
              startIcon={<LogoutIcon sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />}
              sx={{
                fontWeight: 700,
                textTransform: 'none',
                px: { xs: 1.5, sm: 2.25 },
                boxShadow: `0 2px 10px ${alpha(theme.palette.error.main, 0.35)}`,
                '&:hover': {
                  boxShadow: `0 4px 14px ${alpha(theme.palette.error.main, 0.45)}`,
                },
              }}
            >
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
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: layoutDrawerWidth,
              border: 'none',
              minHeight: '100vh',
              height: '100%',
              backgroundColor: '#162827',
              background: navChrome.gradient,
              borderRight: `1px solid ${sidebarBorder}`,
              boxShadow: `inset 4px 0 0 0 ${navChrome.rail}`,
            },
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
              minHeight: '100vh',
              height: '100%',
              backgroundColor: '#162827',
              background: navChrome.gradient,
              borderRight: `1px solid ${sidebarBorder}`,
              boxShadow: `inset 4px 0 0 0 ${navChrome.rail}`,
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
          {children ?? <Outlet />}
        </Box>
      </Box>

      <Tooltip title="Report a bug or request a feature" placement="left">
        <IconButton
          onClick={() => setReportOpen(true)}
          aria-label="Report a bug or request a feature"
          sx={{
            position: 'fixed',
            right: { xs: 16, sm: 22 },
            bottom: { xs: 16, sm: 22 },
            zIndex: (t) => t.zIndex.drawer + 2,
            width: 44,
            height: 44,
            bgcolor: theme.palette.primary.main,
            color: '#fff',
            boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
            '&:hover': {
              bgcolor: theme.palette.primary.dark,
              boxShadow: `0 6px 18px ${alpha(theme.palette.primary.main, 0.5)}`,
            },
          }}
        >
          <BugReportIcon sx={{ fontSize: 22 }} />
        </IconButton>
      </Tooltip>

      <ReportTicketModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        pageUrl={`${location.pathname}${location.search || ''}`}
      />
    </Box>
  );
};

export default Layout;
