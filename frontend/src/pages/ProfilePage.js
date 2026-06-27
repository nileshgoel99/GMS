import React, { useEffect, useState } from 'react';
import {
  Box, Button, TextField, Grid, Paper, Typography, Stack, CircularProgress, Alert,
} from '@mui/material';
import { Save, PersonOutline } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import PageHeader from '../components/PageHeader';
import { slate } from '../theme/appTheme';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const sxInput = {
  '& .MuiOutlinedInput-root': { borderRadius: 1.5, bgcolor: '#fff' },
};

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await authAPI.me();
        setForm({
          first_name: res.data.first_name || '',
          last_name: res.data.last_name || '',
        });
      } catch (e) {
        setError('Could not load profile.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await authAPI.updateMe({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      await refreshUser();
      setSuccess('Profile updated.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="My profile"
        subtitle="Update your name and view your account details."
      />

      <Paper
        elevation={0}
        component="form"
        onSubmit={handleSave}
        sx={{
          p: { xs: 2.5, sm: 3 },
          maxWidth: 720,
          borderRadius: 2,
          border: `1px solid ${slate[200]}`,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha('#6366f1', 0.1),
              color: '#4338ca',
            }}
          >
            <PersonOutline />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
              {[form.first_name, form.last_name].filter(Boolean).join(' ') || user?.username}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {user?.role_label || 'User'}
            </Typography>
          </Box>
        </Stack>

        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}

        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="First name"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Last name"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Username"
              value={user?.username || ''}
              disabled
              sx={sxInput}
              helperText="Username is managed by your administrator."
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Email"
              value={user?.email || '—'}
              disabled
              sx={sxInput}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              size="small"
              label="Role"
              value={user?.role_label || ''}
              disabled
              sx={sxInput}
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, px: 3 }}
          >
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
