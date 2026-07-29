import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Close, CloudUpload, DeleteOutline } from '@mui/icons-material';
import { ticketsAPI } from '../services/api';
import { slate } from '../theme/appTheme';
import { confirmDiscardUnsaved } from '../hooks/useUnsavedChanges';

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

export default function ReportTicketModal({ open, onClose, pageUrl = '' }) {
  const fileRef = useRef(null);
  const [ticketType, setTicketType] = useState('BUG');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const isDirty = Boolean(title.trim() || description.trim() || files.length);

  const requestClose = () => {
    if (saving) return;
    if (!confirmDiscardUnsaved(isDirty)) return;
    onClose?.();
  };

  useEffect(() => {
    if (!open) return;
    setTicketType('BUG');
    setTitle('');
    setDescription('');
    setFiles([]);
    setPreviews([]);
    setError('');
    setSuccess(false);
    setSaving(false);
  }, [open]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    const next = [...files];
    for (const f of incoming) {
      if (!f.type?.startsWith('image/')) {
        setError('Only image files are allowed.');
        continue;
      }
      if (f.size > MAX_BYTES) {
        setError('Each image must be 5 MB or smaller.');
        continue;
      }
      if (next.length >= MAX_IMAGES) {
        setError(`You can attach up to ${MAX_IMAGES} images.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setError('');
    if (title.trim().length < 3) {
      setError('Please enter a short title (at least 3 characters).');
      return;
    }
    if (description.trim().length < 5) {
      setError('Please add a bit more detail in the description.');
      return;
    }

    const form = new FormData();
    form.append('ticket_type', ticketType);
    form.append('title', title.trim());
    form.append('description', description.trim());
    form.append('page_url', pageUrl || window.location.pathname);
    files.forEach((f) => form.append('images', f));

    setSaving(true);
    try {
      await ticketsAPI.create(form);
      setSuccess(true);
      setTimeout(() => onClose?.(), 900);
    } catch (e) {
      const data = e.response?.data;
      const msg = typeof data === 'string'
        ? data
        : data
          ? Object.values(data).flat().join(' ')
          : e.message;
      setError(msg || 'Could not submit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : requestClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography component="span" sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
          Report a bug or request a feature
        </Typography>
        <IconButton size="small" onClick={requestClose} disabled={saving} aria-label="Close">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {success ? (
          <Alert severity="success" sx={{ mb: 1 }}>
            Thanks — your ticket was submitted.
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <FormControl>
              <FormLabel sx={{ fontSize: '0.75rem', fontWeight: 700, color: slate[600], mb: 0.5 }}>
                Type
              </FormLabel>
              <RadioGroup
                row
                value={ticketType}
                onChange={(e) => setTicketType(e.target.value)}
              >
                <FormControlLabel value="BUG" control={<Radio size="small" />} label="Bug report" />
                <FormControlLabel value="FEATURE" control={<Radio size="small" />} label="Feature request" />
              </RadioGroup>
            </FormControl>

            <TextField
              size="small"
              label="Title"
              fullWidth
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={ticketType === 'BUG' ? 'What went wrong?' : 'What would you like?'}
            />

            <TextField
              size="small"
              label="Description"
              fullWidth
              multiline
              minRows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Steps to reproduce, expected vs actual, or feature details…"
            />

            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: slate[600], mb: 1 }}>
                Screenshots (optional)
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUpload />}
                onClick={() => fileRef.current?.click()}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Upload images
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <Typography sx={{ fontSize: '0.7rem', color: slate[400], mt: 0.75 }}>
                Up to {MAX_IMAGES} images, 5 MB each. JPEG, PNG, GIF, or WebP.
              </Typography>

              {previews.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                  {previews.map((src, i) => (
                    <Box
                      key={src}
                      sx={{
                        position: 'relative',
                        width: 72,
                        height: 72,
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        border: `1px solid ${alpha(slate[400], 0.35)}`,
                      }}
                    >
                      <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <IconButton
                        size="small"
                        onClick={() => removeFile(i)}
                        sx={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          bgcolor: 'rgba(15,23,42,0.65)',
                          color: '#fff',
                          p: 0.25,
                          '&:hover': { bgcolor: 'rgba(15,23,42,0.85)' },
                        }}
                        aria-label="Remove image"
                      >
                        <DeleteOutline sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {pageUrl && (
              <Typography sx={{ fontSize: '0.7rem', color: slate[400] }}>
                Page: {pageUrl}
              </Typography>
            )}
          </Box>
        )}
      </DialogContent>
      {!success && (
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={requestClose} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={saving}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {saving ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
