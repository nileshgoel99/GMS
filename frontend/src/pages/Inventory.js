import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  InputAdornment,
  Alert,
  Snackbar,
  Divider,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  Autocomplete,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  Search,
  Warning,
  Inventory2,
  History,
  Close,
  Assignment,
  Layers,
  GridView,
  LocalOffer,
  ViewWeek,
  LinearScale,
  RadioButtonChecked,
  Timeline,
  ShoppingBag,
  Category as CategoryIcon,
  ChevronRight,
  Style,
  Business,
  FileDownload,
  Description,
  Send,
  AccessTime,
  DonutLarge,
  Palette,
  Straighten,
  Link as LinkIcon,
  Tag,
  FiberManualRecord,
  ExpandMore,
  ExpandLess,
  Unarchive,
  AddBox,
  Add,
  Edit,
  DeleteOutline,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import PageHeader from '../components/PageHeader';
import { InventoryItemFull } from '../components/inventory/InventoryItemParticulars';
import AddTrimModal from '../components/trims/AddTrimModal';
import { extractTrimProperties, getItemDisplayName } from '../utils/extractTrimProperties';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { inventoryAPI, ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isAdminUser } from '../config/permissions';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);
const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtQty = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return '—';
  const rounded = Math.round(n * 1e4) / 1e4;
  return rounded.toLocaleString(undefined, {
    maximumFractionDigits: 4,
    minimumFractionDigits: 0,
  });
};

const headCellSx = {
  fontWeight: 700,
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: slate[700],
  py: 1.1,
  bgcolor: alpha('#0f766e', 0.06),
  borderBottom: `2px solid ${alpha('#0f766e', 0.18)}`,
  whiteSpace: 'nowrap',
};

const itemSearchHaystack = (row) => {
  const props = extractTrimProperties(row);
  return [
    row.item_code,
    row.item_name,
    row.trim_name,
    row.name,
    getItemDisplayName(row),
    row.category,
    row.unit,
    ...(row.property_lines || []),
    ...props.flatMap((p) => [p.label, p.value]),
    ...(row.suppliers || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const matchesSearch = (row, query) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = itemSearchHaystack(row);
  return tokens.every((t) => hay.includes(t));
};

const stockTone = (row) => {
  const qty = parseFloat(row.current_stock) || 0;
  if (qty <= 0) return { key: 'empty', color: slate[500] };
  if (row.needs_reorder) return { key: 'low', color: '#b45309' };
  return { key: 'ok', color: '#047857' };
};

const FilterChip = ({ active, label, count, onClick, color = 'default' }) => (
  <Chip
    label={count != null ? `${label} · ${count}` : label}
    onClick={onClick}
    size="small"
    color={active ? (color === 'warning' ? 'warning' : 'primary') : 'default'}
    variant={active ? 'filled' : 'outlined'}
    sx={{
      fontWeight: 700,
      fontSize: '0.72rem',
      height: 28,
      borderRadius: 1.5,
      ...(active && color === 'default' ? {} : {}),
      ...(!active ? { borderColor: slate[200], color: slate[700] } : {}),
    }}
  />
);

const CATEGORY_CARD_META = {
  _ALL: {
    label: 'Total SKUs',
    sub: 'All items',
    color: '#059669',
    Icon: Layers,
  },
  FABRIC: {
    label: 'Fabric',
    sub: 'Categories',
    color: '#2563eb',
    Icon: GridView,
  },
  LABEL: {
    label: 'Label',
    sub: 'Categories',
    color: '#7c3aed',
    Icon: LocalOffer,
  },
  TAPE: {
    label: 'Tape',
    sub: 'Categories',
    color: '#ea580c',
    Icon: ViewWeek,
  },
  ZIPPER: {
    label: 'Zipper',
    sub: 'Categories',
    color: '#0d9488',
    Icon: LinearScale,
  },
  BUTTON: {
    label: 'Button',
    sub: 'Categories',
    color: '#db2777',
    Icon: RadioButtonChecked,
  },
  THREAD: {
    label: 'Thread',
    sub: 'Categories',
    color: '#ca8a04',
    Icon: Timeline,
  },
  POLYBAG: {
    label: 'Polybag',
    sub: 'Categories',
    color: '#0891b2',
    Icon: ShoppingBag,
  },
  OTHER: {
    label: 'Other',
    sub: 'Categories',
    color: '#64748b',
    Icon: CategoryIcon,
  },
};

const CATEGORY_CARD_ORDER = [
  'FABRIC',
  'LABEL',
  'TAPE',
  'ZIPPER',
  'BUTTON',
  'THREAD',
  'POLYBAG',
  'OTHER',
];

const UNIT_OPTIONS = ['PCS', 'MTR', 'KG', 'ROLL', 'BOX', 'SET'];

const emptyItemEdit = () => ({
  item_code: '',
  name: '',
  category: 'OTHER',
  color: '',
  size: '',
  unit: 'PCS',
  reorder_level: '',
  unit_cost: '',
  description: '',
});

const formatAuditWhen = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return formatDateDisplay(value);
  return `${formatDateDisplay(value)} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

const formatAuditChange = (field, change) => {
  const label = field.replace(/_/g, ' ');
  if (change && typeof change === 'object' && ('old' in change || 'new' in change)) {
    const oldVal = change.old == null || change.old === '' ? '—' : String(change.old);
    const newVal = change.new == null || change.new === '' ? '—' : String(change.new);
    return `${label}: ${oldVal} → ${newVal}`;
  }
  return `${label}: ${change == null || change === '' ? '—' : String(change)}`;
};

const SummaryStatCard = ({ meta, count, onClick }) => {
  const { label, sub, color, Icon } = meta;
  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      sx={{
        flex: '1 1 160px',
        minWidth: 150,
        maxWidth: 220,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.75,
        py: 1.5,
        borderRadius: 2.5,
        bgcolor: '#fff',
        border: `1px solid ${slate[200]}`,
        borderLeft: `4px solid ${color}`,
        boxShadow: `0 1px 3px ${alpha(slate[900], 0.06)}`,
        cursor: 'pointer',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 6px 16px ${alpha(slate[900], 0.1)}`,
        },
        '&:focus-visible': {
          outline: `2px solid ${color}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 42,
          height: 42,
          borderRadius: '50%',
          bgcolor: alpha(color, 0.12),
          color,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 22 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          className="font-numeric"
          sx={{
            fontWeight: 800,
            fontSize: '1.55rem',
            color: slate[900],
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: slate[800], lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 500, color: slate[500] }}>
          {sub}
        </Typography>
      </Box>
    </Box>
  );
};

const CATEGORY_MODAL_GREEN = '#0b5c4d';

const propertyIconForLabel = (label) => {
  const l = (label || '').toLowerCase();
  if (l.includes('color') || l.includes('colour')) return Palette;
  if (l.includes('size') || l.includes('width') || l.includes('length') || l.includes('cms')) return Straighten;
  if (l.includes('material') || l.includes('chain') || l.includes('fabric')) return LinkIcon;
  if (l.includes('number') || l.includes('#') || l === 'no' || l === 'no.') return Tag;
  if (l.includes('type') || l.includes('puller') || l.includes('end')) return CategoryIcon;
  return Style;
};

const SpecPropertyChip = ({ label, value, accent }) => {
  const Icon = propertyIconForLabel(label);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.65,
        px: 0.85,
        py: 0.55,
        borderRadius: 1.25,
        bgcolor: alpha(accent, 0.06),
        border: `1px solid ${alpha(accent, 0.16)}`,
        minWidth: 0,
      }}
    >
      <Icon sx={{ fontSize: 14, color: accent, mt: '1px', flexShrink: 0 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.58rem',
            fontWeight: 700,
            color: slate[500],
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 800,
            color: slate[800],
            lineHeight: 1.25,
            wordBreak: 'break-word',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
};

const StockStatusBadge = ({ tone }) => {
  const map = {
    ok: { label: 'In Stock', color: '#15803d', bg: alpha('#22c55e', 0.12) },
    low: { label: 'Low Stock', color: '#b45309', bg: alpha('#f59e0b', 0.14) },
    empty: { label: 'Out of Stock', color: slate[600], bg: alpha(slate[500], 0.12) },
  };
  const s = map[tone] || map.ok;
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.45,
        px: 0.85,
        py: 0.25,
        borderRadius: 999,
        bgcolor: s.bg,
      }}
    >
      <FiberManualRecord sx={{ fontSize: 8, color: s.color }} />
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: s.color, lineHeight: 1.2 }}>
        {s.label}
      </Typography>
    </Box>
  );
};

const getItemSku = (row) =>
  row.item_code || row.sku || row.code || (row.id != null ? String(row.id) : '—');

/** Gray bordered "Label: Value" pills for the inventory table */
const SpecPills = ({ item, limit = 4 }) => {
  const properties = extractTrimProperties(item || {}).slice(0, limit);
  if (!properties.length) {
    return <Typography sx={{ fontSize: '0.78rem', color: slate[400] }}>—</Typography>;
  }
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.55 }}>
      {properties.map(({ label, value }) => (
        <Box
          key={`${label}-${value}`}
          sx={{
            px: 0.95,
            py: 0.35,
            borderRadius: 999,
            bgcolor: slate[50],
            border: `1px solid ${slate[200]}`,
          }}
        >
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: slate[700], lineHeight: 1.3 }}>
            <Box component="span" sx={{ color: slate[500], fontWeight: 600 }}>{label}: </Box>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

const INVENTORY_TABLE_COLS = {
  xs: 'minmax(0, 1fr) auto auto',
  md: 'minmax(150px, 1.15fr) minmax(140px, 1.4fr) minmax(90px, 0.7fr) 76px 92px 204px',
};

const inventoryActionBtnSx = (color, hoverBg) => ({
  width: 30,
  height: 30,
  color,
  '&:hover': { color, bgcolor: hoverBg },
  '&.Mui-disabled': { color: slate[300] },
});

const Inventory = () => {
  const { user } = useAuth();
  const canManageItems = isAdminUser(user);
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // all | low | zero
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [detailItem, setDetailItem] = useState(null);
  const [summary, setSummary] = useState(null);
  const [categoryModal, setCategoryModal] = useState(null); // { key, label, color, Icon, items }
  const [categoryModalTab, setCategoryModalTab] = useState('history'); // history | release | details
  const [collapsedCategories, setCollapsedCategories] = useState(() => new Set());
  const [releaseItem, setReleaseItem] = useState(null);
  const [releaseQty, setReleaseQty] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [openingItem, setOpeningItem] = useState(null);
  const [openingQty, setOpeningQty] = useState('');
  const [openingRemarks, setOpeningRemarks] = useState('');
  const [openingDate, setOpeningDate] = useState(todayIso);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [newOpeningOpen, setNewOpeningOpen] = useState(false);
  const [newOpeningMode, setNewOpeningMode] = useState('library'); // library | create
  const [trimOptions, setTrimOptions] = useState([]);
  const [trimsLoading, setTrimsLoading] = useState(false);
  const [selectedTrim, setSelectedTrim] = useState(null);
  const [propertyValues, setPropertyValues] = useState({});
  const [trimModalOpen, setTrimModalOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' });
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState(emptyItemEdit);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const searchRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, lowRes, statsRes] = await Promise.all([
        inventoryAPI.getAll({ is_active: true }),
        inventoryAPI.getLowStock(),
        inventoryAPI.getStatistics(),
      ]);
      setItems(asList(itemsRes.data));
      setLowStockItems(asList(lowRes.data));
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      setSnack({ open: true, message: 'Failed to load inventory', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lowIdSet = useMemo(() => new Set(lowStockItems.map((r) => r.id)), [lowStockItems]);

  const categories = useMemo(() => {
    const map = new Map();
    items.forEach((row) => {
      const cat = (row.category || 'OTHER').toUpperCase();
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  const summaryCards = useMemo(() => {
    const byCat = new Map(categories);
    const cards = [
      {
        key: '_ALL',
        meta: CATEGORY_CARD_META._ALL,
        count: items.length,
        items,
      },
    ];
    CATEGORY_CARD_ORDER.forEach((key) => {
      const count = byCat.get(key) || 0;
      if (!count) return;
      const meta = CATEGORY_CARD_META[key] || {
        label: key,
        sub: 'Categories',
        color: '#64748b',
        Icon: CategoryIcon,
      };
      cards.push({
        key,
        meta,
        count,
        items: items.filter((r) => (r.category || 'OTHER').toUpperCase() === key),
      });
    });
    // Any unexpected categories not in the preferred order
    categories.forEach(([key, count]) => {
      if (CATEGORY_CARD_ORDER.includes(key) || !count) return;
      cards.push({
        key,
        meta: CATEGORY_CARD_META[key] || {
          label: key.charAt(0) + key.slice(1).toLowerCase(),
          sub: 'Categories',
          color: '#64748b',
          Icon: CategoryIcon,
        },
        count,
        items: items.filter((r) => (r.category || 'OTHER').toUpperCase() === key),
      });
    });
    return cards;
  }, [categories, items]);

  const openCategoryModal = (card) => {
    setCategoryModalTab('history');
    setCategoryModal({
      key: card.key,
      label: card.meta.label,
      color: card.meta.color || CATEGORY_MODAL_GREEN,
      Icon: card.meta.Icon || CategoryIcon,
      items: card.items,
    });
  };

  const closeCategoryModal = () => {
    setCategoryModal(null);
    setCategoryModalTab('history');
  };

  const categoryModalStats = useMemo(() => {
    const rows = categoryModal?.items || [];
    const totalItems = rows.length;
    let totalStock = 0;
    let lowCount = 0;
    let zeroCountLocal = 0;
    let inStockCount = 0;
    const units = new Set();
    rows.forEach((row) => {
      const qty = parseFloat(row.current_stock) || 0;
      totalStock += qty;
      if (qty <= 0) zeroCountLocal += 1;
      else if (row.needs_reorder || lowIdSet.has(row.id)) lowCount += 1;
      else inStockCount += 1;
      if (row.unit) units.add(row.unit);
    });
    return {
      totalItems,
      totalStock,
      lowCount,
      zeroCount: zeroCountLocal,
      inStockCount,
      unitLabel: units.size === 1 ? [...units][0] : units.size > 1 ? 'mixed' : '',
    };
  }, [categoryModal, lowIdSet]);

  const exportCategoryModalCsv = () => {
    if (!categoryModal?.items?.length) return;
    const rows = [...categoryModal.items].sort((a, b) =>
      getItemDisplayName(a).localeCompare(getItemDisplayName(b)),
    );
    const header = ['SKU', 'Name', 'Category', 'Specifications', 'Supplier', 'Stock', 'Unit', 'Status'];
    const lines = rows.map((row) => {
      const tone = stockTone(row);
      const status = tone.key === 'empty' ? 'Out of Stock' : tone.key === 'low' ? 'Low Stock' : 'In Stock';
      const specs = extractTrimProperties(row)
        .map((p) => `${p.label}: ${p.value}`)
        .join('; ');
      const cells = [
        getItemSku(row),
        getItemDisplayName(row),
        row.category || categoryModal.label,
        specs,
        (row.suppliers || []).join('; '),
        fmtQty(row.current_stock),
        row.unit || '',
        status,
      ];
      return cells.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(categoryModal.label || 'inventory').toLowerCase().replace(/\s+/g, '-')}-stock.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    let rows = items;
    if (stockFilter === 'low') {
      rows = rows.filter((r) => lowIdSet.has(r.id) || r.needs_reorder);
    } else if (stockFilter === 'zero') {
      rows = rows.filter((r) => (parseFloat(r.current_stock) || 0) <= 0);
    }
    if (categoryFilter) {
      rows = rows.filter((r) => (r.category || '').toUpperCase() === categoryFilter);
    }
    rows = rows.filter((r) => matchesSearch(r, search));
    return [...rows].sort((a, b) => {
      const na = getItemDisplayName(a).localeCompare(getItemDisplayName(b));
      if (na !== 0) return na;
      return String(a.id).localeCompare(String(b.id));
    });
  }, [items, stockFilter, categoryFilter, search, lowIdSet]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((row) => {
      const cat = (row.category || 'OTHER').toUpperCase();
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat).push(row);
    });
    const orderIndex = (key) => {
      const i = CATEGORY_CARD_ORDER.indexOf(key);
      return i === -1 ? 999 : i;
    };
    return [...map.entries()].sort((a, b) => {
      const oi = orderIndex(a[0]) - orderIndex(b[0]);
      if (oi !== 0) return oi;
      return a[0].localeCompare(b[0]);
    });
  }, [filtered]);

  const toggleCategoryCollapse = (cat) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const zeroCount = useMemo(
    () => items.filter((r) => (parseFloat(r.current_stock) || 0) <= 0).length,
    [items],
  );

  const openDetail = async (item) => {
    setDetailItem(item);
    try {
      const res = await inventoryAPI.getSummary(item.id);
      setSummary(res.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setSnack({ open: true, message: 'Failed to load item details', severity: 'error' });
    }
  };

  const closeDetail = () => {
    setDetailItem(null);
    setSummary(null);
  };

  const fillEditForm = (src) => {
    setEditForm({
      item_code: src.item_code || '',
      name: src.name || '',
      category: src.category || 'OTHER',
      color: src.color || '',
      size: src.size || '',
      unit: src.unit || 'PCS',
      reorder_level: src.reorder_level != null ? String(src.reorder_level) : '',
      unit_cost: src.unit_cost != null ? String(src.unit_cost) : '',
      description: src.description || '',
    });
  };

  const openEditItem = async (item, e) => {
    e?.stopPropagation();
    setEditItem(item);
    fillEditForm(summary?.id === item.id ? summary : item);
    try {
      const res = await inventoryAPI.getById(item.id);
      fillEditForm(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const closeEditItem = () => {
    setEditItem(null);
    setEditForm(emptyItemEdit());
  };

  const handleSaveItem = async () => {
    if (!editItem) return;
    if (!editForm.item_code.trim() || !editForm.name.trim()) {
      setSnack({ open: true, message: 'Item code and name are required', severity: 'warning' });
      return;
    }
    setEditLoading(true);
    const savedId = editItem.id;
    try {
      await inventoryAPI.patch(savedId, {
        item_code: editForm.item_code.trim(),
        name: editForm.name.trim(),
        category: editForm.category,
        color: editForm.color.trim() || null,
        size: editForm.size.trim() || null,
        unit: editForm.unit,
        reorder_level: editForm.reorder_level === '' ? 0 : editForm.reorder_level,
        unit_cost: editForm.unit_cost === '' ? null : editForm.unit_cost,
        description: editForm.description.trim() || null,
      });
      setSnack({ open: true, message: 'Inventory item updated', severity: 'success' });
      closeEditItem();
      await fetchAll();
      if (detailItem?.id === savedId) {
        await openDetail({ id: savedId, ...editForm });
      }
    } catch (error) {
      const data = error.response?.data;
      const msg = data?.detail
        || data?.item_code?.[0]
        || (typeof data === 'object' ? JSON.stringify(data) : null)
        || 'Update failed';
      setSnack({ open: true, message: msg, severity: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  const openDeleteItem = (item, e) => {
    e?.stopPropagation();
    setDeleteItem(item);
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    setDeleteLoading(true);
    try {
      await inventoryAPI.delete(deleteItem.id);
      setSnack({ open: true, message: 'Inventory item removed', severity: 'success' });
      setDeleteItem(null);
      if (detailItem?.id === deleteItem.id) closeDetail();
      await fetchAll();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Delete failed';
      setSnack({ open: true, message: msg, severity: 'error' });
    } finally {
      setDeleteLoading(false);
    }
  };

  const openRelease = (item, e) => {
    e?.stopPropagation?.();
    setReleaseItem(item);
    setReleaseQty('');
    setReleaseRemarks('');
  };

  const closeRelease = () => {
    setReleaseItem(null);
    setReleaseQty('');
    setReleaseRemarks('');
  };

  const handleRelease = async () => {
    if (!releaseItem) return;
    const qty = parseFloat(releaseQty);
    if (!qty || qty <= 0) {
      setSnack({ open: true, message: 'Enter a valid release quantity', severity: 'warning' });
      return;
    }
    if (qty > parseFloat(releaseItem.current_stock)) {
      setSnack({
        open: true,
        message: `Cannot release more than ${fmtQty(releaseItem.current_stock)} ${releaseItem.unit}`,
        severity: 'warning',
      });
      return;
    }

    setReleaseLoading(true);
    try {
      await inventoryAPI.release(releaseItem.id, {
        quantity: qty,
        remarks: releaseRemarks,
      });
      setSnack({
        open: true,
        message: `Released ${fmtQty(qty)} ${releaseItem.unit} to production`,
        severity: 'success',
      });
      closeRelease();
      if (detailItem?.id === releaseItem.id) closeDetail();
      fetchAll();
    } catch (error) {
      const msg = error.response?.data?.quantity || error.response?.data?.detail || 'Release failed';
      setSnack({ open: true, message: String(msg), severity: 'error' });
    } finally {
      setReleaseLoading(false);
    }
  };

  const openOpeningStock = (item, e) => {
    e?.stopPropagation?.();
    setOpeningItem(item);
    setOpeningQty('');
    setOpeningRemarks('');
    setOpeningDate(todayIso());
  };

  const closeOpeningStock = () => {
    setOpeningItem(null);
    setOpeningQty('');
    setOpeningRemarks('');
    setOpeningDate(todayIso());
  };

  const handleOpeningStock = async () => {
    if (!openingItem) return;
    const qty = parseFloat(openingQty);
    if (!qty || qty <= 0) {
      setSnack({ open: true, message: 'Enter a valid opening stock quantity', severity: 'warning' });
      return;
    }
    if (!openingDate) {
      setSnack({ open: true, message: 'Opening stock date is required', severity: 'warning' });
      return;
    }

    setOpeningLoading(true);
    try {
      await inventoryAPI.addOpeningStock(openingItem.id, {
        quantity: qty,
        remarks: openingRemarks,
        transaction_date: openingDate,
      });
      setSnack({
        open: true,
        message: `Added opening stock of ${fmtQty(qty)} ${openingItem.unit}`,
        severity: 'success',
      });
      closeOpeningStock();
      fetchAll();
      if (detailItem?.id === openingItem.id) {
        openDetail({
          ...openingItem,
          current_stock: (parseFloat(openingItem.current_stock) || 0) + qty,
        });
      }
    } catch (error) {
      const msg = error.response?.data?.quantity
        || error.response?.data?.transaction_date
        || error.response?.data?.detail
        || 'Failed to add opening stock';
      setSnack({ open: true, message: String(Array.isArray(msg) ? msg[0] : msg), severity: 'error' });
    } finally {
      setOpeningLoading(false);
    }
  };

  const loadTrimOptions = useCallback(async () => {
    setTrimsLoading(true);
    try {
      const res = await ordersAPI.getTrimsMaster({ page_size: 500 });
      setTrimOptions(asList(res.data));
    } catch (e) {
      console.error(e);
      setSnack({ open: true, message: 'Could not load trim library', severity: 'error' });
    } finally {
      setTrimsLoading(false);
    }
  }, []);

  const openNewOpeningStock = () => {
    setNewOpeningOpen(true);
    setNewOpeningMode('library');
    setSelectedTrim(null);
    setPropertyValues({});
    setOpeningQty('');
    setOpeningRemarks('');
    setOpeningDate(todayIso());
    loadTrimOptions();
  };

  const closeNewOpeningStock = () => {
    if (openingLoading) return;
    setNewOpeningOpen(false);
    setSelectedTrim(null);
    setPropertyValues({});
    setOpeningQty('');
    setOpeningRemarks('');
    setOpeningDate(todayIso());
  };

  const handleTrimCreatedForOpening = (trim) => {
    setTrimModalOpen(false);
    setSelectedTrim(trim);
    setNewOpeningMode('library');
    setPropertyValues({});
    setTrimOptions((prev) => {
      if (prev.some((t) => t.id === trim.id)) return prev;
      return [trim, ...prev];
    });
    setSnack({
      open: true,
      message: `Trim “${trim.name}” created — enter opening stock below`,
      severity: 'success',
    });
  };

  const handleCreateWithOpeningStock = async () => {
    if (!selectedTrim?.id) {
      setSnack({
        open: true,
        message: newOpeningMode === 'create'
          ? 'Create a trim first, then enter opening stock'
          : 'Select a trim from the library',
        severity: 'warning',
      });
      return;
    }
    const qty = parseFloat(openingQty);
    if (!qty || qty <= 0) {
      setSnack({ open: true, message: 'Enter a valid opening stock quantity', severity: 'warning' });
      return;
    }
    if (!openingDate) {
      setSnack({ open: true, message: 'Opening stock date is required', severity: 'warning' });
      return;
    }

    setOpeningLoading(true);
    try {
      const res = await inventoryAPI.createWithOpeningStock({
        trim_id: selectedTrim.id,
        property_values: propertyValues,
        quantity: qty,
        remarks: openingRemarks,
        transaction_date: openingDate,
      });
      const unit = res.data?.item?.unit || selectedTrim.default_unit || 'PCS';
      setSnack({
        open: true,
        message: `Opening stock of ${fmtQty(qty)} ${unit} added for ${selectedTrim.name}`,
        severity: 'success',
      });
      closeNewOpeningStock();
      fetchAll();
    } catch (error) {
      const data = error.response?.data;
      const msg = data?.quantity || data?.trim || data?.trim_id || data?.transaction_date
        || data?.detail || (typeof data === 'object' ? JSON.stringify(data) : null)
        || 'Failed to add opening stock';
      setSnack({ open: true, message: String(Array.isArray(msg) ? msg[0] : msg), severity: 'error' });
    } finally {
      setOpeningLoading(false);
    }
  };

  const logLabel = (type, log) => {
    if (type === 'ADJUST' && (log?.reference_type === 'OPENING' || log?.reference_number === 'Opening stock')) {
      return 'Opening stock';
    }
    const map = {
      RECEIVE: 'Received',
      ISSUE: 'Released',
      ORDER: 'Ordered',
      RETURN: 'Return',
      ADJUST: 'Adjustment',
    };
    return map[type] || type;
  };

  const logDate = (log) => log?.effective_date || log?.transaction_date || log?.created_at;

  const clearFilters = () => {
    setSearch('');
    setStockFilter('all');
    setCategoryFilter(null);
    searchRef.current?.focus();
  };

  const hasActiveFilters = Boolean(search.trim() || stockFilter !== 'all' || categoryFilter);

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1400, mx: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2,
          width: '100%',
        }}
      >
        <PageHeader
          kicker="Materials"
          title="Inventory"
          subtitle="Search by trim name, color, size, or supplier — click a row for history"
          compact
        />
        <Button
          variant="contained"
          startIcon={<AddBox />}
          onClick={openNewOpeningStock}
          sx={{
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: 1.5,
            ml: 'auto',
            flexShrink: 0,
            alignSelf: { xs: 'stretch', sm: 'flex-start' },
          }}
        >
          Add opening stock
        </Button>
      </Box>

      {/* Category summary cards */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.5,
          mb: 2.5,
        }}
      >
        {summaryCards.map((card) => (
          <SummaryStatCard
            key={card.key}
            meta={card.meta}
            count={card.count}
            onClick={() => openCategoryModal(card)}
          />
        ))}
      </Box>

      {/* Search & filters */}
      <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(0), mb: 2, p: { xs: 1.5, sm: 2 } }}>
        <TextField
          fullWidth
          inputRef={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search trim, color, width, size, supplier…"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: slate[400] }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {search ? (
                  <IconButton size="small" onClick={() => setSearch('')} edge="end" aria-label="Clear search">
                    <Close fontSize="small" />
                  </IconButton>
                ) : (
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: slate[400],
                      border: `1px solid ${slate[200]}`,
                      borderRadius: 1,
                      px: 0.75,
                      py: 0.25,
                      display: { xs: 'none', sm: 'inline' },
                    }}
                  >
                    ⌘K
                  </Typography>
                )}
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            '& .MuiInputBase-root': {
              borderRadius: 2,
              bgcolor: slate[50],
              fontSize: '0.95rem',
              fontWeight: 600,
            },
          }}
        />

        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" alignItems="center">
          <FilterChip
            label="All"
            count={items.length}
            active={stockFilter === 'all' && !categoryFilter}
            onClick={() => { setStockFilter('all'); setCategoryFilter(null); }}
          />
          <FilterChip
            label="Low stock"
            count={lowStockItems.length}
            active={stockFilter === 'low'}
            color="warning"
            onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
          />
          {zeroCount > 0 && (
            <FilterChip
              label="Empty"
              count={zeroCount}
              active={stockFilter === 'zero'}
              onClick={() => setStockFilter(stockFilter === 'zero' ? 'all' : 'zero')}
            />
          )}
          <Box sx={{ width: 1, height: 20, bgcolor: slate[200], mx: 0.25, display: { xs: 'none', sm: 'block' } }} />
          {categories.map(([cat, count]) => (
            <FilterChip
              key={cat}
              label={cat}
              count={count}
              active={categoryFilter === cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            />
          ))}
          {hasActiveFilters && (
            <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none', fontWeight: 700, ml: 0.5 }}>
              Clear filters
            </Button>
          )}
        </Stack>

        <Typography sx={{ mt: 1.25, fontSize: '0.75rem', color: slate[500] }}>
          {loading ? 'Loading…' : (
            <>
              Showing <Box component="span" sx={{ fontWeight: 800, color: slate[800] }}>{filtered.length}</Box>
              {filtered.length !== items.length && <> of {items.length}</>}
              {' '}item{filtered.length === 1 ? '' : 's'}
              {search.trim() && <> matching “{search.trim()}”</>}
            </>
          )}
        </Typography>
      </Paper>

      {/* Stock list */}
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${slate[200]}`,
          borderRadius: 2.5,
          overflow: 'hidden',
          bgcolor: '#fff',
          minHeight: 280,
        }}
      >
        {loading ? (
          <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 7, px: 3, textAlign: 'center' }}>
            <Inventory2 sx={{ fontSize: 36, color: slate[300], mb: 1 }} />
            <Typography sx={{ fontWeight: 700, color: slate[700], mb: 0.5 }}>
              No matching stock
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: slate[500], mb: 1.5 }}>
              {items.length === 0
                ? 'Items appear here when purchase bills are saved.'
                : 'Try another search or clear filters.'}
            </Typography>
            {hasActiveFilters && (
              <Button size="small" variant="outlined" onClick={clearFilters} sx={{ textTransform: 'none', fontWeight: 700 }}>
                Clear filters
              </Button>
            )}
          </Box>
        ) : (
          <>
            {/* Column headers */}
            <Box
              sx={{
                display: { xs: 'none', md: 'grid' },
                gridTemplateColumns: INVENTORY_TABLE_COLS.md,
                gap: 1.5,
                alignItems: 'center',
                px: 2.25,
                py: 1.2,
                borderBottom: `1px solid ${slate[200]}`,
                bgcolor: '#fff',
                position: 'sticky',
                top: 0,
                zIndex: 3,
              }}
            >
              {['Item Name', 'Specifications', 'Supplier', 'Stock', 'Status', 'Actions'].map((h, i) => (
                <Typography
                  key={h}
                  sx={{
                    fontSize: '0.66rem',
                    fontWeight: 800,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: slate[400],
                    textAlign: i >= 3 ? 'right' : 'left',
                  }}
                >
                  {h}
                </Typography>
              ))}
            </Box>

            {grouped.map(([category, rows]) => {
              const meta = CATEGORY_CARD_META[category] || {
                label: category,
                color: CATEGORY_MODAL_GREEN,
                Icon: CategoryIcon,
              };
              const CatIcon = meta.Icon || CategoryIcon;
              const accent = CATEGORY_MODAL_GREEN;
              const collapsed = collapsedCategories.has(category);

              return (
                <Box key={category}>
                  {/* Category accordion header */}
                  <Box
                    onClick={() => toggleCategoryCollapse(category)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCategoryCollapse(category);
                      }
                    }}
                    sx={{
                      px: 2.25,
                      py: 1.15,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.1,
                      bgcolor: alpha(accent, 0.06),
                      borderBottom: `1px solid ${slate[200]}`,
                      borderTop: `1px solid ${slate[100]}`,
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': { bgcolor: alpha(accent, 0.1) },
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: 1.25,
                        bgcolor: alpha(accent, 0.12),
                        color: accent,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <CatIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: accent,
                      }}
                    >
                      {meta.label || category}
                    </Typography>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: slate[500] }}>
                      {rows.length} item{rows.length === 1 ? '' : 's'}
                    </Typography>
                    <Box sx={{ ml: 'auto', color: accent, display: 'grid', placeItems: 'center' }}>
                      {collapsed ? <ExpandMore fontSize="small" /> : <ExpandLess fontSize="small" />}
                    </Box>
                  </Box>

                  {!collapsed &&
                    rows.map((row) => {
                      const tone = stockTone(row);
                      const suppliers = row.suppliers || [];
                      const stockColor =
                        tone.key === 'empty' ? slate[500] : tone.key === 'low' ? '#b45309' : accent;

                      return (
                        <Box
                          key={row.id}
                          onClick={() => openDetail(row)}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: INVENTORY_TABLE_COLS,
                            gap: { xs: 1, md: 1.5 },
                            alignItems: 'center',
                            px: { xs: 1.75, sm: 2.25 },
                            py: 1.5,
                            cursor: 'pointer',
                            bgcolor: '#fff',
                            borderBottom: `1px solid ${slate[200]}`,
                            transition: 'background-color 0.12s ease',
                            '&:hover': { bgcolor: alpha(accent, 0.04) },
                          }}
                        >
                          {/* Item name */}
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                borderRadius: 1.5,
                                bgcolor: alpha(accent, 0.1),
                                color: accent,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                border: `1px solid ${alpha(accent, 0.18)}`,
                                overflow: 'hidden',
                              }}
                            >
                              {row.image_url || row.thumbnail_url ? (
                                <Box
                                  component="img"
                                  src={row.image_url || row.thumbnail_url}
                                  alt=""
                                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              ) : (
                                <CatIcon sx={{ fontSize: 22 }} />
                              )}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.9rem',
                                  color: slate[900],
                                  lineHeight: 1.3,
                                }}
                              >
                                {getItemDisplayName(row)}
                              </Typography>
                              <Typography sx={{ mt: 0.3, fontSize: '0.72rem', fontWeight: 600, color: slate[500] }}>
                                ID: {getItemSku(row)}
                              </Typography>
                              <Box sx={{ mt: 0.7, display: { xs: 'block', md: 'none' } }}>
                                <SpecPills item={row} limit={3} />
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }} flexWrap="wrap" useFlexGap>
                                  <Typography sx={{ fontSize: '0.72rem', color: slate[500] }}>
                                    {suppliers[0] || '—'}
                                  </Typography>
                                  <StockStatusBadge tone={tone.key} />
                                </Stack>
                              </Box>
                            </Box>
                          </Box>

                          {/* Specifications */}
                          <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
                            <SpecPills item={row} />
                          </Box>

                          {/* Supplier */}
                          <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontSize: '0.84rem',
                                fontWeight: 600,
                                color: slate[700],
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {suppliers.length ? suppliers.join(', ') : '—'}
                            </Typography>
                          </Box>

                          {/* Stock */}
                          <Box sx={{ textAlign: { xs: 'right', md: 'right' } }}>
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'baseline',
                                gap: 0.45,
                                justifyContent: 'flex-end',
                              }}
                            >
                              <Typography
                                className="font-numeric"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.95rem',
                                  color: stockColor,
                                  fontVariantNumeric: 'tabular-nums',
                                  lineHeight: 1.15,
                                }}
                              >
                                {fmtQty(row.current_stock)}
                              </Typography>
                              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: slate[500] }}>
                                {(row.unit || '').toUpperCase()}
                              </Typography>
                            </Box>
                          </Box>

                          {/* Status */}
                          <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end', minWidth: 0, pr: 0.5 }}>
                            <StockStatusBadge tone={tone.key} />
                          </Box>

                          {/* Actions */}
                          <Stack
                            direction="row"
                            spacing={0}
                            justifyContent="flex-end"
                            alignItems="center"
                            flexWrap="nowrap"
                            sx={{ minWidth: 0, flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tooltip title="Stock history">
                              <IconButton
                                size="small"
                                onClick={() => openDetail(row)}
                                sx={inventoryActionBtnSx(slate[500], alpha(accent, 0.08))}
                              >
                                <History sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Add opening stock">
                              <IconButton
                                size="small"
                                onClick={(e) => openOpeningStock(row, e)}
                                sx={inventoryActionBtnSx('#0f766e', alpha('#0f766e', 0.1))}
                              >
                                <AddBox sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Release to production">
                              <span>
                                <IconButton
                                  size="small"
                                  disabled={(parseFloat(row.current_stock) || 0) <= 0}
                                  onClick={(e) => openRelease(row, e)}
                                  sx={inventoryActionBtnSx(accent, alpha(accent, 0.1))}
                                >
                                  <Unarchive sx={{ fontSize: 18 }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {canManageItems && (
                              <>
                                <Tooltip title="Edit item">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => openEditItem(row, e)}
                                    sx={inventoryActionBtnSx(slate[500], alpha(accent, 0.08))}
                                  >
                                    <Edit sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete item">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => openDeleteItem(row, e)}
                                    sx={{
                                      width: 30,
                                      height: 30,
                                      color: slate[400],
                                      '&:hover': { color: 'error.main', bgcolor: alpha('#ef4444', 0.08) },
                                    }}
                                  >
                                    <DeleteOutline sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                            <Tooltip title="View details">
                              <IconButton
                                size="small"
                                onClick={() => openDetail(row)}
                                sx={inventoryActionBtnSx(slate[400], alpha(accent, 0.08))}
                              >
                                <ChevronRight sx={{ fontSize: 18 }} />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </Box>
                      );
                    })}
                </Box>
              );
            })}
          </>
        )}
      </Paper>

      {/* Category summary modal */}
      <Dialog
        open={Boolean(categoryModal)}
        onClose={closeCategoryModal}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            borderRadius: 3,
            overflow: 'hidden',
            border: `1px solid ${slate[200]}`,
            boxShadow: `0 28px 60px ${alpha(slate[900], 0.18)}`,
          },
        }}
      >
        {categoryModal && (() => {
          const accent = CATEGORY_MODAL_GREEN;
          const mint = alpha(accent, 0.1);
          const ModalIcon = categoryModal.Icon || CategoryIcon;
          const modalGridCols = {
            xs: 'minmax(0, 1fr) auto 24px',
            md: 'minmax(170px, 1.15fr) minmax(220px, 1.8fr) minmax(120px, 0.9fr) minmax(120px, 0.95fr) 24px',
          };
          const sortedRows = [...(categoryModal.items || [])]
            .filter((row) => {
              if (categoryModalTab !== 'release') return true;
              return (parseFloat(row.current_stock) || 0) > 0;
            })
            .sort((a, b) => {
              const na = getItemDisplayName(a).localeCompare(getItemDisplayName(b));
              if (na !== 0) return na;
              return String(a.id).localeCompare(String(b.id));
            });

          const unitSuffix = categoryModalStats.unitLabel
            ? ` ${String(categoryModalStats.unitLabel).toUpperCase()}`
            : '';

          const tabs = [
            { key: 'history', label: 'Stock History', Icon: AccessTime },
            { key: 'release', label: 'Release Stock', Icon: Send },
            { key: 'details', label: 'Item Details', Icon: Description },
          ];

          const headerStats = [
            { label: 'SKUs', value: categoryModalStats.totalItems, Icon: Inventory2 },
            { label: 'In Stock', value: categoryModalStats.inStockCount, Icon: DonutLarge },
            { label: 'Low Stock', value: categoryModalStats.lowCount, Icon: AccessTime },
            { label: 'Out of Stock', value: categoryModalStats.zeroCount, Icon: LocalOffer },
          ];

          const onRowClick = (row) => {
            if (categoryModalTab === 'release') openRelease(row);
            else openDetail(row);
          };

          return (
            <>
              {/* Header */}
              <Box sx={{ px: { xs: 2, sm: 2.75 }, pt: 2.5, pb: 0, bgcolor: '#fff' }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: { xs: 1.5, md: 2 },
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: '1 1 220px', minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        bgcolor: mint,
                        color: accent,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <ModalIcon sx={{ fontSize: 28 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, pt: 0.15 }}>
                      <Typography
                        sx={{
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          color: accent,
                          mb: 0.25,
                        }}
                      >
                        Inventory Category
                      </Typography>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          fontSize: { xs: '1.45rem', sm: '1.7rem' },
                          color: accent,
                          lineHeight: 1.15,
                        }}
                      >
                        {categoryModal.label}
                      </Typography>
                      <Typography sx={{ mt: 0.45, fontSize: '0.8rem', color: slate[500] }}>
                        View stock history and manage release options
                      </Typography>
                    </Box>
                  </Box>

                  {/* Mid summary cards */}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ flex: '0 1 auto', alignItems: 'center', display: { xs: 'none', sm: 'flex' } }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1.1,
                        borderRadius: 2,
                        border: `1px solid ${slate[200]}`,
                        bgcolor: '#fff',
                        minWidth: 110,
                      }}
                    >
                      <Inventory2 sx={{ fontSize: 20, color: accent }} />
                      <Box>
                        <Typography className="font-numeric" sx={{ fontWeight: 800, fontSize: '1.05rem', color: accent, lineHeight: 1.1 }}>
                          {categoryModalStats.totalItems}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: slate[500] }}>SKUs</Typography>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 1.1,
                        borderRadius: 2,
                        border: `1px solid ${slate[200]}`,
                        bgcolor: '#fff',
                        minWidth: 150,
                      }}
                    >
                      <Layers sx={{ fontSize: 20, color: accent }} />
                      <Box>
                        <Typography className="font-numeric" sx={{ fontWeight: 800, fontSize: '1.05rem', color: accent, lineHeight: 1.1 }}>
                          {fmtQty(categoryModalStats.totalStock)}{unitSuffix}
                        </Typography>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: slate[500] }}>Total Stock</Typography>
                      </Box>
                    </Box>
                  </Stack>

                  {/* Right stats panel */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: { xs: 1.25, sm: 1.75 },
                      px: { xs: 1.25, sm: 1.75 },
                      py: 1.15,
                      borderRadius: 2,
                      border: `1px solid ${slate[200]}`,
                      bgcolor: '#fff',
                      flex: { xs: '1 1 100%', md: '0 1 auto' },
                      ml: { md: 'auto' },
                    }}
                  >
                    {headerStats.map(({ label, value, Icon }, i) => (
                      <Box
                        key={label}
                        sx={{
                          minWidth: 58,
                          textAlign: 'center',
                          px: { xs: 0.5, sm: 0.75 },
                          borderRight: i < headerStats.length - 1 ? `1px solid ${slate[100]}` : 'none',
                        }}
                      >
                        <Icon sx={{ fontSize: 18, color: accent, mb: 0.25 }} />
                        <Typography className="font-numeric" sx={{ fontWeight: 800, fontSize: '1rem', color: accent, lineHeight: 1.1 }}>
                          {value}
                        </Typography>
                        <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: slate[600], mt: 0.15 }}>
                          {label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  <IconButton
                    size="small"
                    onClick={closeCategoryModal}
                    aria-label="Close"
                    sx={{
                      color: slate[500],
                      ml: { xs: 'auto', md: 0 },
                      '&:hover': { bgcolor: alpha(slate[900], 0.06) },
                    }}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>

                {/* Tabs */}
                <Stack direction="row" spacing={0} sx={{ mt: 2.25, borderBottom: `1px solid ${slate[200]}` }}>
                  {tabs.map(({ key, label, Icon }) => {
                    const active = categoryModalTab === key;
                    return (
                      <Box
                        key={key}
                        component="button"
                        type="button"
                        onClick={() => setCategoryModalTab(key)}
                        sx={{
                          appearance: 'none',
                          border: 0,
                          background: 'transparent',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.75,
                          px: { xs: 1.25, sm: 1.75 },
                          py: 1.15,
                          fontFamily: 'inherit',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          color: active ? accent : slate[500],
                          borderBottom: active ? `3px solid ${accent}` : '3px solid transparent',
                          mb: '-1px',
                          transition: 'color 0.15s ease',
                          '&:hover': { color: accent },
                        }}
                      >
                        <Icon sx={{ fontSize: 18 }} />
                        {label}
                      </Box>
                    );
                  })}
                </Stack>
              </Box>

              <DialogContent sx={{ p: 0, bgcolor: '#fff' }}>
                {sortedRows.length === 0 ? (
                  <Box sx={{ py: 7, textAlign: 'center' }}>
                    <Inventory2 sx={{ fontSize: 42, color: slate[300], mb: 1 }} />
                    <Typography sx={{ color: slate[500], fontWeight: 600 }}>
                      {categoryModalTab === 'release'
                        ? 'No items available to release'
                        : 'No items in this category'}
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: modalGridCols,
                        gap: { xs: 1, md: 1.75 },
                        alignItems: 'center',
                        px: { xs: 2, sm: 2.75 },
                        py: 1.2,
                        borderBottom: `1px solid ${slate[200]}`,
                        position: 'sticky',
                        top: 0,
                        zIndex: 2,
                        bgcolor: '#fff',
                      }}
                    >
                      {['Item Details', 'Specifications', 'Supplier', 'Available Stock'].map((h, i) => (
                        <Typography
                          key={h}
                          sx={{
                            fontSize: '0.66rem',
                            fontWeight: 800,
                            letterSpacing: '0.07em',
                            textTransform: 'uppercase',
                            color: slate[400],
                            display: i === 0 || i === 3 ? 'block' : { xs: 'none', md: 'block' },
                            textAlign: i === 3 ? 'right' : 'left',
                            pr: i === 3 ? 2.5 : 0,
                          }}
                        >
                          {h}
                        </Typography>
                      ))}
                      <Box />
                    </Box>

                    {sortedRows.map((row) => {
                      const tone = stockTone(row);
                      const suppliers = row.suppliers || [];
                      const props = extractTrimProperties(row).slice(0, 6);
                      const stockColor =
                        tone.key === 'empty' ? slate[500] : tone.key === 'low' ? '#b45309' : accent;

                      return (
                        <Box
                          key={row.id}
                          onClick={() => onRowClick(row)}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: modalGridCols,
                            gap: { xs: 1, md: 1.75 },
                            alignItems: 'center',
                            px: { xs: 2, sm: 2.75 },
                            py: 1.65,
                            cursor: 'pointer',
                            bgcolor: '#fff',
                            borderBottom: `1px solid ${slate[200]}`,
                            transition: 'background-color 0.12s ease',
                            '&:hover': { bgcolor: mint },
                          }}
                        >
                          {/* Item details */}
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.15, minWidth: 0 }}>
                            <Box
                              sx={{
                                width: 34,
                                height: 34,
                                borderRadius: 1.25,
                                bgcolor: mint,
                                color: accent,
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0,
                                mt: 0.15,
                              }}
                            >
                              <ModalIcon sx={{ fontSize: 18 }} />
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{
                                  fontWeight: 800,
                                  fontSize: '0.92rem',
                                  color: slate[900],
                                  lineHeight: 1.25,
                                }}
                              >
                                {getItemDisplayName(row)}
                              </Typography>
                              <Box
                                sx={{
                                  display: 'inline-flex',
                                  mt: 0.45,
                                  px: 0.75,
                                  py: 0.2,
                                  borderRadius: 1,
                                  bgcolor: slate[100],
                                  border: `1px solid ${slate[200]}`,
                                }}
                              >
                                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: slate[600] }}>
                                  SKU: {getItemSku(row)}
                                </Typography>
                              </Box>
                              <Box sx={{ mt: 0.75, display: { xs: 'grid', md: 'none' }, gridTemplateColumns: '1fr 1fr', gap: 0.55 }}>
                                {props.map((p) => (
                                  <SpecPropertyChip key={`${p.label}-${p.value}`} label={p.label} value={p.value} accent={accent} />
                                ))}
                              </Box>
                            </Box>
                          </Box>

                          {/* Specifications */}
                          <Box
                            sx={{
                              display: { xs: 'none', md: 'grid' },
                              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                              gap: 0.6,
                              minWidth: 0,
                            }}
                          >
                            {props.length === 0 ? (
                              <Typography sx={{ fontSize: '0.78rem', color: slate[400] }}>—</Typography>
                            ) : (
                              props.map((p) => (
                                <SpecPropertyChip key={`${p.label}-${p.value}`} label={p.label} value={p.value} accent={accent} />
                              ))
                            )}
                          </Box>

                          {/* Supplier */}
                          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.7, minWidth: 0 }}>
                            <Business sx={{ fontSize: 16, color: accent, flexShrink: 0 }} />
                            <Typography
                              sx={{
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                color: slate[700],
                                overflow: 'hidden',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {suppliers.length ? suppliers.join(', ') : '—'}
                            </Typography>
                          </Box>

                          {/* Available stock */}
                          <Box sx={{ justifySelf: 'end', textAlign: 'right', pr: 0.25 }}>
                            <Typography
                              className="font-numeric"
                              sx={{
                                fontWeight: 800,
                                fontSize: '1.05rem',
                                color: stockColor,
                                lineHeight: 1.15,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {fmtQty(row.current_stock)} {(row.unit || '').toUpperCase()}
                            </Typography>
                            <Box sx={{ mt: 0.45, display: 'flex', justifyContent: 'flex-end' }}>
                              <StockStatusBadge tone={tone.key} />
                            </Box>
                          </Box>

                          <Box sx={{ display: 'grid', placeItems: 'center', color: slate[300] }}>
                            <ChevronRight fontSize="small" />
                          </Box>
                        </Box>
                      );
                    })}
                  </>
                )}
              </DialogContent>

              <DialogActions
                sx={{
                  px: { xs: 2, sm: 2.75 },
                  py: 1.6,
                  bgcolor: '#fff',
                  borderTop: `1px solid ${slate[200]}`,
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1,
                }}
              >
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 600, color: slate[600] }}>
                  Total:{' '}
                  <Box component="span" sx={{ color: accent, fontWeight: 800 }}>
                    {categoryModalStats.totalItems} items
                  </Box>
                  {' · '}
                  <Box component="span" className="font-numeric" sx={{ color: slate[900], fontWeight: 800 }}>
                    {fmtQty(categoryModalStats.totalStock)}{unitSuffix}
                  </Box>
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    onClick={exportCategoryModalCsv}
                    variant="outlined"
                    startIcon={<FileDownload />}
                    disabled={!categoryModal.items?.length}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      borderColor: slate[300],
                      color: slate[700],
                      '&:hover': { borderColor: slate[400], bgcolor: slate[50] },
                    }}
                  >
                    Export
                  </Button>
                  <Button
                    onClick={closeCategoryModal}
                    variant="contained"
                    disableElevation
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 2.5,
                      bgcolor: accent,
                      '&:hover': { bgcolor: accent, filter: 'brightness(0.92)' },
                    }}
                  >
                    Close
                  </Button>
                </Stack>
              </DialogActions>
            </>
          );
        })()}
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={Boolean(detailItem)} onClose={closeDetail} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>
          Stock details
          {summary && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {fmtQty(summary.current_stock)} {summary.unit} on hand
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {summary && (
            <Box>
              <InventoryItemFull item={summary} />

              <Grid container spacing={2} sx={{ mt: 2, mb: 3 }}>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Received
                    </Typography>
                    <Typography className="font-numeric" variant="h6" fontWeight={700}>
                      {fmtQty(summary.total_received)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Released
                    </Typography>
                    <Typography className="font-numeric" variant="h6" fontWeight={700}>
                      {fmtQty(summary.total_released)}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={4}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      On hand
                    </Typography>
                    <Typography className="font-numeric" variant="h6" fontWeight={700} color="primary.main">
                      {fmtQty(summary.current_stock)} {summary.unit}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {(summary.pi_refs?.length > 0 || summary.suppliers?.length > 0) && (
                <>
                  <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assignment fontSize="small" /> Linked PI & supplier
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
                    {summary.pi_refs?.map((pi) => (
                      <Box key={pi.pi_number} sx={{ mb: 1 }}>
                        <Typography fontWeight={700}>{pi.pi_number}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Customer: {pi.customer || '—'}
                        </Typography>
                      </Box>
                    ))}
                    {summary.suppliers?.length > 0 && (
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Supplier: {summary.suppliers.join(', ')}
                      </Typography>
                    )}
                  </Paper>
                </>
              )}

              {summary.stock_sources?.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Receipt batches
                  </Typography>
                  <Paper variant="outlined" sx={{ mb: 2, overflow: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={headCellSx}>Date</TableCell>
                          <TableCell sx={headCellSx}>Qty</TableCell>
                          <TableCell sx={headCellSx}>PI</TableCell>
                          <TableCell sx={headCellSx}>Customer</TableCell>
                          <TableCell sx={headCellSx}>Supplier</TableCell>
                          <TableCell sx={headCellSx}>Bill ref</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {summary.stock_sources.map((src, i) => (
                          <TableRow key={`${src.bill_ref}-${i}`}>
                            <TableCell>{formatDateDisplay(src.received_at)}</TableCell>
                            <TableCell className="font-numeric">{fmtQty(src.quantity)}</TableCell>
                            <TableCell>{src.pi_number || '—'}</TableCell>
                            <TableCell>{src.customer || '—'}</TableCell>
                            <TableCell>{src.supplier || '—'}</TableCell>
                            <TableCell>{src.bill_ref || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Paper>
                </>
              )}

              {canManageItems && (summary.audits || []).length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>
                    Change history
                  </Typography>
                  <Paper variant="outlined" sx={{ maxHeight: 220, overflow: 'auto', mb: 2 }}>
                    {summary.audits.map((audit) => (
                      <Box
                        key={audit.id}
                        sx={{
                          px: 2,
                          py: 1.15,
                          borderBottom: `1px solid ${slate[100]}`,
                        }}
                      >
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: slate[800] }}>
                          {audit.action === 'DELETE' ? 'Deleted' : 'Updated'}
                          {' · '}
                          {audit.performed_by_name || 'unknown'}
                          {' · '}
                          <Box component="span" sx={{ fontWeight: 500, color: slate[500] }}>
                            {formatAuditWhen(audit.performed_at)}
                          </Box>
                        </Typography>
                        {audit.action === 'UPDATE' && audit.changes && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.35 }}>
                            {Object.entries(audit.changes).map(([field, change]) => formatAuditChange(field, change)).join(' · ')}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Paper>
                </>
              )}

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Transaction history
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 280, overflow: 'auto' }}>
                {(summary.all_logs || []).map((log) => (
                  <Box
                    key={log.id}
                    sx={{
                      px: 2,
                      py: 1.25,
                      borderBottom: `1px solid ${slate[100]}`,
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr 80px 1fr',
                      gap: 1,
                      alignItems: 'center',
                    }}
                  >
                    <Chip
                      size="small"
                      label={logLabel(log.transaction_type, log)}
                      color={log.transaction_type === 'ISSUE' ? 'warning' : 'default'}
                      variant="outlined"
                    />
                    <Typography variant="body2">
                      {log.reference_number || log.vendor_supplier || '—'}
                    </Typography>
                    <Typography className="font-numeric" variant="body2" fontWeight={700}>
                      {fmtQty(log.quantity)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateDisplay(logDate(log))}
                      {log.remarks ? ` · ${log.remarks}` : ''}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetail}>Close</Button>
          {canManageItems && detailItem && (
            <>
              <Button startIcon={<Edit />} onClick={() => openEditItem(detailItem)}>
                Edit
              </Button>
              <Button color="error" startIcon={<DeleteOutline />} onClick={() => openDeleteItem(detailItem)}>
                Delete
              </Button>
            </>
          )}
          {detailItem && (
            <Button
              variant="outlined"
              startIcon={<AddBox />}
              onClick={() => openOpeningStock(detailItem)}
            >
              Add opening stock
            </Button>
          )}
          {detailItem && parseFloat(detailItem.current_stock) > 0 && (
            <Button
              variant="contained"
              startIcon={<Unarchive />}
              onClick={() => openRelease(detailItem)}
            >
              Release stock
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(editItem)} onClose={closeEditItem} maxWidth="sm" fullWidth>
        <DialogTitle>Edit inventory item</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Item code"
                value={editForm.item_code}
                onChange={(e) => setEditForm((f) => ({ ...f, item_code: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Name"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Category"
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORY_CARD_ORDER.map((key) => (
                  <MenuItem key={key} value={key}>{CATEGORY_CARD_META[key]?.label || key}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                select
                label="Unit"
                value={editForm.unit}
                onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
              >
                {UNIT_OPTIONS.map((u) => (
                  <MenuItem key={u} value={u}>{u}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Colour"
                value={editForm.color}
                onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Size"
                value={editForm.size}
                onChange={(e) => setEditForm((f) => ({ ...f, size: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Reorder level"
                value={editForm.reorder_level}
                onChange={(e) => setEditForm((f) => ({ ...f, reorder_level: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Unit cost"
                value={editForm.unit_cost}
                onChange={(e) => setEditForm((f) => ({ ...f, unit_cost: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Description"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditItem} disabled={editLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveItem} disabled={editLoading}>
            {editLoading ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteItem)} onClose={() => !deleteLoading && setDeleteItem(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete inventory item</DialogTitle>
        <DialogContent>
          <Typography sx={{ pt: 1 }}>
            Remove <strong>{deleteItem?.item_name || deleteItem?.name || deleteItem?.item_code}</strong> from inventory?
            Stock history is kept. This can only be done by an admin.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteItem(null)} disabled={deleteLoading}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteItem} disabled={deleteLoading}>
            {deleteLoading ? 'Removing…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Opening stock dialog (existing inventory item) */}
      <Dialog open={Boolean(openingItem)} onClose={closeOpeningStock} maxWidth="xs" fullWidth>
        <DialogTitle>Add opening stock</DialogTitle>
        <DialogContent>
          {openingItem && (
            <Box sx={{ pt: 1 }}>
              <InventoryItemFull item={openingItem} compact />
              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                Current on hand:{' '}
                <strong>{fmtQty(openingItem.current_stock)} {openingItem.unit}</strong>
                . Opening stock will be added to this balance.
              </Alert>
              <TextField
                fullWidth
                autoFocus
                label="Opening stock quantity"
                type="number"
                value={openingQty}
                onChange={(e) => setOpeningQty(e.target.value)}
                inputProps={{ min: 0, step: 'any' }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Opening stock date"
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Remarks (optional)"
                placeholder="e.g. Opening balance as of go-live"
                multiline
                rows={2}
                value={openingRemarks}
                onChange={(e) => setOpeningRemarks(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeOpeningStock} disabled={openingLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleOpeningStock} disabled={openingLoading}>
            {openingLoading ? 'Saving…' : 'Add opening stock'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* New trim / library trim opening stock */}
      <Dialog open={newOpeningOpen} onClose={closeNewOpeningStock} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddBox color="primary" />
          Add opening stock
        </DialogTitle>
        <DialogContent>
          <FormControl sx={{ mt: 1, mb: 2 }}>
            <FormLabel sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.5 }}>Trim source</FormLabel>
            <RadioGroup
              row
              value={newOpeningMode}
              onChange={(e) => {
                setNewOpeningMode(e.target.value);
                if (e.target.value === 'create') {
                  setSelectedTrim(null);
                  setPropertyValues({});
                }
              }}
            >
              <FormControlLabel value="library" control={<Radio size="small" />} label="From trim library" />
              <FormControlLabel value="create" control={<Radio size="small" />} label="Create new trim" />
            </RadioGroup>
          </FormControl>

          {newOpeningMode === 'library' ? (
            <Autocomplete
              options={trimOptions}
              loading={trimsLoading}
              value={selectedTrim}
              onChange={(_, v) => {
                setSelectedTrim(v);
                setPropertyValues({});
              }}
              getOptionLabel={(o) => (o?.name ? `${o.name}${o.category ? ` · ${o.category}` : ''}` : '')}
              isOptionEqualToValue={(a, b) => a?.id === b?.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select trim"
                  placeholder="Search trim library…"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {trimsLoading ? <CircularProgress size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              sx={{ mb: 2 }}
            />
          ) : (
            <Box sx={{ mb: 2 }}>
              {selectedTrim ? (
                <Alert severity="success" sx={{ mb: 1.5 }}>
                  New trim ready: <strong>{selectedTrim.name}</strong>
                  {selectedTrim.category ? ` · ${selectedTrim.category}` : ''}
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 1.5 }}>
                  Create the trim in the library first, then enter opening quantity and date.
                </Alert>
              )}
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => setTrimModalOpen(true)}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                {selectedTrim ? 'Create a different trim' : 'Create new trim'}
              </Button>
            </Box>
          )}

          {selectedTrim?.properties?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: slate[600], mb: 1 }}>
                Variant properties (optional)
              </Typography>
              <Grid container spacing={1.5}>
                {selectedTrim.properties.map((prop) => (
                  <Grid item xs={12} sm={6} key={prop.name}>
                    <TextField
                      fullWidth
                      size="small"
                      label={prop.unit ? `${prop.name} (${prop.unit})` : prop.name}
                      value={propertyValues[prop.name] || ''}
                      onChange={(e) => setPropertyValues((prev) => ({
                        ...prev,
                        [prop.name]: e.target.value,
                      }))}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <TextField
            fullWidth
            label="Opening stock quantity"
            type="number"
            value={openingQty}
            onChange={(e) => setOpeningQty(e.target.value)}
            inputProps={{ min: 0, step: 'any' }}
            helperText={selectedTrim?.default_unit ? `Unit: ${selectedTrim.default_unit}` : undefined}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Opening stock date"
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Remarks (optional)"
            placeholder="e.g. Physical count / opening balance"
            multiline
            rows={2}
            value={openingRemarks}
            onChange={(e) => setOpeningRemarks(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeNewOpeningStock} disabled={openingLoading}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateWithOpeningStock}
            disabled={openingLoading || !selectedTrim}
          >
            {openingLoading ? 'Saving…' : 'Save opening stock'}
          </Button>
        </DialogActions>
      </Dialog>

      <AddTrimModal
        open={trimModalOpen}
        onClose={() => setTrimModalOpen(false)}
        onSaved={handleTrimCreatedForOpening}
      />

      {/* Release dialog */}
      <Dialog open={Boolean(releaseItem)} onClose={closeRelease} maxWidth="xs" fullWidth>
        <DialogTitle>Release to production</DialogTitle>
        <DialogContent>
          {releaseItem && (
            <Box sx={{ pt: 1 }}>
              <InventoryItemFull item={releaseItem} compact />
              <Alert severity="info" sx={{ mt: 2, mb: 2 }}>
                Available: <strong>{fmtQty(releaseItem.current_stock)} {releaseItem.unit}</strong>
              </Alert>
              <TextField
                fullWidth
                label="Quantity to release"
                type="number"
                value={releaseQty}
                onChange={(e) => setReleaseQty(e.target.value)}
                inputProps={{ min: 0, step: 'any' }}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Remarks (optional)"
                multiline
                rows={2}
                value={releaseRemarks}
                onChange={(e) => setReleaseRemarks(e.target.value)}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRelease} disabled={releaseLoading}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleRelease} disabled={releaseLoading}>
            {releaseLoading ? 'Releasing…' : 'Confirm release'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Inventory;
