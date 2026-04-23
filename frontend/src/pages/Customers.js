import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Paper,
} from '@mui/material';
import { alpha, styled, useTheme } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, ArrowBack, ArrowForward, Search } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import { slate, warm } from '../theme/appTheme';
import { customersAPI } from '../services/api';

const emptyForm = {
  customer_code: '',
  company_legal_name: '',
  trading_name: '',
  country: '',
  region_state: '',
  city: '',
  postal_code: '',
  address_line1: '',
  address_line2: '',
  primary_email: '',
  secondary_email: '',
  phone: '',
  mobile: '',
  fax: '',
  website: '',
  tax_id_vat: '',
  default_currency: 'USD',
  preferred_language: 'en',
  incoterms_default: '',
  payment_terms_default: '',
  bank_details: '',
  notes: '',
  is_active: true,
};

const STEPS = [
  { label: 'Company', short: 'Identity & defaults' },
  { label: 'Address & contact', short: 'Location & how to reach them' },
  { label: 'Trade & banking', short: 'Terms, tax & remittance' },
];

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
      [r.customer_code, r.company_legal_name, r.trading_name, r.primary_email, r.city, r.country]
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
        setFormData({
          customer_code: c.customer_code,
          company_legal_name: c.company_legal_name,
          trading_name: c.trading_name || '',
          country: c.country || '',
          region_state: c.region_state || '',
          city: c.city || '',
          postal_code: c.postal_code || '',
          address_line1: c.address_line1 || '',
          address_line2: c.address_line2 || '',
          primary_email: c.primary_email || '',
          secondary_email: c.secondary_email || '',
          phone: c.phone || '',
          mobile: c.mobile || '',
          fax: c.fax || '',
          website: c.website || '',
          tax_id_vat: c.tax_id_vat || '',
          default_currency: c.default_currency || 'USD',
          preferred_language: c.preferred_language || 'en',
          incoterms_default: c.incoterms_default || '',
          payment_terms_default: c.payment_terms_default || '',
          bank_details: c.bank_details || '',
          notes: c.notes || '',
          is_active: c.is_active,
        });
      } catch (e) {
        console.error(e);
        alert('Could not load customer');
        return;
      }
    } else {
      setSelected(null);
      setFormData(emptyForm);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelected(null);
    setActiveStep(0);
  };

  const handleSubmit = async () => {
    try {
      if (selected) {
        await customersAPI.update(selected.id, formData);
      } else {
        await customersAPI.create(formData);
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

  const handleNext = () => {
    if (activeStep === 0 && !canProceedFromStep0()) {
      alert('Enter customer code and company legal name to continue.');
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

  /** MUI sets background on each .columnHeader (paper); override both container + cells + corner fillers. */
  const headerSolid = theme.palette.primary.dark;
  const customersGridSx = {
    border: 'none',
    fontFamily: theme.typography.fontFamily,
    '& .MuiDataGrid-columnHeaders': {
      background: `linear-gradient(180deg, ${alpha(headerSolid, 1)} 0%, ${alpha(theme.palette.primary.main, 0.88)} 100%)`,
      borderBottom: `1px solid ${alpha('#000', 0.28)}`,
      boxShadow: `inset 0 -1px 0 ${alpha('#fff', 0.1)}`,
    },
    '& .MuiDataGrid-columnHeader': {
      background: `linear-gradient(180deg, ${headerSolid} 0%, ${alpha(theme.palette.primary.main, 0.85)} 100%) !important`,
      color: '#ffffff !important',
      fontSize: '0.75rem',
      fontWeight: 800,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      borderRight: `1px solid ${alpha('#fff', 0.14)} !important`,
      WebkitFontSmoothing: 'antialiased',
    },
    '& .MuiDataGrid-columnHeaderTitle, & .MuiDataGrid-columnHeaderTitleContainer, & .MuiDataGrid-columnHeaderTitleContainerContent':
      {
        color: '#ffffff !important',
        opacity: '1 !important',
        fontWeight: 800,
      },
    '& .MuiDataGrid-iconButtonContainer': { color: '#ffffff !important' },
    '& .MuiDataGrid-sortIcon, & .MuiDataGrid-menuIcon .MuiSvgIcon-root': {
      color: `${alpha('#fff', 0.95)} !important`,
    },
    '& .MuiDataGrid-columnSeparator': { color: alpha('#fff', 0.35) },
    '& .MuiDataGrid-scrollbarFiller--header, & .MuiDataGrid-filler--header': {
      backgroundColor: `${headerSolid} !important`,
    },
    '& .MuiDataGrid-main': {
      backgroundColor: '#ffffff',
      backgroundImage: 'none',
    },
    '& .MuiDataGrid-virtualScroller': {
      backgroundColor: '#ffffff',
    },
    '& .MuiDataGrid-row': {
      transition: 'background-color 0.15s ease',
      borderBottom: `1px solid ${alpha(slate[200], 0.75)} !important`,
    },
    '& .MuiDataGrid-row.customer-row--alt': {
      backgroundColor: alpha(theme.palette.primary.main, 0.028),
    },
    '& .MuiDataGrid-row:hover': {
      backgroundColor: `${alpha(theme.palette.info.main, 0.09)} !important`,
    },
    '& .MuiDataGrid-cell': {
      py: 0.35,
      borderColor: alpha(slate[200], 0.6),
      fontSize: '0.8125rem',
      fontWeight: 700,
      '& .MuiTypography-root': { fontWeight: 700 },
      '& .MuiChip-label, & .MuiChip-root': { fontWeight: 700 },
    },
    '& .MuiDataGrid-cell:focus, & .MuiDataGrid-columnHeader:focus': { outline: 'none' },
    '& .MuiDataGrid-footerContainer': {
      minHeight: 48,
      borderTop: `1px solid ${alpha(slate[200], 0.9)} !important`,
      backgroundColor: '#ffffff',
    },
  };

  const columns = [
    {
      field: 'customer_code',
      headerName: 'Code',
      minWidth: 92,
      flex: 0.5,
      renderCell: (p) => (
        <Chip
          label={p.value || '—'}
          size="small"
          variant="outlined"
          sx={{
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            fontWeight: 700,
            fontSize: '0.7rem',
            height: 22,
            borderColor: alpha(theme.palette.primary.main, 0.4),
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: theme.palette.primary.dark,
          }}
        />
      ),
    },
    {
      field: 'company_legal_name',
      headerName: 'Legal name',
      minWidth: 200,
      flex: 1.4,
      renderCell: (p) => (
        <Tooltip title={p.value || '—'} enterDelay={500}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 700, color: 'text.primary', lineHeight: 1.35, display: 'block' }}
            noWrap
          >
            {p.value || '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'trading_name',
      headerName: 'Trading as',
      minWidth: 110,
      flex: 0.6,
      renderCell: (p) => (
        <Typography variant="body2" color="text.secondary" noWrap sx={{ fontWeight: 500 }}>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'country',
      headerName: 'Country',
      minWidth: 96,
      flex: 0.5,
      renderCell: (p) =>
        p.value ? (
          <Chip
            label={p.value}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              fontWeight: 600,
              bgcolor: alpha(theme.palette.info.main, 0.12),
              color: theme.palette.info.dark,
              border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
            }}
          />
        ) : (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ),
    },
    {
      field: 'city',
      headerName: 'City',
      minWidth: 86,
      flex: 0.5,
      renderCell: (p) => (
        <Typography variant="body2" sx={{ fontWeight: 500, color: slate[700] }} noWrap>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'primary_email',
      headerName: 'Email',
      minWidth: 200,
      flex: 1.05,
      renderCell: (p) => (
        <Tooltip title={p.value || ''}>
          <Typography
            variant="body2"
            component="span"
            sx={{
              fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
              fontSize: '0.78rem',
              color: p.value ? theme.palette.primary.main : 'text.disabled',
              fontWeight: 500,
              display: 'block',
            }}
            noWrap
          >
            {p.value || '—'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'default_currency',
      headerName: 'CCY',
      minWidth: 64,
      flex: 0.3,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => (
        <Chip
          label={(p.value || '—').toString().toUpperCase()}
          size="small"
          sx={{
            minWidth: 40,
            height: 22,
            fontWeight: 800,
            fontSize: '0.68rem',
            fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
            bgcolor: alpha(theme.palette.secondary.main, 0.12),
            color: slate[800],
            border: `1px solid ${alpha(slate[400], 0.35)}`,
          }}
        />
      ),
    },
    {
      field: 'is_active',
      headerName: 'Status',
      minWidth: 84,
      flex: 0.4,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => (
        <Chip
          label={p.value ? 'Active' : 'Off'}
          size="small"
          color={p.value ? 'success' : 'default'}
          variant={p.value ? 'filled' : 'outlined'}
          sx={{ fontWeight: 700, fontSize: '0.65rem', height: 22 }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      minWidth: 120,
      flex: 0.55,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => (
        <Box sx={{ display: 'flex', width: '100%', gap: 0, justifyContent: 'center' }}>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => handleOpenDialog(p.row)}
              sx={{
                color: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.16) },
              }}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={() => handleDelete(p.row.id)}
              sx={{
                color: theme.palette.error.main,
                bgcolor: alpha(theme.palette.error.main, 0.06),
                '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.12) },
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

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

      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: '100%',
          mx: 0,
          mb: 2,
          borderRadius: 2.5,
          overflow: 'hidden',
          border: `1px solid ${alpha(slate[200], 0.95)}`,
          borderLeft: `5px solid ${theme.palette.primary.main}`,
          boxShadow: `0 4px 28px ${alpha(slate[900], 0.09)}, 0 0 0 1px ${alpha(slate[100], 0.8)}`,
          bgcolor: '#ffffff',
        }}
      >
        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            py: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.07)} 0%, ${alpha(theme.palette.info.main, 0.04)} 45%, ${alpha(warm[100], 0.5)} 100%)`,
            borderBottom: `1px solid ${alpha(slate[200], 0.9)}`,
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Search by code, name, email, city…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search customers"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: theme.palette.primary.main, fontSize: 22, opacity: 0.85 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              maxWidth: { xs: '100%', md: 640 },
              '& .MuiOutlinedInput-root': {
                bgcolor: alpha('#fff', 0.95),
                borderRadius: 2,
                boxShadow: `0 1px 4px ${alpha(slate[900], 0.07)}`,
                border: `1px solid ${alpha(slate[200], 0.95)}`,
                '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.45) },
                '&.Mui-focused': {
                  borderColor: 'primary.main',
                  boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.15)}`,
                },
              },
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontWeight: 500 }}>
            {filteredRows.length} {filteredRows.length === 1 ? 'customer' : 'customers'}
            {searchQuery.trim() ? ' · filtered' : ''}
          </Typography>
        </Box>

        <Box sx={{ width: '100%', '& .MuiDataGrid-root': { border: 'none' } }}>
          <DataGrid
            rows={filteredRows}
            columns={columns}
            getRowId={(r) => r.id}
            getRowClassName={(params) =>
              params.indexRelativeToCurrentPage % 2 === 0 ? 'customer-row--alt' : ''
            }
            autoHeight
            rowHeight={38}
            columnHeaderHeight={40}
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            loading={loading}
            disableRowSelectionOnClick
            sx={{
              ...customersGridSx,
              width: '100%',
            }}
          />
        </Box>
      </Paper>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth scroll="paper">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
            {selected ? 'Edit customer' : 'New customer'}
          </Typography>
          {isNew && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
              A quick 3-step setup—save time with compact fields you can complete in order.
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
              Step {activeStep + 1} of 3 — {STEPS[activeStep].short}
            </Typography>

            {activeStep === 0 && (
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    label="Customer code"
                    value={formData.customer_code}
                    onChange={(e) => setFormData({ ...formData, customer_code: e.target.value })}
                    disabled={!!selected}
                    helperText="Unique. Cannot change after create."
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
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
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    label="Company legal name"
                    value={formData.company_legal_name}
                    onChange={(e) => setFormData({ ...formData, company_legal_name: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Trading name"
                    value={formData.trading_name}
                    onChange={(e) => setFormData({ ...formData, trading_name: e.target.value })}
                    helperText="On documents, if different from legal name"
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Default currency"
                    value={formData.default_currency}
                    onChange={(e) => setFormData({ ...formData, default_currency: e.target.value.toUpperCase() })}
                    inputProps={{ maxLength: 3 }}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Preferred language"
                    value={formData.preferred_language}
                    onChange={(e) => setFormData({ ...formData, preferred_language: e.target.value })}
                    placeholder="e.g. en"
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://"
                    sx={compactField}
                  />
                </Grid>
              </Grid>
            )}

            {activeStep === 1 && (
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    size="small"
                    label="Country / territory"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    helperText="Name or ISO code"
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Region / state"
                    value={formData.region_state}
                    onChange={(e) => setFormData({ ...formData, region_state: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="City"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={6} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Postal code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={4} />
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={1}
                    maxRows={3}
                    label="Address line 1"
                    value={formData.address_line1}
                    onChange={(e) => setFormData({ ...formData, address_line1: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={1}
                    maxRows={3}
                    label="Address line 2"
                    value={formData.address_line2}
                    onChange={(e) => setFormData({ ...formData, address_line2: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    label="Primary email"
                    value={formData.primary_email}
                    onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    label="Secondary email"
                    value={formData.secondary_email}
                    onChange={(e) => setFormData({ ...formData, secondary_email: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Fax"
                    value={formData.fax}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
              </Grid>
            )}

            {activeStep === 2 && (
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Tax / VAT ID"
                    value={formData.tax_id_vat}
                    onChange={(e) => setFormData({ ...formData, tax_id_vat: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Default Incoterms"
                    value={formData.incoterms_default}
                    onChange={(e) => setFormData({ ...formData, incoterms_default: e.target.value })}
                    placeholder="FOB, CIF…"
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    maxRows={5}
                    label="Default payment terms"
                    value={formData.payment_terms_default}
                    onChange={(e) => setFormData({ ...formData, payment_terms_default: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    maxRows={8}
                    label="Bank details (PI / remittance)"
                    value={formData.bank_details}
                    onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                    placeholder="Account name, bank, IBAN, SWIFT…"
                    sx={compactField}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={1}
                    maxRows={4}
                    label="Internal notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    sx={compactField}
                  />
                </Grid>
              </Grid>
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
