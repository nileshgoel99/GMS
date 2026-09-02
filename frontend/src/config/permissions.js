/** Available permission modules — labels synced with backend accounts/roles.py */

export const ALL_MODULES = [
  { key: 'dashboard', label: 'Plant dashboard' },
  { key: 'customers', label: 'Buyers' },
  { key: 'buyer_pos', label: 'Buyer POs' },
  { key: 'pi', label: 'Proforma invoices' },
  { key: 'indents', label: 'Indents' },
  { key: 'trims', label: 'Trims library' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'inventory', label: 'Inventory / stock' },
  { key: 'sales', label: 'Sales entry (incoming payments)' },
  { key: 'purchase_bills', label: 'Purchase bills (outgoing payments)' },
  { key: 'supplier_po', label: 'Supplier POs' },
  { key: 'production', label: 'Production' },
  { key: 'company', label: 'Company details' },
  { key: 'users', label: 'Users & roles' },
];

/** Nav / route path → permission module */
export const PATH_MODULE_MAP = [
  { prefix: '/users', module: 'users' },
  { prefix: '/company', module: 'company' },
  { prefix: '/customers', module: 'customers' },
  { prefix: '/buyer-pos', module: 'buyer_pos' },
  { prefix: '/orders', module: 'pi' },
  { prefix: '/indents', module: 'indents' },
  { prefix: '/trims', module: 'trims' },
  { prefix: '/suppliers', module: 'suppliers' },
  { prefix: '/inventory', module: 'inventory' },
  { prefix: '/sales', module: 'sales' },
  { prefix: '/purchase-bills', module: 'purchase_bills' },
  { prefix: '/procurement', module: 'supplier_po' },
  { prefix: '/production', module: 'production' },
];

export const moduleForPath = (pathname) => {
  // Home dashboard is role-specific and open to all authenticated users.
  if (pathname === '/' || pathname === '') return null;
  const sorted = [...PATH_MODULE_MAP].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const { prefix, module, exact } of sorted) {
    if (exact) continue;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return module;
  }
  return null;
};

export const DASHBOARD_TITLES = {
  ADMIN: 'Plant dashboard',
  MANAGER: 'Manager dashboard',
  MERCHANDISER: 'Merchandiser dashboard',
  ACCOUNTS: 'Accounts dashboard',
  PURCHASING: 'Purchasing dashboard',
};

export const dashboardTitleForUser = (user) =>
  DASHBOARD_TITLES[user?.role] || `${user?.role_label || 'Workspace'} dashboard`;

/** First nav path the user can access (fallback when a deep link is denied). */
export const getHomePath = (user) => {
  if (!user) return '/login';
  const paths = [
    ['/', null],
    ['/indents', 'indents'],
    ['/inventory', 'inventory'],
    ['/buyer-pos', 'buyer_pos'],
    ['/orders', 'pi'],
    ['/sales', 'sales'],
    ['/purchase-bills', 'purchase_bills'],
    ['/procurement', 'supplier_po'],
  ];
  for (const [path, module] of paths) {
    if (!module || hasModuleAccess(user, module)) return path;
  }
  return '/';
};

/** Modules implicitly granted when another module is assigned. */
const IMPLIED_MODULES = {
  trims: ['indents'],
};

export const isAdminUser = (user) => Boolean(user?.is_admin || user?.role === 'ADMIN');

export const hasModuleAccess = (user, module) => {
  if (!module) return true;
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const mods = user.modules;
  if (mods?.includes('*')) return true;
  if (mods?.includes(module)) return true;
  const impliedBy = IMPLIED_MODULES[module];
  if (impliedBy?.some((m) => mods?.includes(m))) return true;
  return false;
};

export const canAccessPath = (user, pathname) => hasModuleAccess(user, moduleForPath(pathname));

export const moduleLabel = (key) => ALL_MODULES.find((m) => m.key === key)?.label || key;
