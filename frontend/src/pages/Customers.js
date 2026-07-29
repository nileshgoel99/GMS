import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  IconButton,
  Chip,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Typography,
  Switch,
  FormControlLabel,
  InputAdornment,
  Stack,
  Alert,
  CircularProgress,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { alpha, styled, useTheme } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import {
  Add,
  Edit,
  Delete,
  ArrowBack,
  ArrowForward,
  Search,
  PersonAdd,
  Star,
  Visibility,
  ViewList,
  AccountTree,
} from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { slate, warm, dataGridSx } from '../theme/appTheme';
import { customersAPI } from '../services/api';
import { confirmDiscardUnsaved } from '../hooks/useUnsavedChanges';

const emptyContact = (primary = false) => ({
  name: '',
  email: '',
  phone: '',
  designation: '',
  is_primary: primary,
});

const emptyForm = {
  customer_code: '',
  company_legal_name: '',
  country: '',
  region_state: '',
  city: '',
  postal_code: '',
  address_line1: '',
  address_line2: '',
  website: '',
  tax_id_vat: '',
  default_currency: 'USD',
  preferred_language: 'en',
  incoterms_default: '',
  payment_terms_default: '',
  bank_details: '',
  notes: '',
  is_active: true,
  contacts: [emptyContact(true)],
};

const detailLabelSx = { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: slate[500], mb: 0.35 };
const detailValueSx = { fontSize: '0.875rem', color: slate[800], lineHeight: 1.5, whiteSpace: 'pre-wrap' };

function DetailField({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={detailLabelSx}>{label}</Typography>
      <Typography sx={detailValueSx}>{value}</Typography>
    </Box>
  );
}

function CustomerDetailDialog({ open, customer, onClose, onEdit }) {
  const theme = useTheme();
  if (!customer) return null;
  const contacts = customer.contacts?.length
    ? customer.contacts
    : customer.primary_email || customer.phone
      ? [{ name: 'Primary contact', email: customer.primary_email, phone: customer.phone || customer.mobile, designation: '', is_primary: true }]
      : [];

  const address = [customer.address_line1, customer.address_line2, [customer.city, customer.region_state, customer.postal_code].filter(Boolean).join(', '), customer.country]
    .filter(Boolean)
    .join('\n');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ pb: 1 }}>
        <Box>
          <Typography variant="overline" color="primary" fontWeight={700}>
            {customer.customer_code}
          </Typography>
          <Typography variant="h6" fontWeight={700} sx={{ mt: 0.25 }}>
            {customer.company_legal_name}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers sx={{ bgcolor: alpha(theme.palette.grey[50], 0.4) }}>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
              Company
            </Typography>
            <DetailField label="Currency" value={customer.default_currency} />
            <DetailField label="Language" value={customer.preferred_language} />
            <DetailField label="Website" value={customer.website} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
              Address
            </Typography>
            <DetailField label="Registered address" value={address || '—'} />
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1 }}>
              Contacts ({contacts.length})
            </Typography>
            <Stack spacing={1}>
              {contacts.map((c, i) => (
                <Box
                  key={c.id || i}
                  sx={{
                    p: 1.25,
                    borderRadius: 1.5,
                    border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                    bgcolor: 'background.paper',
                  }}
                >
                  <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                    <Typography fontWeight={600}>{c.name}</Typography>
                    {c.is_primary && <Chip size="small" label="Primary" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                    {c.designation && (
                      <Typography variant="caption" color="text.secondary">
                        {c.designation}
                      </Typography>
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.78rem' }}>
                    {[c.email, c.phone].filter(Boolean).join(' · ') || '—'}
                  </Typography>
                </Box>
              ))}
              {!contacts.length && <Typography color="text.disabled">No contacts on file</Typography>}
            </Stack>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          Close
        </Button>
        <Button variant="contained" startIcon={<Edit fontSize="small" />} onClick={() => onEdit(customer)}>
          Edit
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const STEPS = [
  { label: 'Company', short: 'Code & legal entity' },
  { label: 'Address & contacts', short: 'Location & people' },
];

const customerToForm = (c) => {
  let contacts = (c.contacts || []).map((row) => ({
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    designation: row.designation || '',
    is_primary: !!row.is_primary,
  }));
  if (!contacts.length) {
    const legacy = emptyContact(true);
    if (c.primary_email || c.phone || c.mobile) {
      legacy.email = c.primary_email || '';
      legacy.phone = c.phone || c.mobile || '';
      legacy.name = 'Primary contact';
    }
    contacts = [legacy];
  }
  return {
    customer_code: c.customer_code,
    company_legal_name: c.company_legal_name,
    country: c.country || '',
    region_state: c.region_state || '',
    city: c.city || '',
    postal_code: c.postal_code || '',
    address_line1: c.address_line1 || '',
    address_line2: c.address_line2 || '',
    website: c.website || '',
    tax_id_vat: c.tax_id_vat || '',
    default_currency: c.default_currency || 'USD',
    preferred_language: c.preferred_language || 'en',
    incoterms_default: c.incoterms_default || '',
    payment_terms_default: c.payment_terms_default || '',
    bank_details: c.bank_details || '',
    notes: c.notes || '',
    is_active: c.is_active,
    contacts,
  };
};

const normalizeWebsite = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
};

const formToPayload = (formData) => {
  const contacts = (formData.contacts || [])
    .filter((c) => (c.name || '').trim())
    .map((c, i) => ({
      ...(c.id ? { id: c.id } : {}),
      name: c.name.trim(),
      email: (c.email || '').trim(),
      phone: (c.phone || '').trim(),
      designation: (c.designation || '').trim(),
      is_primary: !!c.is_primary,
      sort_order: i,
    }));
  return {
    customer_code: formData.customer_code.trim(),
    company_legal_name: formData.company_legal_name.trim(),
    trading_name: '',
    country: formData.country,
    region_state: formData.region_state,
    city: formData.city,
    postal_code: formData.postal_code,
    address_line1: formData.address_line1,
    address_line2: formData.address_line2,
    website: normalizeWebsite(formData.website) || null,
    tax_id_vat: formData.tax_id_vat,
    default_currency: formData.default_currency,
    preferred_language: formData.preferred_language,
    incoterms_default: formData.incoterms_default,
    payment_terms_default: formData.payment_terms_default,
    bank_details: formData.bank_details,
    notes: formData.notes,
    is_active: formData.is_active,
    contacts,
  };
};

const compactField = {
  '& .MuiInputBase-root': { borderRadius: 1.25 },
  '& .MuiInputBase-input': { fontSize: '0.875rem' },
  '& .MuiInputLabel-root': { fontSize: '0.8rem' },
  '& .MuiFormHelperText-root': { fontSize: '0.7rem', mt: 0.5, lineHeight: 1.3 },
};

const QConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: { top: 10 },
  [`&.${stepConnectorClasses.active}`]: { [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main } },
  [`&.${stepConnectorClasses.completed}`]: { [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main } },
  [`& .${stepConnectorClasses.line}`]: { borderTopWidth: 2, borderColor: alpha(theme.palette.divider, 0.9) },
}));

const Customers = () => {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState(emptyForm);
  const [codeLookup, setCodeLookup] = useState({ loading: false, customers: [] });
  const [groupByCode, setGroupByCode] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [openDetail, setOpenDetail] = useState(false);
  const customerBaselineRef = useRef(JSON.stringify(emptyForm));

  const isLastStep = activeStep === STEPS.length - 1;
  const isNew = !selected;

  const fetchRows = async () => {
    try {
      const res = await customersAPI.getAll();
      setRows(res.data.results || res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.customer_code, r.company_legal_name, r.primary_contact_name, r.primary_email, r.city, r.country]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, searchQuery]);

  const handleOpenDialog = async (row = null) => {
    setActiveStep(0);
    if (row?.id) {
      try {
        const res = await customersAPI.getById(row.id);
        const c = res.data;
        setSelected(c);
        const next = customerToForm(c);
        setFormData(next);
        customerBaselineRef.current = JSON.stringify(next);
      } catch (e) {
        console.error(e);
        alert('Could not load customer');
        return;
      }
    } else {
      setSelected(null);
      setFormData(emptyForm);
      customerBaselineRef.current = JSON.stringify(emptyForm);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    const dirty = JSON.stringify(formData) !== customerBaselineRef.current;
    if (!confirmDiscardUnsaved(dirty)) return;
    setOpenDialog(false);
    setSelected(null);
    setActiveStep(0);
    setCodeLookup({ loading: false, customers: [] });
  };

  useEffect(() => {
    if (!openDialog) return undefined;
    const code = formData.customer_code.trim();
    if (code.length < 1) {
      setCodeLookup({ loading: false, customers: [] });
      return undefined;
    }
    const timer = setTimeout(async () => {
      setCodeLookup((s) => ({ ...s, loading: true }));
      try {
        const res = await customersAPI.lookupCode(code, selected?.id);
        setCodeLookup({ loading: false, customers: res.data.customers || [] });
      } catch {
        setCodeLookup({ loading: false, customers: [] });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [formData.customer_code, openDialog, selected?.id]);

  const setContact = (index, patch) => {
    setFormData((fd) => ({
      ...fd,
      contacts: fd.contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));
  };

  const setPrimaryContact = (index) => {
    setFormData((fd) => ({
      ...fd,
      contacts: fd.contacts.map((c, i) => ({ ...c, is_primary: i === index })),
    }));
  };

  const addContact = () => {
    setFormData((fd) => ({
      ...fd,
      contacts: [...fd.contacts, emptyContact(false)],
    }));
  };

  const removeContact = (index) => {
    setFormData((fd) => {
      const next = fd.contacts.filter((_, i) => i !== index);
      if (!next.length) return { ...fd, contacts: [emptyContact(true)] };
      if (!next.some((c) => c.is_primary)) next[0].is_primary = true;
      return { ...fd, contacts: next };
    });
  };

  const handleSubmit = async () => {
    try {
      const payload = formToPayload(formData);
      const named = payload.contacts.filter((c) => c.name);
      if (named.length && named.filter((c) => c.is_primary).length !== 1) {
        alert('Mark exactly one contact as primary.');
        return;
      }
      if (selected) {
        await customersAPI.update(selected.id, payload);
      } else {
        await customersAPI.create(payload);
      }
      fetchRows();
      handleCloseDialog();
    } catch (e) {
      console.error(e);
      alert(e.response?.data ? JSON.stringify(e.response.data) : 'Error saving customer');
    }
  };

  const canProceedFromStep0 = useCallback(() => {
    return Boolean(formData.customer_code.trim() && formData.company_legal_name.trim());
  }, [formData.customer_code, formData.company_legal_name]);

  const canProceedFromStep1 = useCallback(() => {
    return Boolean((formData.country || '').trim());
  }, [formData.country]);

  const handleNext = () => {
    if (activeStep === 0 && !canProceedFromStep0()) {
      alert('Enter customer code and company legal name to continue.');
      return;
    }
    if (activeStep === 1 && !canProceedFromStep1()) {
      alert('Enter country to continue.');
      return;
    }
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer?')) return;
    try {
      await customersAPI.delete(id);
      fetchRows();
    } catch (e) {
      console.error(e);
      alert('Error deleting customer');
    }
  };

  const handleViewDetail = async (row) => {
    try {
      const res = await customersAPI.getById(row.id);
      setDetailCustomer(res.data);
      setOpenDetail(true);
    } catch (e) {
      console.error(e);
      alert('Could not load customer details');
    }
  };

  const handleEditFromDetail = async (customer) => {
    setOpenDetail(false);
    await handleOpenDialog({ id: customer.id });
  };

  const groupedByCode = useMemo(() => {
    const map = new Map();
    for (const r of filteredRows) {
      const code = (r.customer_code || '—').trim();
      if (!map.has(code)) map.set(code, []);
      map.get(code).push(r);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredRows]);

  const gridRowIndex = useMemo(() => {
    const idx = new Map();
    filteredRows.forEach((r, i) => idx.set(r.id, i));
    return idx;
  }, [filteredRows]);

  const cellMuted = {
    fontSize: '0.8125rem',
    fontWeight: 400,
    color: slate[600],
    lineHeight: 1.45,
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    width: '100%',
  };
  const cellPrimary = {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: slate[900],
    lineHeight: 1.45,
  };

  const customersGridSx = {
    ...dataGridSx,
    width: '100%',
    bgcolor: '#fff',
    // Override DataGrid single-line ellipsis so long values wrap fully
    '& .MuiDataGrid-cell, & .MuiDataGrid-cellContent, & .MuiDataGrid-cell *': {
      whiteSpace: 'normal !important',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      textOverflow: 'clip !important',
    },
    '& .MuiDataGrid-cell, & .MuiDataGrid-cellContent': {
      overflow: 'visible !important',
      lineHeight: '1.45 !important',
      maxHeight: 'none !important',
    },
    '& .MuiDataGrid-columnHeaders': {
      ...dataGridSx['& .MuiDataGrid-columnHeaders'],
      minHeight: '44px !important',
      maxHeight: '44px !important',
      bgcolor: warm[50],
    },
    '& .MuiDataGrid-columnHeader': {
      '&:focus, &:focus-within': { outline: 'none' },
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      fontWeight: 600,
      fontSize: '0.6875rem',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: slate[500],
    },
    '& .MuiDataGrid-row': {
      ...dataGridSx['& .MuiDataGrid-row'],
      maxHeight: 'none !important',
    },
    '& .MuiDataGrid-row.customer-row--alt': {
      bgcolor: `${alpha(slate[200], 0.42)} !important`,
    },
    '& .MuiDataGrid-row.customer-row--alt:hover': {
      bgcolor: `${alpha(theme.palette.primary.main, 0.1)} !important`,
    },
    '& .MuiDataGrid-cell': {
      ...dataGridSx['& .MuiDataGrid-cell'],
      display: 'flex',
      alignItems: 'flex-start',
      py: 1.25,
      fontWeight: 400,
      fontSize: '0.8125rem',
      color: slate[700],
      maxHeight: 'none !important',
    },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: 'none' },
    '& .MuiDataGrid-footerContainer': {
      ...dataGridSx['& .MuiDataGrid-footerContainer'],
      minHeight: 44,
      fontSize: '0.8125rem',
      color: slate[600],
    },
  };

  const codeColumn = {
    field: 'customer_code',
    headerName: 'Code',
    minWidth: 100,
    flex: 0.5,
    renderCell: (p) => (
      <Typography
        component="span"
        sx={{
          fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
          color: theme.palette.primary.dark,
          bgcolor: alpha(theme.palette.primary.main, 0.07),
          px: 1,
          py: 0.35,
          borderRadius: 1,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
          lineHeight: 1.35,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        {p.value || '—'}
      </Typography>
    ),
  };

  const dataColumns = [
    {
      field: 'company_legal_name',
      headerName: 'Legal name',
      minWidth: 280,
      flex: 2.2,
      renderCell: (p) => (
        <Box
          onClick={() => handleViewDetail(p.row)}
          sx={{
            ...cellPrimary,
            width: '100%',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            overflowWrap: 'anywhere',
            cursor: 'pointer',
            py: 0.15,
            '&:hover': { color: theme.palette.primary.main },
          }}
        >
          {p.value || '—'}
        </Box>
      ),
    },
    {
      field: 'primary_contact_name',
      headerName: 'Contact',
      minWidth: 130,
      flex: 0.7,
      renderCell: (p) => <Box sx={cellMuted}>{p.value || '—'}</Box>,
    },
    {
      field: 'country',
      headerName: 'Country',
      minWidth: 100,
      flex: 0.5,
      renderCell: (p) => <Box sx={cellMuted}>{p.value || '—'}</Box>,
    },
    {
      field: 'city',
      headerName: 'City',
      minWidth: 100,
      flex: 0.5,
      renderCell: (p) => <Box sx={cellMuted}>{p.value || '—'}</Box>,
    },
    {
      field: 'primary_email',
      headerName: 'Email',
      minWidth: 200,
      flex: 1.1,
      renderCell: (p) => (
        <Box
          sx={{
            ...cellMuted,
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontSize: '0.75rem',
            color: p.value ? slate[700] : slate[400],
          }}
        >
          {p.value || '—'}
        </Box>
      ),
    },
    {
      field: 'default_currency',
      headerName: 'CCY',
      minWidth: 56,
      flex: 0.28,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => (
        <Typography
          sx={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: slate[700],
          }}
        >
          {(p.value || '—').toString().toUpperCase()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      minWidth: 112,
      flex: 0.38,
      sortable: false,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.25, justifyContent: 'flex-end', width: '100%' }}>
          <Tooltip title="View details">
            <IconButton size="small" onClick={() => handleViewDetail(p.row)} aria-label="View customer">
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenDialog(p.row)} aria-label="Edit customer">
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(p.row.id)} aria-label="Delete customer">
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const columns = [codeColumn, ...dataColumns];
  const groupedColumns = dataColumns;

  const renderDataGrid = (gridRows, cols, { compactFooter = false, localStriping = false } = {}) => (
    <DataGrid
      rows={gridRows}
      columns={cols}
      getRowId={(r) => r.id}
      getRowClassName={(params) => {
        const idx = localStriping
          ? gridRows.findIndex((r) => r.id === params.id)
          : gridRowIndex.get(params.id) ?? 0;
        return idx % 2 === 1 ? 'customer-row--alt' : '';
      }}
      pageSizeOptions={[10, 25, 50]}
      initialState={{ pagination: { paginationModel: { pageSize: compactFooter ? 25 : 10 } } }}
      hideFooter={compactFooter && gridRows.length <= 25}
      loading={loading}
      disableRowSelectionOnClick
      getRowHeight={() => 'auto'}
      getEstimatedRowHeight={() => 72}
      columnHeaderHeight={44}
      onRowDoubleClick={(params) => handleViewDetail(params.row)}
      sx={{
        ...customersGridSx,
        height: '100%',
        border: 'none',
        // Ensure auto-height rows remeasure after wrap
        '& .MuiDataGrid-virtualScrollerRenderZone': {
          width: '100%',
        },
      }}
    />
  );

  return (
    <Box>
      <PageHeader
        kicker="Master data"
        title="Customers"
        subtitle="Maintain buyer legal entities, contacts, and trade defaults. Link records to customer PIs so bill-to details stay consistent."
        actions={
          <Button variant="contained" size="large" startIcon={<Add />} onClick={() => handleOpenDialog()}>
            New customer
          </Button>
        }
      />

      <DataGridShell
        sx={{
          width: '100%',
          border: `1px solid ${alpha(slate[200], 0.95)}`,
          boxShadow: `0 1px 3px ${alpha(slate[900], 0.06)}`,
        }}
      >
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            py: 1.75,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            borderBottom: `1px solid ${slate[200]}`,
            bgcolor: warm[50],
          }}
        >
          <TextField
            size="small"
            placeholder="Search code, name, email, city…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search customers"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ fontSize: 20, color: slate[500] }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: '1 1 280px',
              maxWidth: 480,
              '& .MuiOutlinedInput-root': {
                bgcolor: '#fff',
                fontSize: '0.875rem',
                '& fieldset': { borderColor: slate[200] },
              },
            }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={groupByCode ? 'group' : 'list'}
            onChange={(_, v) => v && setGroupByCode(v === 'group')}
            aria-label="View mode"
          >
            <ToggleButton value="list">
              <ViewList fontSize="small" sx={{ mr: 0.75 }} />
              List
            </ToggleButton>
            <ToggleButton value="group">
              <AccountTree fontSize="small" sx={{ mr: 0.75 }} />
              Group by code
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {filteredRows.length} {filteredRows.length === 1 ? 'record' : 'records'}
            {searchQuery.trim() ? ' · filtered' : ''}
            {groupByCode ? ` · ${groupedByCode.length} groups` : ''}
          </Typography>
        </Box>

        {!groupByCode ? (
          <Box sx={{ height: { xs: 520, md: 580 }, width: '100%' }}>
            {renderDataGrid(filteredRows, columns)}
          </Box>
        ) : (
          <Box
            sx={{
              maxHeight: { xs: 520, md: 580 },
              overflow: 'auto',
              px: { xs: 1, sm: 1.5 },
              py: 1.5,
              bgcolor: '#fff',
            }}
          >
            <Stack spacing={1.5}>
              {groupedByCode.map(([code, items]) => (
                <Box
                  key={code}
                  sx={{
                    borderRadius: 2,
                    border: `1px solid ${alpha(slate[200], 0.95)}`,
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                      borderBottom: `1px solid ${alpha(slate[200], 0.9)}`,
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                        fontWeight: 700,
                        fontSize: '0.8125rem',
                        color: theme.palette.primary.dark,
                      }}
                    >
                      {code}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${items.length} ${items.length === 1 ? 'entity' : 'entities'}`}
                      sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem' }}
                    />
                  </Box>
                  <Box sx={{ minHeight: Math.min(56 * items.length + 52, 360), width: '100%' }}>
                    {renderDataGrid(items, groupedColumns, { compactFooter: true, localStriping: true })}
                  </Box>
                </Box>
              ))}
              {groupedByCode.length === 0 && !loading && (
                <Typography color="text.secondary" textAlign="center" py={4}>
                  No customers match your search.
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </DataGridShell>

      <CustomerDetailDialog
        open={openDetail}
        customer={detailCustomer}
        onClose={() => {
          setOpenDetail(false);
          setDetailCustomer(null);
        }}
        onEdit={handleEditFromDetail}
      />

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="lg" fullWidth scroll="paper">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            {selected ? 'Edit customer' : 'New customer'}
          </Typography>
          {isNew && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
              A quick 2-step setup—save time with compact fields you can complete in order.
            </Typography>
          )}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            pt: 2,
            bgcolor: alpha(theme.palette.grey[50], 0.5),
            borderColor: 'divider',
          }}
        >
          <Stepper
            activeStep={activeStep}
            alternativeLabel
            connector={<QConnector />}
            sx={{
              mb: 2.5,
              px: { xs: 0, sm: 1 },
              '& .MuiStepLabel-label': {
                fontSize: { xs: '0.7rem', sm: '0.8rem' },
                fontWeight: 600,
                mt: 0.5,
              },
              '& .MuiStepLabel-label.Mui-active': { color: 'primary.main' },
              '& .MuiStepLabel-label.Mui-completed': { color: 'text.secondary' },
            }}
          >
            {STEPS.map((s) => (
              <Step key={s.label}>
                <StepLabel>{s.label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: 2,
              bgcolor: 'background.paper',
              border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
              boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.04)}`,
            }}
          >
            <Typography
              variant="caption"
              color="primary"
              sx={{ display: 'block', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.5 }}
            >
              Step {activeStep + 1} of {STEPS.length} — {STEPS[activeStep].short}
            </Typography>

            {activeStep === 0 && (
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={7}>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    label="Customer code"
                    value={formData.customer_code}
                    onChange={(e) =>
                      setFormData({ ...formData, customer_code: e.target.value.toUpperCase().replace(/\s+/g, '') })
                    }
                    helperText="Required. Same code can link multiple subsidiaries."
                    sx={compactField}
                    InputProps={{
                      endAdornment: codeLookup.loading ? (
                        <InputAdornment position="end">
                          <CircularProgress size={16} />
                        </InputAdornment>
                      ) : null,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={5} sx={{ display: 'flex', alignItems: 'center', justifyContent: { md: 'flex-end' } }}>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      />
                    }
                    label={<Typography variant="body2">Active</Typography>}
                  />
                </Grid>

                {formData.customer_code.trim().length > 0 && (
                  <Grid item xs={12}>
                    {codeLookup.customers.length > 0 ? (
                      <Alert severity="info" sx={{ py: 0.5, '& .MuiAlert-message': { width: '100%' } }}>
                        <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.75 }}>
                          Code in use — linked entities ({codeLookup.customers.length})
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.75}>
                          {codeLookup.customers.map((c) => (
                            <Chip
                              key={c.id}
                              size="small"
                              label={`${c.company_legal_name}${c.city ? ` · ${c.city}` : ''}`}
                              variant="outlined"
                              color={c.is_active ? 'primary' : 'default'}
                              sx={{ fontWeight: 600, maxWidth: '100%' }}
                            />
                          ))}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
                          You are adding another subsidiary under this group code.
                        </Typography>
                      </Alert>
                    ) : (
                      !codeLookup.loading && (
                        <Alert severity="success" sx={{ py: 0.5 }}>
                          New group code — first entity for &quot;{formData.customer_code.trim()}&quot;.
                        </Alert>
                      )
                    )}
                  </Grid>
                )}

                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    label="Company legal name"
                    value={formData.company_legal_name}
                    onChange={(e) => setFormData({ ...formData, company_legal_name: e.target.value })}
                    placeholder="Legal entity / subsidiary name"
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={4} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Currency"
                    value={formData.default_currency}
                    onChange={(e) => setFormData({ ...formData, default_currency: e.target.value.toUpperCase() })}
                    inputProps={{ maxLength: 3 }}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={4} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Language"
                    value={formData.preferred_language}
                    onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value })}
                    placeholder="en"
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="edufire.co.uk or https://…"
                    helperText="Domain alone is fine — https:// is added automatically"
                    sx={compactField}
                  />
                </Grid>
              </Grid>
            )}

            {activeStep === 1 && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mb: 1, display: 'block' }}>
                  Registered address
                </Typography>
                <Grid container spacing={1.25} sx={{ mb: 2 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <TextField
                      required
                      fullWidth
                      size="small"
                      label="Country"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      sx={compactField}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="City"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      sx={compactField}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Region / state"
                      value={formData.region_state}
                      onChange={(e) => setFormData({ ...formData, region_state: e.target.value })}
                      sx={compactField}
                    />
                  </Grid>
                  <Grid item xs={6} sm={3} md={2}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Postal"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      sx={compactField}
                    />
                  </Grid>
                  <Grid item xs={12} sm={9} md={2} />
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Address line 1"
                      value={formData.address_line1}
                      onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                      sx={compactField}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Address line 2"
                      value={formData.address_line2}
                      onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                      sx={compactField}
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ mb: 1.5 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Contacts
                  </Typography>
                  <Button size="small" startIcon={<PersonAdd fontSize="small" />} onClick={addContact}>
                    Add contact
                  </Button>
                </Box>

                <Stack spacing={1}>
                  {formData.contacts.map((contact, ci) => (
                    <Box
                      key={ci}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                        bgcolor: contact.is_primary ? alpha(theme.palette.primary.main, 0.04) : 'background.paper',
                      }}
                    >
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Name"
                            value={contact.name}
                            onChange={(e) => setContact(ci, { name: e.target.value })}
                            sx={compactField}
                          />
                        </Grid>
                        <Grid item xs={12} sm={2.5}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Designation"
                            value={contact.designation}
                            onChange={(e) => setContact(ci, { designation: e.target.value })}
                            placeholder="Buyer, MD…"
                            sx={compactField}
                          />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="email"
                            label="Email"
                            value={contact.email}
                            onChange={(e) => setContact(ci, { email: e.target.value })}
                            sx={compactField}
                          />
                        </Grid>
                        <Grid item xs={9} sm={2.5}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Phone"
                            value={contact.phone}
                            onChange={(e) => setContact(ci, { phone: e.target.value })}
                            sx={compactField}
                          />
                        </Grid>
                        <Grid item xs={3} sm={1} sx={{ display: 'flex', justifyContent: 'center', gap: 0.25 }}>
                          <Tooltip title={contact.is_primary ? 'Primary contact' : 'Set as primary'}>
                            <IconButton size="small" onClick={() => setPrimaryContact(ci)} color={contact.is_primary ? 'primary' : 'default'}>
                              <Star fontSize="small" sx={{ opacity: contact.is_primary ? 1 : 0.35 }} />
                            </IconButton>
                          </Tooltip>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeContact(ci)}
                            disabled={formData.contacts.length <= 1}
                            aria-label="Remove contact"
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Grid>
                      </Grid>
                      {contact.is_primary && (
                        <Typography variant="caption" color="primary.main" fontWeight={700} sx={{ mt: 0.5, display: 'block' }}>
                          Primary — used on PIs and lists
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

          </Box>
        </DialogContent>
        <DialogActions
          sx={{
            flexWrap: 'wrap',
            gap: 1,
            px: 2,
            py: 1.5,
            borderTop: `1px solid ${theme.palette.divider}`,
            bgcolor: alpha(theme.palette.grey[50], 0.6),
          }}
        >
          <Button onClick={handleCloseDialog} color="inherit" size="small">
            Cancel
          </Button>
          <Box sx={{ flex: 1 }} />
          {activeStep > 0 && (
            <Button onClick={handleBack} startIcon={<ArrowBack fontSize="small" />} size="small" color="inherit">
              Back
            </Button>
          )}
          {!isLastStep && (
            <Button onClick={handleNext} variant="contained" endIcon={<ArrowForward fontSize="small" />} size="small">
              Next
            </Button>
          )}
          {isLastStep && (
            <Button onClick={handleSubmit} variant="contained" size="small" disableElevation>
              {selected ? 'Save' : 'Create customer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Customers;
