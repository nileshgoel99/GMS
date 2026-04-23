import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  Grid,
  Paper,
  Stack,
  Divider,
  CircularProgress,
} from '@mui/material';
import { Save, CloudUpload } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import { companyAPI } from '../services/api';

const emptyForm = {
  legal_name: '',
  trading_name: '',
  tagline: '',
  address_line1: '',
  address_line2: '',
  city: '',
  region_state: '',
  postal_code: '',
  country: '',
  phone: '',
  fax: '',
  email: '',
  website: '',
  tax_registration: '',
  watermark_text: '',
  pdf_footer_note: '',
};

const CompanyPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  const logoObjectUrl = useMemo(() => {
    if (!logoFile) return null;
    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  useEffect(() => {
    return () => {
      if (logoObjectUrl) URL.revokeObjectURL(logoObjectUrl);
    };
  }, [logoObjectUrl]);

  const displayLogo = logoObjectUrl || logoUrl;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await companyAPI.getProfile();
      setForm({
        legal_name: data.legal_name || '',
        trading_name: data.trading_name || '',
        tagline: data.tagline || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        region_state: data.region_state || '',
        postal_code: data.postal_code || '',
        country: data.country || '',
        phone: data.phone || '',
        fax: data.fax || '',
        email: data.email || '',
        website: data.website || '',
        tax_registration: data.tax_registration || '',
        watermark_text: data.watermark_text || '',
        pdf_footer_note: data.pdf_footer_note || '',
      });
      setLogoUrl(data.logo_url || null);
      setLogoFile(null);
    } catch (e) {
      console.error(e);
      alert('Could not load company profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!form.legal_name.trim()) {
      alert('Legal name is required.');
      return;
    }
    setSaving(true);
    try {
      if (logoFile) {
        const fd = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          fd.append(k, v == null ? '' : String(v));
        });
        fd.set('legal_name', form.legal_name.trim());
        fd.append('logo', logoFile);
        await companyAPI.updateProfile(fd);
      } else {
        await companyAPI.updateProfile({ ...form, legal_name: form.legal_name.trim() });
      }
      await load();
      alert('Company details saved. PI PDFs will use this letterhead.');
    } catch (e) {
      console.error(e);
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        kicker="Organization"
        title="Company details"
        subtitle="Letterhead, logo, and footer used on proforma PDFs and future exports. Keep legal name and tax lines accurate for customs."
        actions={
          <Button variant="contained" size="large" startIcon={<Save />} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Logo &amp; branding
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Square or wide PNG/JPG works best. Shown on the top-left of every PI PDF. Watermark appears lightly on each page.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
          {displayLogo ? (
            <Box
              component="img"
              src={displayLogo}
              alt="Company logo"
              sx={{ maxWidth: 200, maxHeight: 80, objectFit: 'contain', border: 1, borderColor: 'divider', p: 1, borderRadius: 1 }}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No logo uploaded
            </Typography>
          )}
          <Button variant="outlined" component="label" startIcon={<CloudUpload />}>
            Choose logo
            <input
              type="file"
              hidden
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setLogoFile(f || null);
              }}
            />
          </Button>
        </Stack>
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              required
              label="Legal name"
              value={form.legal_name}
              onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Trading name"
              value={form.trading_name}
              onChange={(e) => setForm({ ...form, trading_name: e.target.value })}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Tagline (PDF under legal name)"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="e.g. Garment manufacturing · Since 1998"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Watermark text (optional)"
              value={form.watermark_text}
              onChange={(e) => setForm({ ...form, watermark_text: e.target.value })}
              helperText="Defaults to legal name if empty"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Tax / registration ID"
              value={form.tax_registration}
              onChange={(e) => setForm({ ...form, tax_registration: e.target.value })}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Address
        </Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12}>
            <TextField fullWidth label="Address line 1" value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} />
          </Grid>
          <Grid item xs={12}>
            <TextField fullWidth label="Address line 2" value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth label="Region / state" value={form.region_state} onChange={(e) => setForm({ ...form, region_state: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField fullWidth label="Postal code" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          Contact
        </Typography>
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Fax" value={form.fax} onChange={(e) => setForm({ ...form, fax: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth type="email" label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField fullWidth label="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Typography variant="subtitle1" fontWeight={700} gutterBottom>
          PDF footer
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          label="Footer note on every PDF page"
          value={form.pdf_footer_note}
          onChange={(e) => setForm({ ...form, pdf_footer_note: e.target.value })}
          helperText="e.g. Registered office · Jurisdiction. If empty, legal name and contact lines are used."
        />

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" size="large" startIcon={<Save />} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save company details'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default CompanyPage;
