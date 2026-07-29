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
  IconButton,
  Tooltip,
  Chip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Save, CloudUpload, Add, Delete, Edit, Check, Close, AccountBalance } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { slate } from '../theme/appTheme';
import PageHeader from '../components/PageHeader';
import { companyAPI } from '../services/api';
import { useUnsavedDraft, useMarkSavedWhenReady } from '../hooks/useUnsavedChanges';

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
  pi_ref_prefix: 'JBI',
  our_bank_details: '',
  bill_to: '',
  ship_to: '',
};

const emptyOurBankDraft = () => ({
  name: '',
  bank_details: '',
  is_default: false,
  sort_order: 0,
});

const CompanyPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  // Our bank accounts (selectable on PI)
  const [bankAccounts, setBankAccounts] = useState([]);
  const [ourBankEditing, setOurBankEditing] = useState(null); // id or 'new'
  const [ourBankDraft, setOurBankDraft] = useState(emptyOurBankDraft());

  // Currency banks
  const [currencyBanks, setCurrencyBanks] = useState([]);
  const [bankEditing, setBankEditing] = useState(null); // id or 'new'
  const [bankDraft, setBankDraft] = useState({ currency: '', intermediary_bank_details: '', notes: '' });

  const companyDraft = useMemo(
    () => ({ form, logoFileName: logoFile?.name || null, ourBankEditing, bankEditing }),
    [form, logoFile, ourBankEditing, bankEditing],
  );
  const { markSaved } = useUnsavedDraft(companyDraft);
  useMarkSavedWhenReady(markSaved, { ready: !loading, loadKey: 'company' });

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
      const [{ data }, { data: banks }, { data: accounts }] = await Promise.all([
        companyAPI.getProfile(),
        companyAPI.getCurrencyBanks(),
        companyAPI.getBankAccounts(),
      ]);
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
        pi_ref_prefix: data.pi_ref_prefix || 'JBI',
        our_bank_details: data.our_bank_details || '',
        bill_to: data.bill_to || '',
        ship_to: data.ship_to || '',
      });
      setLogoUrl(data.logo_url || null);
      setLogoFile(null);
      setCurrencyBanks(banks.results || banks);
      setBankAccounts(accounts.results || accounts);
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
      // load() flips loading; markSavedWhenReady will re-baseline after reload.
    } catch (e) {
      console.error(e);
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert(`Save failed: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // ── Our bank account CRUD ─────────────────────────────────────────────────
  const startAddOurBank = () => {
    setOurBankDraft({ ...emptyOurBankDraft(), is_default: bankAccounts.length === 0 });
    setOurBankEditing('new');
  };
  const startEditOurBank = (b) => {
    setOurBankDraft({
      name: b.name || '',
      bank_details: b.bank_details || '',
      is_default: Boolean(b.is_default),
      sort_order: b.sort_order || 0,
    });
    setOurBankEditing(b.id);
  };
  const cancelOurBank = () => setOurBankEditing(null);

  const saveOurBank = async () => {
    if (!ourBankDraft.name.trim()) return alert('Account name is required.');
    if (!ourBankDraft.bank_details.trim()) return alert('Bank details are required.');
    try {
      const payload = {
        name: ourBankDraft.name.trim(),
        bank_details: ourBankDraft.bank_details.trim(),
        is_default: Boolean(ourBankDraft.is_default),
        sort_order: Number(ourBankDraft.sort_order) || 0,
      };
      if (ourBankEditing === 'new') {
        await companyAPI.createBankAccount(payload);
      } else {
        await companyAPI.updateBankAccount(ourBankEditing, payload);
      }
      const { data } = await companyAPI.getBankAccounts();
      setBankAccounts(data.results || data);
      setOurBankEditing(null);
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert(`Save failed: ${msg}`);
    }
  };

  const deleteOurBank = async (id) => {
    if (!window.confirm('Delete this bank account?')) return;
    await companyAPI.deleteBankAccount(id);
    setBankAccounts((prev) => prev.filter((b) => b.id !== id));
  };

  // ── Currency bank CRUD ────────────────────────────────────────────────────
  const startAddBank = () => {
    setBankDraft({ currency: '', intermediary_bank_details: '', notes: '' });
    setBankEditing('new');
  };
  const startEditBank = (b) => {
    setBankDraft({ currency: b.currency, intermediary_bank_details: b.intermediary_bank_details, notes: b.notes || '' });
    setBankEditing(b.id);
  };
  const cancelBank = () => setBankEditing(null);

  const saveBank = async () => {
    if (!bankDraft.currency.trim()) return alert('Currency code is required.');
    try {
      if (bankEditing === 'new') {
        await companyAPI.createCurrencyBank(bankDraft);
      } else {
        await companyAPI.updateCurrencyBank(bankEditing, bankDraft);
      }
      const { data } = await companyAPI.getCurrencyBanks();
      setCurrencyBanks(data.results || data);
      setBankEditing(null);
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert(`Save failed: ${msg}`);
    }
  };

  const deleteBank = async (id) => {
    if (!window.confirm('Delete this currency bank?')) return;
    await companyAPI.deleteCurrencyBank(id);
    setCurrencyBanks((prev) => prev.filter((b) => b.id !== id));
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
              label="PI Ref Prefix"
              value={form.pi_ref_prefix}
              onChange={(e) => setForm({ ...form, pi_ref_prefix: e.target.value })}
              helperText="Used for PI reference numbers, e.g. JBI → JBI/26-27/1"
              inputProps={{ maxLength: 20 }}
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
          Supplier PO defaults
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Bill To and Ship To blocks used when raising purchase orders to suppliers. Leave empty to use the registered address above.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Bill To (supplier POs)"
              value={form.bill_to}
              onChange={(e) => setForm({ ...form, bill_to: e.target.value })}
              placeholder={'J.B. International\nRegistered office address…'}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Ship To (supplier POs)"
              value={form.ship_to}
              onChange={(e) => setForm({ ...form, ship_to: e.target.value })}
              placeholder={'Factory / warehouse delivery address…'}
            />
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

      {/* ── Bank Details ─────────────────────────────────────────────────────── */}
      <Paper sx={{ p: { xs: 3, md: 4 }, mt: 4, borderRadius: 3, border: `1px solid ${slate[200]}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} gutterBottom sx={{ mb: 0.5 }}>
              Our Bank Accounts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add multiple company bank accounts. When generating or printing a PI, pick which account to show as OUR BANK.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<Add />}
            onClick={startAddOurBank}
            sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
          >
            Add Bank Account
          </Button>
        </Box>

        {ourBankEditing && (
          <Box sx={{ p: 3, mb: 3, bgcolor: alpha(slate[900], 0.03), borderRadius: 2, border: `1px solid ${slate[200]}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 2, color: slate[700] }}>
              {ourBankEditing === 'new' ? 'New bank account' : 'Edit bank account'}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={5}>
                <TextField
                  size="small"
                  fullWidth
                  label="Account name"
                  value={ourBankDraft.name}
                  onChange={(e) => setOurBankDraft({ ...ourBankDraft, name: e.target.value })}
                  placeholder="e.g. PNB Kanpur / HDFC Current"
                />
              </Grid>
              <Grid item xs={12} sm={4} sx={{ display: 'flex', alignItems: 'center' }}>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={Boolean(ourBankDraft.is_default)}
                      onChange={(e) => setOurBankDraft({ ...ourBankDraft, is_default: e.target.checked })}
                      size="small"
                    />
                  )}
                  label="Default for new PIs"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  size="small"
                  fullWidth
                  multiline
                  minRows={3}
                  label="Bank details"
                  value={ourBankDraft.bank_details}
                  onChange={(e) => setOurBankDraft({ ...ourBankDraft, bank_details: e.target.value })}
                  placeholder="Bank name, branch, A/C No, IFSC / SWIFT…"
                />
              </Grid>
              <Grid item xs={12} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button size="small" onClick={cancelOurBank} startIcon={<Close />} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" onClick={saveOurBank} startIcon={<Check />} sx={{ textTransform: 'none', fontWeight: 700 }}>
                  Save account
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {bankAccounts.length === 0 && !ourBankEditing && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No bank accounts yet. Click &quot;Add Bank Account&quot; to add your first one.
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {bankAccounts.map((b) => (
            <Box
              key={b.id}
              sx={{
                display: 'flex',
                gap: 2,
                alignItems: 'flex-start',
                p: 2,
                borderRadius: 2,
                border: `1px solid ${slate[200]}`,
                bgcolor: '#fff',
              }}
            >
              <AccountBalance sx={{ color: slate[500], mt: 0.25, flexShrink: 0 }} fontSize="small" />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: slate[900] }}>{b.name}</Typography>
                  {b.is_default && (
                    <Chip label="Default" size="small" sx={{ fontWeight: 700, height: 22, bgcolor: slate[900], color: '#fff' }} />
                  )}
                </Box>
                <Typography sx={{ fontSize: '0.82rem', color: slate[700], whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                  {b.bank_details}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => startEditOurBank(b)}><Edit fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => deleteOurBank(b.id)}><Delete fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>

        <Divider sx={{ my: 4 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800}>Intermediary Banks by Currency</Typography>
            <Typography variant="body2" color="text.secondary">
              Each currency can have a different correspondent / intermediary bank — auto-filled on PI based on buyer&apos;s currency.
            </Typography>
          </Box>
          <Button variant="outlined" size="small" startIcon={<Add />} onClick={startAddBank} sx={{ fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}>
            Add Currency
          </Button>
        </Box>

        {/* Add / Edit form */}
        {bankEditing && (
          <Box sx={{ p: 3, mb: 3, bgcolor: alpha(slate[900], 0.03), borderRadius: 2, border: `1px solid ${slate[200]}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 2, color: slate[700] }}>
              {bankEditing === 'new' ? 'New currency bank' : 'Edit currency bank'}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={2}>
                <TextField size="small" fullWidth label="Currency" inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
                  value={bankDraft.currency}
                  onChange={(e) => setBankDraft({ ...bankDraft, currency: e.target.value.toUpperCase() })}
                  placeholder="USD" />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField size="small" fullWidth multiline minRows={2} label="Intermediary Bank Details"
                  value={bankDraft.intermediary_bank_details}
                  onChange={(e) => setBankDraft({ ...bankDraft, intermediary_bank_details: e.target.value })}
                  placeholder="e.g. CITI BANK NA, 11 WALL STREET, NEW YORK  SWIFT: CITIUS33" />
              </Grid>
              <Grid item xs={12} sm={2} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', pt: '8px !important' }}>
                <Tooltip title="Save">
                  <IconButton size="small" color="primary" onClick={saveBank}><Check /></IconButton>
                </Tooltip>
                <Tooltip title="Cancel">
                  <IconButton size="small" onClick={cancelBank}><Close /></IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Currency bank list */}
        {currencyBanks.length === 0 && !bankEditing && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No currency banks added yet. Click &quot;Add Currency&quot; to set up your first one.
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {currencyBanks.map((b) => (
            <Box key={b.id} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', p: 2, borderRadius: 2, border: `1px solid ${slate[200]}`, bgcolor: '#fff' }}>
              <Chip label={b.currency} size="small" sx={{ fontWeight: 900, minWidth: 48, bgcolor: slate[900], color: '#fff', fontSize: '0.75rem' }} />
              <Typography sx={{ flex: 1, fontSize: '0.82rem', color: slate[700], whiteSpace: 'pre-line', lineHeight: 1.5 }}>
                {b.intermediary_bank_details}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => startEditBank(b)}><Edit fontSize="small" /></IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => deleteBank(b.id)}><Delete fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default CompanyPage;
