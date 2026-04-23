import React, { useMemo, useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Chip, Stack, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Assignment, Inventory2, ShoppingCart, Factory, WarningAmber } from '@mui/icons-material';
import StatCard from '../components/StatCard';
import { ordersAPI, inventoryAPI, procurementAPI, productionAPI } from '../services/api';

const statusLabel = (key) =>
  String(key || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const chipRowStyle = (theme, index) => {
  const keys = ['primary', 'info', 'secondary', 'warning', 'success', 'error'];
  const k = keys[index % keys.length];
  const pal = theme.palette[k];
  return {
    bg: alpha(pal.main, 0.08),
    color: pal.dark,
    border: alpha(pal.main, 0.22),
  };
};

const SectionCard = ({ title, subtitle, children, accent }) => {
  const theme = useTheme();
  const accentColor = theme.palette[accent]?.main || theme.palette.primary.main;
  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: theme.shadows[1],
        transition: 'box-shadow 0.2s ease',
        '&:hover': {
          boxShadow: theme.shadows[2],
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          bgcolor: accentColor,
        },
      }}
    >
      <Box sx={{ p: { xs: 2.25, sm: 2.75 }, pl: { xs: 2.5, sm: 2.75 } }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'text.primary',
              }}
            >
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
        </Stack>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Box>
    </Paper>
  );
};

const StatusRows = ({ data }) => {
  const theme = useTheme();
  const entries = useMemo(() => Object.entries(data || {}), [data]);
  if (!entries.length) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
        No data yet.
      </Typography>
    );
  }
  return (
    <Stack spacing={1}>
      {entries.map(([status, count], idx) => {
        const pal = chipRowStyle(theme, idx);
        return (
          <Box
            key={status}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              py: 1,
              px: 1.25,
              borderRadius: '8px',
              bgcolor: alpha(theme.palette.text.primary, 0.02),
              border: `1px solid ${alpha(theme.palette.text.primary, 0.08)}`,
              '&:hover': { bgcolor: pal.bg },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
              {statusLabel(status)}
            </Typography>
            <Chip
              label={count}
              size="small"
              className="font-numeric"
              sx={{
                fontWeight: 600,
                bgcolor: pal.bg,
                color: pal.color,
                border: `1px solid ${pal.border}`,
              }}
            />
          </Box>
        );
      })}
    </Stack>
  );
};

const Dashboard = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    orders: {},
    inventory: {},
    procurement: {},
    production: {},
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [ordersRes, inventoryRes, procurementRes, productionRes] = await Promise.all([
          ordersAPI.getStatistics(),
          inventoryAPI.getStatistics(),
          procurementAPI.getStatistics(),
          productionAPI.getStatistics(),
        ]);

        setStats({
          orders: ordersRes.data,
          inventory: inventoryRes.data,
          procurement: procurementRes.data,
          production: productionRes.data,
        });
      } catch (error) {
        console.error('Error fetching statistics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        minHeight="420px"
        gap={2}
        sx={{
          borderRadius: '12px',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper',
        }}
      >
        <CircularProgress size={36} thickness={4} sx={{ color: 'primary.main' }} />
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          Loading dashboard…
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          mb: { xs: 2.5, md: 3 },
          p: { xs: 2.5, sm: 3 },
          borderRadius: '18px',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          boxShadow: theme.shadows[1],
        }}
      >
        <Typography variant="overline" color="primary" sx={{ fontWeight: 600, letterSpacing: '0.08em' }}>
          Executive overview
        </Typography>
        <Typography
          variant="h3"
          component="h1"
          sx={{
            mt: 0.75,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.2,
            color: 'text.primary',
          }}
        >
          Manufacturing <Box component="span" sx={{ color: 'primary.main' }}>control tower</Box>
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 1.25, maxWidth: 720, fontWeight: 400, lineHeight: 1.6 }}>
          Throughput, materials risk, purchasing, and production at a glance—aligned for daily operations and management review.
        </Typography>
      </Paper>

      <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            accent="info"
            title="Active orders"
            value={stats.orders.total_orders || 0}
            subtitle="PI records in the system"
            icon={<Assignment sx={{ fontSize: 24 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            accent="success"
            title="Inventory SKUs"
            value={stats.inventory.total_items || 0}
            subtitle="Tracked materials and trims"
            icon={<Inventory2 sx={{ fontSize: 24 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            accent="warning"
            title="Purchase orders"
            value={stats.procurement.total_pos || 0}
            subtitle="Vendor commitments and receipts"
            icon={<ShoppingCart sx={{ fontSize: 24 }} />}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            accent="secondary"
            title="Production issues"
            value={stats.production.total_issues || 0}
            subtitle="Shop-floor material releases"
            icon={<Factory sx={{ fontSize: 24 }} />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 2, sm: 2.5 }}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Orders by status" subtitle="Pipeline distribution across PI lifecycle" accent="info">
            <StatusRows data={stats.orders.by_status} />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard title="Materials risk" subtitle="Items at or below reorder thresholds" accent="warning">
            <Stack direction="row" spacing={2} alignItems="center" sx={{ py: 0.5 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '12px',
                  display: 'grid',
                  placeItems: 'center',
                  bgcolor: alpha(theme.palette.warning.main, 0.12),
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                  color: 'warning.dark',
                }}
              >
                <WarningAmber sx={{ fontSize: 30 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="h3"
                  className="font-numeric"
                  sx={{
                    fontWeight: 600,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    color: 'warning.dark',
                  }}
                >
                  {stats.inventory.low_stock_items || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
                  SKUs require procurement attention
                </Typography>
              </Box>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard title="Procurement health" subtitle="PO distribution by operational state" accent="warning">
            <StatusRows data={stats.procurement.by_status} />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard title="Production movement" subtitle="Issues tracked through the shop floor" accent="secondary">
            <StatusRows data={stats.production.by_status} />
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
