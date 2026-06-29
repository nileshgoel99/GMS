import React, { useMemo, useState, useEffect } from 'react';
import { Grid, Paper, Typography, Box, CircularProgress, Chip, Stack, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  Assignment, Inventory2, ShoppingCart, Factory, WarningAmber, LocalShipping,
  AccountBalance, AccountBalanceWallet, Payments, ChevronRight,
} from '@mui/icons-material';
import StatCard from '../components/StatCard';
import ReceivablesDueModal from '../components/dashboard/ReceivablesDueModal';
import PayablesDueModal from '../components/dashboard/PayablesDueModal';
import ActiveOrdersModal from '../components/dashboard/ActiveOrdersModal';
import PurchaseOrdersModal from '../components/dashboard/PurchaseOrdersModal';
import PosDueToReceiveModal from '../components/dashboard/PosDueToReceiveModal';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasModuleAccess } from '../config/permissions';
import { ordersAPI, inventoryAPI, procurementAPI, productionAPI, purchaseBillAPI, salesEntryAPI } from '../services/api';

const DashboardLoading = ({ theme }) => (
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

const MaterialsRiskCard = ({ theme, count }) => (
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
          sx={{ fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: 'warning.dark' }}
        >
          {count}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
          SKUs require procurement attention
        </Typography>
      </Box>
    </Stack>
  </SectionCard>
);

const statusLabel = (key) =>
  String(key || '')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatCurrency = (amount, prefix = '₹') => {
  const num = Number(amount);
  if (Number.isNaN(num)) return `${prefix} 0.00`;
  return `${prefix} ${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

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

const SectionCard = ({ title, subtitle, children, accent, headerIcon }) => {
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
          <Box sx={{ minWidth: 0, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            {headerIcon ? (
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '10px',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  bgcolor: alpha(accentColor, 0.1),
                  color: accentColor,
                  border: `1px solid ${alpha(accentColor, 0.22)}`,
                  mt: 0.25,
                }}
              >
                {headerIcon}
              </Box>
            ) : null}
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
          </Box>
        </Stack>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Box>
    </Paper>
  );
};

const PaymentDueRow = ({ icon, iconBg, iconColor, borderColor, title, description, amount, count, countLabel, onClick }) => (
  <Box
    component={onClick ? 'button' : 'div'}
    type={onClick ? 'button' : undefined}
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 2,
      py: 1.5,
      px: 1.75,
      width: '100%',
      textAlign: 'left',
      borderRadius: '10px',
      bgcolor: iconBg,
      border: `1px solid ${borderColor}`,
      cursor: onClick ? 'pointer' : 'default',
      font: 'inherit',
      fontFamily: 'inherit',
      transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      ...(onClick && {
        '&:hover': {
          transform: 'translateY(-1px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        },
        '&:focus-visible': {
          outline: `2px solid ${iconColor}`,
          outlineOffset: 2,
        },
      }),
    }}
  >
    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: '10px',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          bgcolor: alpha(iconColor, 0.15),
          color: iconColor,
          border: `1px solid ${alpha(iconColor, 0.28)}`,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary', letterSpacing: '-0.01em' }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.4 }}>
          {description}
        </Typography>
      </Box>
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
      <Box sx={{ textAlign: 'right' }}>
        <Typography
          className="font-numeric"
          sx={{ fontWeight: 800, fontSize: '1.05rem', color: iconColor, whiteSpace: 'nowrap' }}
        >
          {amount}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
          {count} {countLabel}
        </Typography>
      </Box>
      {onClick ? <ChevronRight sx={{ fontSize: 20, color: 'text.disabled' }} /> : null}
    </Stack>
  </Box>
);

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboardRole = user?.is_admin ? 'ADMIN' : (user?.role || 'ADMIN');

  const [loading, setLoading] = useState(true);
  const [receivablesOpen, setReceivablesOpen] = useState(false);
  const [payablesOpen, setPayablesOpen] = useState(false);
  const [activeOrdersOpen, setActiveOrdersOpen] = useState(false);
  const [purchaseOrdersOpen, setPurchaseOrdersOpen] = useState(false);
  const [dueToReceiveOpen, setDueToReceiveOpen] = useState(false);
  const [payablesDue, setPayablesDue] = useState({});
  const [stats, setStats] = useState({
    orders: {},
    inventory: {},
    procurement: {},
    production: {},
    paymentDue: {},
  });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      const tasks = [];

      if (hasModuleAccess(user, 'pi') || dashboardRole === 'ADMIN') {
        tasks.push(['orders', ordersAPI.getStatistics()]);
      }
      if (hasModuleAccess(user, 'inventory') || dashboardRole === 'ADMIN') {
        tasks.push(['inventory', inventoryAPI.getStatistics()]);
      }
      if (hasModuleAccess(user, 'supplier_po') || dashboardRole === 'ADMIN') {
        tasks.push(['procurement', procurementAPI.getStatistics()]);
      }
      if (hasModuleAccess(user, 'production') || dashboardRole === 'ADMIN') {
        tasks.push(['production', productionAPI.getStatistics()]);
      }
      if (hasModuleAccess(user, 'sales') || dashboardRole === 'ADMIN') {
        tasks.push(['paymentDue', salesEntryAPI.getReceivablesSummary()]);
      }
      if (hasModuleAccess(user, 'purchase_bills') || dashboardRole === 'ADMIN') {
        tasks.push(['payables', purchaseBillAPI.getPayablesDueSummary()]);
      }

      const results = await Promise.allSettled(tasks.map(([, p]) => p));
      const next = { orders: {}, inventory: {}, procurement: {}, production: {}, paymentDue: {} };
      let payables = {};

      results.forEach((res, idx) => {
        const [key] = tasks[idx];
        if (res.status === 'fulfilled') {
          if (key === 'payables') payables = res.value.data;
          else next[key] = res.value.data;
        } else {
          console.error(`${key} stats:`, res.reason);
        }
      });

      setStats(next);
      setPayablesDue(payables);
      setLoading(false);
    };

    fetchStats();
  }, [user, dashboardRole]);

  if (loading) {
    return <DashboardLoading theme={theme} />;
  }

  const showOrders = hasModuleAccess(user, 'pi') || dashboardRole === 'ADMIN';
  const showInventory = hasModuleAccess(user, 'inventory') || dashboardRole === 'ADMIN';
  const showProcurement = hasModuleAccess(user, 'supplier_po') || dashboardRole === 'ADMIN';
  const showProduction = hasModuleAccess(user, 'production') || dashboardRole === 'ADMIN';
  const showReceivables = hasModuleAccess(user, 'sales') || dashboardRole === 'ADMIN';
  const showPayables = hasModuleAccess(user, 'purchase_bills') || dashboardRole === 'ADMIN';

  const renderRoleContent = () => {
    if (dashboardRole === 'MANAGER') {
      return (
        <>
          <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
            <Grid item xs={12} sm={6}>
              <StatCard
                accent="success"
                title="Inventory SKUs"
                value={stats.inventory.total_items || 0}
                subtitle="Tracked materials and trims"
                icon={<Inventory2 sx={{ fontSize: 24 }} />}
                onClick={() => navigate('/inventory')}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StatCard
                accent="warning"
                title="Low stock items"
                value={stats.inventory.low_stock_items || 0}
                subtitle="SKUs at or below reorder level"
                icon={<WarningAmber sx={{ fontSize: 24 }} />}
                onClick={() => navigate('/inventory')}
              />
            </Grid>
          </Grid>
          <Grid container spacing={{ xs: 2, sm: 2.5 }}>
            <Grid item xs={12} md={6}>
              <MaterialsRiskCard theme={theme} count={stats.inventory.low_stock_items || 0} />
            </Grid>
            <Grid item xs={12} md={6}>
              <SectionCard title="Quick links" subtitle="Jump to your workspace modules" accent="primary">
                <Stack spacing={1.5}>
                  <StatCard
                    accent="info"
                    title="Indents"
                    value="→"
                    subtitle="Create and manage material indents"
                    icon={<Assignment sx={{ fontSize: 24 }} />}
                    onClick={() => navigate('/indents')}
                  />
                  <StatCard
                    accent="success"
                    title="Inventory"
                    value="→"
                    subtitle="Stock levels and SKU management"
                    icon={<Inventory2 sx={{ fontSize: 24 }} />}
                    onClick={() => navigate('/inventory')}
                  />
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
        </>
      );
    }

    if (dashboardRole === 'MERCHANDISER') {
      return (
        <>
          <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
            <Grid item xs={12} sm={6}>
              <StatCard
                accent="info"
                title="Active orders"
                value={stats.orders.total_orders || 0}
                subtitle="PI records in the system"
                icon={<Assignment sx={{ fontSize: 24 }} />}
                onClick={() => setActiveOrdersOpen(true)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StatCard
                accent="primary"
                title="Indents"
                value="→"
                subtitle="Material indents for production"
                icon={<Factory sx={{ fontSize: 24 }} />}
                onClick={() => navigate('/indents')}
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
              <SectionCard title="Quick links" subtitle="Merchandising workflow" accent="primary">
                <Stack spacing={1.5}>
                  <StatCard accent="info" title="Buyer POs" value="→" subtitle="Buyer purchase orders" icon={<ShoppingCart sx={{ fontSize: 24 }} />} onClick={() => navigate('/buyer-pos')} />
                  <StatCard accent="secondary" title="Proforma invoices" value="→" subtitle="PI records and order pipeline" icon={<Assignment sx={{ fontSize: 24 }} />} onClick={() => navigate('/orders')} />
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
        </>
      );
    }

    if (dashboardRole === 'ACCOUNTS') {
      return (
        <Grid container spacing={{ xs: 2, sm: 2.5 }}>
          <Grid item xs={12}>
            <SectionCard
              title="Cash Flow — Due This Month"
              subtitle={`${stats.procurement.current_month || stats.paymentDue.current_month || 'Current month'} · Receivables and payables`}
              accent="primary"
              headerIcon={<AccountBalance sx={{ fontSize: 22 }} />}
            >
              <Stack spacing={1.5}>
                <PaymentDueRow
                  icon={<AccountBalanceWallet sx={{ fontSize: 22 }} />}
                  iconBg={alpha('#059669', 0.07)}
                  iconColor="#047857"
                  borderColor={alpha('#059669', 0.22)}
                  title="Receivables — To Be Collected"
                  description="Sales entries with balance due for collection this month"
                  amount={formatCurrency(stats.paymentDue.payments_due_to_collect?.total_amount, 'USD')}
                  count={stats.paymentDue.payments_due_to_collect?.count || 0}
                  countLabel="order(s)"
                  onClick={() => setReceivablesOpen(true)}
                />
                <PaymentDueRow
                  icon={<Payments sx={{ fontSize: 22 }} />}
                  iconBg={alpha(theme.palette.error.main, 0.07)}
                  iconColor={theme.palette.error.dark}
                  borderColor={alpha(theme.palette.error.main, 0.22)}
                  title="Payables — To Be Paid"
                  description="Purchase bills for material received — balance due this month"
                  amount={formatCurrency(payablesDue.payments_due_to_pay?.total_amount)}
                  count={payablesDue.payments_due_to_pay?.count || 0}
                  countLabel="bill(s)"
                  onClick={() => setPayablesOpen(true)}
                />
              </Stack>
            </SectionCard>
          </Grid>
        </Grid>
      );
    }

    if (dashboardRole === 'PURCHASING') {
      return (
        <>
          <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
            <Grid item xs={12} sm={6}>
              <StatCard
                accent="warning"
                title="Purchase orders"
                value={stats.procurement.total_pos || 0}
                subtitle="Vendor commitments and receipts"
                icon={<ShoppingCart sx={{ fontSize: 24 }} />}
                onClick={() => setPurchaseOrdersOpen(true)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StatCard
                accent="info"
                title="POs due to receive"
                value={stats.procurement.pos_due_to_receive?.count || 0}
                subtitle={`Expected in ${stats.procurement.current_month || 'this month'}`}
                icon={<LocalShipping sx={{ fontSize: 24 }} />}
                onClick={() => setDueToReceiveOpen(true)}
              />
            </Grid>
          </Grid>
          <Grid container spacing={{ xs: 2, sm: 2.5 }}>
            <Grid item xs={12} md={6}>
              <SectionCard title="Procurement health" subtitle="PO distribution by operational state" accent="warning">
                <StatusRows data={stats.procurement.by_status} />
              </SectionCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <SectionCard title="Quick links" subtitle="Procurement workflow" accent="primary">
                <Stack spacing={1.5}>
                  <StatCard accent="warning" title="Supplier POs" value="→" subtitle="Create and track vendor POs" icon={<ShoppingCart sx={{ fontSize: 24 }} />} onClick={() => navigate('/procurement')} />
                  <StatCard accent="info" title="Indents" value="→" subtitle="Material indents to fulfill" icon={<Assignment sx={{ fontSize: 24 }} />} onClick={() => navigate('/indents')} />
                </Stack>
              </SectionCard>
            </Grid>
          </Grid>
        </>
      );
    }

    // ADMIN — full plant dashboard
    return (
      <>
        <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
          {showOrders ? (
            <Grid item xs={12} sm={6} lg={3}>
              <StatCard accent="info" title="Active orders" value={stats.orders.total_orders || 0} subtitle="PI records in the system" icon={<Assignment sx={{ fontSize: 24 }} />} onClick={() => setActiveOrdersOpen(true)} />
            </Grid>
          ) : null}
          {showInventory ? (
            <Grid item xs={12} sm={6} lg={3}>
              <StatCard accent="success" title="Inventory SKUs" value={stats.inventory.total_items || 0} subtitle="Tracked materials and trims" icon={<Inventory2 sx={{ fontSize: 24 }} />} />
            </Grid>
          ) : null}
          {showProcurement ? (
            <Grid item xs={12} sm={6} lg={3}>
              <StatCard accent="warning" title="Purchase orders" value={stats.procurement.total_pos || 0} subtitle="Vendor commitments and receipts" icon={<ShoppingCart sx={{ fontSize: 24 }} />} onClick={() => setPurchaseOrdersOpen(true)} />
            </Grid>
          ) : null}
          {showProduction ? (
            <Grid item xs={12} sm={6} lg={3}>
              <StatCard accent="secondary" title="Production issues" value={stats.production.total_issues || 0} subtitle="Shop-floor material releases" icon={<Factory sx={{ fontSize: 24 }} />} />
            </Grid>
          ) : null}
        </Grid>

        {(showReceivables || showPayables || showProcurement) ? (
          <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: { xs: 2, sm: 2.5 } }}>
            {(showReceivables || showPayables) ? (
              <Grid item xs={12} md={6}>
                <SectionCard title="Cash Flow — Due This Month" subtitle={`${stats.procurement.current_month || stats.paymentDue.current_month || 'Current month'} · Receivables and payables`} accent="primary" headerIcon={<AccountBalance sx={{ fontSize: 22 }} />}>
                  <Stack spacing={1.5}>
                    {showReceivables ? (
                      <PaymentDueRow icon={<AccountBalanceWallet sx={{ fontSize: 22 }} />} iconBg={alpha('#059669', 0.07)} iconColor="#047857" borderColor={alpha('#059669', 0.22)} title="Receivables — To Be Collected" description="Sales entries with balance due for collection this month" amount={formatCurrency(stats.paymentDue.payments_due_to_collect?.total_amount, 'USD')} count={stats.paymentDue.payments_due_to_collect?.count || 0} countLabel="order(s)" onClick={() => setReceivablesOpen(true)} />
                    ) : null}
                    {showPayables ? (
                      <PaymentDueRow icon={<Payments sx={{ fontSize: 22 }} />} iconBg={alpha(theme.palette.error.main, 0.07)} iconColor={theme.palette.error.dark} borderColor={alpha(theme.palette.error.main, 0.22)} title="Payables — To Be Paid" description="Purchase bills for material received — balance due this month" amount={formatCurrency(payablesDue.payments_due_to_pay?.total_amount)} count={payablesDue.payments_due_to_pay?.count || 0} countLabel="bill(s)" onClick={() => setPayablesOpen(true)} />
                    ) : null}
                  </Stack>
                </SectionCard>
              </Grid>
            ) : null}
            {showProcurement ? (
              <Grid item xs={12} md={6}>
                <SectionCard title="Supplier POs due to receive" subtitle={`Expected deliveries in ${stats.procurement.current_month || 'this month'}`} accent="info" headerIcon={<LocalShipping sx={{ fontSize: 22 }} />}>
                  <Box component="button" type="button" onClick={() => setDueToReceiveOpen(true)} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.5, px: 1.75, width: '100%', textAlign: 'left', borderRadius: '10px', bgcolor: alpha(theme.palette.info.main, 0.07), border: `1px solid ${alpha(theme.palette.info.main, 0.22)}`, cursor: 'pointer', font: 'inherit', fontFamily: 'inherit', transition: 'transform 0.15s ease, box-shadow 0.15s ease', '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }, '&:focus-visible': { outline: `2px solid ${theme.palette.info.main}`, outlineOffset: 2 } }}>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ width: 56, height: 56, borderRadius: '12px', display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: alpha(theme.palette.info.main, 0.12), border: `1px solid ${alpha(theme.palette.info.main, 0.35)}`, color: 'info.dark' }}>
                        <LocalShipping sx={{ fontSize: 30 }} />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h3" className="font-numeric" sx={{ fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: 'info.dark' }}>
                          {stats.procurement.pos_due_to_receive?.count || 0}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
                          supplier PO(s) expected for delivery this month
                        </Typography>
                      </Box>
                    </Stack>
                    <ChevronRight sx={{ fontSize: 20, color: 'text.disabled', flexShrink: 0 }} />
                  </Box>
                </SectionCard>
              </Grid>
            ) : null}
          </Grid>
        ) : null}

        <Grid container spacing={{ xs: 2, sm: 2.5 }}>
          {showOrders ? (
            <Grid item xs={12} md={6}>
              <SectionCard title="Orders by status" subtitle="Pipeline distribution across PI lifecycle" accent="info">
                <StatusRows data={stats.orders.by_status} />
              </SectionCard>
            </Grid>
          ) : null}
          {showInventory ? (
            <Grid item xs={12} md={6}>
              <MaterialsRiskCard theme={theme} count={stats.inventory.low_stock_items || 0} />
            </Grid>
          ) : null}
          {showProcurement ? (
            <Grid item xs={12} md={6}>
              <SectionCard title="Procurement health" subtitle="PO distribution by operational state" accent="warning">
                <StatusRows data={stats.procurement.by_status} />
              </SectionCard>
            </Grid>
          ) : null}
          {showProduction ? (
            <Grid item xs={12} md={6}>
              <SectionCard title="Production movement" subtitle="Issues tracked through the shop floor" accent="secondary">
                <StatusRows data={stats.production.by_status} />
              </SectionCard>
            </Grid>
          ) : null}
        </Grid>
      </>
    );
  };

  return (
    <Box>
      {renderRoleContent()}

      {showReceivables ? (
        <ReceivablesDueModal open={receivablesOpen} onClose={() => setReceivablesOpen(false)} monthLabel={stats.paymentDue.current_month || stats.procurement.current_month} summary={stats.paymentDue.payments_due_to_collect} items={stats.paymentDue.payments_due_to_collect?.items || []} />
      ) : null}

      {showPayables ? (
        <PayablesDueModal open={payablesOpen} onClose={() => setPayablesOpen(false)} monthLabel={payablesDue.current_month || stats.procurement.current_month || stats.paymentDue.current_month} summary={payablesDue.payments_due_to_pay} items={payablesDue.payments_due_to_pay?.items || []} />
      ) : null}

      {showOrders ? (
        <ActiveOrdersModal open={activeOrdersOpen} onClose={() => setActiveOrdersOpen(false)} totalCount={stats.orders.total_orders || 0} />
      ) : null}

      {showProcurement ? (
        <>
          <PurchaseOrdersModal open={purchaseOrdersOpen} onClose={() => setPurchaseOrdersOpen(false)} totalCount={stats.procurement.total_pos || 0} />
          <PosDueToReceiveModal open={dueToReceiveOpen} onClose={() => setDueToReceiveOpen(false)} monthLabel={stats.procurement.current_month} summary={stats.procurement.pos_due_to_receive} items={stats.procurement.pos_due_to_receive?.items || []} />
        </>
      ) : null}
    </Box>
  );
};

export default Dashboard;
