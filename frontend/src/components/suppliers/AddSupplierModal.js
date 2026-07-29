import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogContent, DialogActions,
  Box, Button, TextField, IconButton, Typography, Grid, MenuItem,
  CircularProgress, Autocomplete, FormControlLabel, Switch, InputAdornment, Chip,
} from '@mui/material';
import {
  Close, Save, LocalShipping, Public, ContactMail, Receipt,
  Business, Home, LocationCity, Map, MarkunreadMailbox, Person,
  Email, Phone, Language, StickyNote2, CurrencyExchange, Badge,
  CheckCircle, Category,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { suppliersAPI } from '../../services/api';
import { slate, warm } from '../../theme/appTheme';
import { confirmDiscardUnsaved } from '../../hooks/useUnsavedChanges';

export const COUNTRY_SUGGESTIONS = [
  'India', 'China', 'Bangladesh', 'Vietnam', 'Turkey', 'Pakistan', 'Sri Lanka',
  'Indonesia', 'Thailand', 'Myanmar', 'Cambodia', 'USA', 'United Kingdom',
  'Germany', 'Italy', 'Hong Kong', 'Taiwan', 'South Korea', 'Japan',
];

export const DOMESTIC_TAX_TYPES = ['GST'];
export const INTERNATIONAL_TAX_TYPES = [
  'VAT', 'EIN', 'Company Reg No', 'Business Number', 'TIN', 'Tax ID', 'Other',
];

export const CURRENCY_OPTIONS = ['INR', 'USD', 'EUR', 'GBP', 'CNY', 'BDT', 'VND', 'TRY', 'AED', 'SGD', 'HKD', 'JPY', 'KRW'];

export const emptySupplierForm = () => ({
  name: '',
  address: '',
  city: '',
  state_province: '',
  postal_code: '',
  country: 'India',
  contact_person: '',
  email: '',
  phone: '',
  website: '',
  is_international: false,
  tax_id_type: 'GST',
  gst: '',
  currency: '',
  supplies_in: [],
  notes: '',
  is_active: true,
});

export function supplierToForm(row) {
  if (!row) return emptySupplierForm();
  const isIntl = row.is_international ?? (row.country && row.country !== 'India');
  const supplies = Array.isArray(row.supplies_in)
    ? row.supplies_in.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  return {
    name: row.name || '',
    address: row.address || '',
    city: row.city || '',
    state_province: row.state_province || '',
    postal_code: row.postal_code || '',
    country: row.country || '',
    contact_person: row.contact_person || '',
    email: row.email || '',
    phone: row.phone || '',
    website: row.website || '',
    is_international: isIntl,
    tax_id_type: row.tax_id_type || (isIntl ? '' : 'GST'),
    gst: row.gst || '',
    currency: row.currency || '',
    supplies_in: supplies,
    notes: row.notes || '',
    is_active: row.is_active !== false,
  };
}

const modalTexture = {
  background: `
    radial-gradient(ellipse 90% 60% at 0% 0%, ${alpha('#0f766e', 0.06)}, transparent 55%),
    radial-gradient(ellipse 70% 50% at 100% 100%, ${alpha(slate[600], 0.04)}, transparent 50%),
    ${warm.canvas}
  `,
  backgroundImage: `
    radial-gradient(circle at 1px 1px, ${alpha(slate[600], 0.045)} 1px, transparent 0),
    repeating-linear-gradient(
      -11deg,
      ${alpha(slate[800], 0.014)} 0px,
      ${alpha(slate[800], 0.014)} 1px,
      transparent 1px,
      transparent 7px
    )
  `,
  backgroundSize: '18px 18px, auto',
};

const spectrumAccent = '#6366f1';

function IconBadge({ icon: Icon, color = 'primary.main' }) {
  return (
    <Box sx={{
      width: 28, height: 28, borderRadius: 1.25, flexShrink: 0,
      display: 'grid', placeItems: 'center',
      bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
      color,
      border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.18)}`,
    }}>
      <Icon sx={{ fontSize: 15 }} />
    </Box>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 1.75 }}>
      <IconBadge icon={Icon} />
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: slate[700], textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1.2 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>{subtitle}</Typography>
        )}
      </Box>
    </Box>
  );
}

function SectionCard({ children, accent }) {
  return (
    <Box sx={{
      p: 2, borderRadius: 2.5,
      bgcolor: alpha('#fff', 0.92),
      border: `1px solid ${slate[200]}`,
      boxShadow: `0 1px 3px ${alpha(slate[900], 0.04)}`,
      position: 'relative',
      overflow: 'hidden',
      '&::before': accent ? {
        content: '""',
        position: 'absolute',
        left: 0, top: 0, bottom: 0,
        width: 3,
        bgcolor: accent,
        borderRadius: '3px 0 0 3px',
      } : undefined,
    }}>
      {children}
    </Box>
  );
}

function fieldIcon(Icon) {
  return {
    startAdornment: (
      <InputAdornment position="start">
        <Icon sx={{ fontSize: 17, color: alpha(slate[500], 0.85) }} />
      </InputAdornment>
    ),
  };
}

export default function AddSupplierModal({ open, onClose, onSaved, editing = null }) {
  const theme = useTheme();
  const [form, setForm] = useState(emptySupplierForm());
  const [saving, setSaving] = useState(false);
  const baselineRef = useRef(JSON.stringify(emptySupplierForm()));
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const next = supplierToForm(editing);
      setForm(next);
      baselineRef.current = JSON.stringify(next);
    }
    wasOpen.current = open;
  }, [open, editing]);

  const isDirty = open && JSON.stringify(form) !== baselineRef.current;

  const handleClose = () => {
    if (saving) return;
    if (!confirmDiscardUnsaved(isDirty)) return;
    setForm(emptySupplierForm());
    onClose();
  };

  const setInternational = (checked) => {
    setForm((f) => ({
      ...f,
      is_international: checked,
      tax_id_type: checked ? (INTERNATIONAL_TAX_TYPES.includes(f.tax_id_type) ? f.tax_id_type : '') : 'GST',
      currency: checked ? f.currency : '',
    }));
  };

  const handleCountryChange = (country) => {
    const isIndia = country.trim().toLowerCase() === 'india';
    setForm((f) => ({
      ...f,
      country,
      is_international: isIndia ? false : f.is_international || !isIndia,
      tax_id_type: isIndia ? 'GST' : f.tax_id_type,
      currency: isIndia ? '' : f.currency,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Supplier name is required.'); return; }
    if (!form.country.trim()) { alert('Country is required.'); return; }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        country: form.country.trim(),
        gst: form.gst.trim(),
        tax_id_type: form.is_international ? form.tax_id_type.trim() : (form.tax_id_type.trim() || 'GST'),
        contact_person: form.contact_person.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
        city: form.city.trim(),
        state_province: form.state_province.trim(),
        postal_code: form.postal_code.trim(),
        currency: form.is_international ? form.currency.trim() : '',
        supplies_in: (form.supplies_in || []).map((x) => String(x).trim()).filter(Boolean),
      };
      let saved;
      if (editing) {
        const res = await suppliersAPI.update(editing.id, payload);
        saved = res.data;
      } else {
        const res = await suppliersAPI.create(payload);
        saved = res.data;
      }
      setForm(emptySupplierForm());
      onSaved?.(saved);
      onClose();
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert('Save failed: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const taxTypeOptions = form.is_international ? INTERNATIONAL_TAX_TYPES : DOMESTIC_TAX_TYPES;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', boxShadow: `0 24px 48px ${alpha(slate[900], 0.14)}` } }}
    >
      {/* Header banner */}
      <Box sx={{
        position: 'relative',
        px: 3, py: 2.25,
        background: `linear-gradient(135deg, ${slate[900]} 0%, #1a3d3a 55%, ${theme.palette.primary.dark} 100%)`,
        color: '#fff',
        overflow: 'hidden',
      }}>
        <Box aria-hidden sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `
            repeating-linear-gradient(
              -12deg,
              ${alpha('#fff', 0.035)} 0px,
              ${alpha('#fff', 0.035)} 1px,
              transparent 1px,
              transparent 8px
            )
          `,
        }} />
        <Box aria-hidden sx={{
          position: 'absolute', top: -40, right: -20, width: 180, height: 180,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.light, 0.22)} 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            display: 'grid', placeItems: 'center',
            bgcolor: alpha('#fff', 0.12),
            border: `1px solid ${alpha('#fff', 0.2)}`,
          }}>
            <LocalShipping sx={{ fontSize: 24 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: alpha('#fff', 0.55), mb: 0.25 }}>
              Supplier Master
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2 }}>
              {editing ? 'Edit Supplier' : 'Add Supplier'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose} disabled={saving}
            sx={{ color: alpha('#fff', 0.6), '&:hover': { color: '#fff', bgcolor: alpha('#fff', 0.08) } }}>
            <Close />
          </IconButton>
        </Box>
      </Box>

      <DialogContent sx={{ p: 0, ...modalTexture }}>
        <Box sx={{ px: 3, py: 2.5 }}>
          <Grid container spacing={2.5}>
            {/* Basic */}
            <Grid item xs={12}>
              <SectionCard accent={theme.palette.primary.main}>
                <SectionTitle icon={Business} title="Company Details" subtitle="Legal name and status" />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={8}>
                    <TextField
                      fullWidth size="small" label="Supplier Name *" autoFocus
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. ABC Trims Pvt Ltd"
                      InputProps={fieldIcon(Business)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.is_active}
                          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                        />
                      }
                      label={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CheckCircle sx={{ fontSize: 16, color: form.is_active ? 'success.main' : 'text.disabled' }} />
                          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>Active supplier</Typography>
                        </Box>
                      }
                    />
                  </Grid>
                </Grid>
              </SectionCard>
            </Grid>

            {/* Address */}
            <Grid item xs={12}>
              <SectionCard accent={spectrumAccent}>
                <SectionTitle icon={Public} title="Address" subtitle="Location and country" />
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth size="small" label="Street Address"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="Building, street, area"
                      InputProps={fieldIcon(Home)}
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" label="City"
                      value={form.city}
                      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                      InputProps={fieldIcon(LocationCity)} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" label="State / Province"
                      value={form.state_province}
                      onChange={(e) => setForm((f) => ({ ...f, state_province: e.target.value }))}
                      InputProps={fieldIcon(Map)} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" label="Postal / ZIP Code"
                      value={form.postal_code}
                      onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))}
                      InputProps={fieldIcon(MarkunreadMailbox)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Autocomplete
                      freeSolo
                      options={COUNTRY_SUGGESTIONS}
                      value={form.country}
                      onInputChange={(_, v) => handleCountryChange(v)}
                      renderInput={(params) => (
                        <TextField {...params} size="small" fullWidth label="Country *"
                          InputProps={{
                            ...params.InputProps,
                            startAdornment: (
                              <>
                                <InputAdornment position="start">
                                  <Public sx={{ fontSize: 17, color: alpha(slate[500], 0.85) }} />
                                </InputAdornment>
                                {params.InputProps.startAdornment}
                              </>
                            ),
                          }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </SectionCard>
            </Grid>

            {/* Contact */}
            <Grid item xs={12}>
              <SectionCard accent="#0ea5e9">
                <SectionTitle icon={ContactMail} title="Contact Information" subtitle="Primary point of contact" />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Contact Person"
                      value={form.contact_person}
                      onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
                      placeholder="Primary contact name"
                      InputProps={fieldIcon(Person)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Email" type="email"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="sales@supplier.com"
                      InputProps={fieldIcon(Email)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Phone / WhatsApp"
                      value={form.phone}
                      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                      placeholder="+91 … or +86 …"
                      InputProps={fieldIcon(Phone)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth size="small" label="Website"
                      value={form.website}
                      onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                      placeholder="https://…"
                      InputProps={fieldIcon(Language)} />
                  </Grid>
                </Grid>
              </SectionCard>
            </Grid>

            {/* Tax */}
            <Grid item xs={12}>
              <SectionCard accent="#7c3aed">
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, mb: 2 }}>
                  <IconBadge icon={Receipt} color="#7c3aed" />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.82rem', color: slate[700], textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Tax & Registration
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
                      GST for domestic · VAT / EIN for international
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={form.is_international}
                        onChange={(e) => setInternational(e.target.checked)}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Public sx={{ fontSize: 15, color: form.is_international ? 'primary.main' : 'text.disabled' }} />
                        <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>International</Typography>
                      </Box>
                    }
                    sx={{ mr: 0 }}
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth size="small" select label="Tax ID Type"
                      value={form.tax_id_type}
                      onChange={(e) => setForm((f) => ({ ...f, tax_id_type: e.target.value }))}
                      disabled={!form.is_international && form.tax_id_type === 'GST'}
                      InputProps={fieldIcon(Badge)}>
                      {taxTypeOptions.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={form.is_international ? 4 : 8}>
                    <TextField fullWidth size="small"
                      label={form.is_international ? 'Tax / Registration Number' : 'GST Number'}
                      value={form.gst}
                      onChange={(e) => setForm((f) => ({ ...f, gst: e.target.value }))}
                      placeholder={form.is_international ? 'VAT / EIN / Company Reg No' : '22AAAAA0000A1Z5'}
                      InputProps={fieldIcon(Receipt)} />
                  </Grid>
                  {form.is_international && (
                    <Grid item xs={12} sm={4}>
                      <Autocomplete
                        freeSolo
                        options={CURRENCY_OPTIONS}
                        value={form.currency}
                        onInputChange={(_, v) => setForm((f) => ({ ...f, currency: v }))}
                        renderInput={(params) => (
                          <TextField {...params} size="small" fullWidth label="Invoicing Currency"
                            placeholder="USD, EUR, CNY…"
                            InputProps={{
                              ...params.InputProps,
                              startAdornment: (
                                <>
                                  <InputAdornment position="start">
                                    <CurrencyExchange sx={{ fontSize: 17, color: alpha(slate[500], 0.85) }} />
                                  </InputAdornment>
                                  {params.InputProps.startAdornment}
                                </>
                              ),
                            }}
                          />
                        )}
                      />
                    </Grid>
                  )}
                </Grid>

                {form.is_international && (
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 1.5, pl: 0.5 }}>
                    For overseas suppliers, enter VAT, EIN, company registration, or other local tax identifiers.
                  </Typography>
                )}
              </SectionCard>
            </Grid>

            {/* Supplies In */}
            <Grid item xs={12}>
              <SectionCard accent="#0f766e">
                <SectionTitle
                  icon={Category}
                  title="Supplies In"
                  subtitle="Trim names this supplier provides — auto-filled from indents, editable here"
                />
                <Autocomplete
                  multiple
                  freeSolo
                  options={[]}
                  value={form.supplies_in || []}
                  onChange={(_, v) => setForm((f) => ({
                    ...f,
                    supplies_in: [...new Set(v.map((x) => String(x).trim()).filter(Boolean))],
                  }))}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={`${option}-${index}`}
                        label={option}
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      size="small"
                      label="Trim types / names"
                      placeholder="Type a trim name and press Enter"
                      helperText="Used to segregate and prioritize suppliers when building indents"
                    />
                  )}
                />
              </SectionCard>
            </Grid>

            {/* Notes */}
            <Grid item xs={12}>
              <SectionCard>
                <SectionTitle icon={StickyNote2} title="Notes" subtitle="Payment terms, lead times, special instructions" />
                <TextField fullWidth size="small" multiline minRows={2} label="Notes"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  InputProps={fieldIcon(StickyNote2)} />
              </SectionCard>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions sx={{
        px: 3, py: 2,
        bgcolor: alpha('#fff', 0.95),
        borderTop: `1px solid ${slate[200]}`,
        backgroundImage: `repeating-linear-gradient(90deg, ${alpha(slate[200], 0.35)} 0px, ${alpha(slate[200], 0.35)} 1px, transparent 1px, transparent 24px)`,
      }}>
        <Button onClick={handleClose} disabled={saving} sx={{ fontWeight: 700, textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
          sx={{ fontWeight: 800, textTransform: 'none', px: 3, boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.35)}` }}>
          {saving ? 'Saving…' : editing ? 'Save Supplier' : 'Add Supplier'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
