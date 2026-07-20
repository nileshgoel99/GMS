import React, { useRef, useState } from 'react';
import {
  Box, Button, Typography, IconButton, Tooltip, MenuItem, TextField, Stack, CircularProgress,
} from '@mui/material';
import { AttachFile, DeleteOutline, OpenInNew, Description } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { slate } from '../../theme/appTheme';
import { purchaseBillAPI } from '../../services/api';

const DOCUMENT_TYPES = [
  { value: 'ORIGINAL_INVOICE', label: 'Original Invoice' },
  { value: 'OTHER', label: 'Other Document' },
];

const accent = '#0f766e';

export default function PurchaseBillDocuments({
  billId,
  documents = [],
  onChange,
  onError,
  readOnly = false,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [documentType, setDocumentType] = useState('ORIGINAL_INVOICE');
  const [customLabel, setCustomLabel] = useState('');

  const canUpload = Boolean(billId) && !readOnly;

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !billId) return;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('document_type', documentType);
    if (documentType === 'OTHER' && customLabel.trim()) {
      fd.append('label', customLabel.trim());
    }

    setUploading(true);
    try {
      const res = await purchaseBillAPI.uploadDocument(billId, fd);
      onChange?.([res.data, ...documents]);
      setCustomLabel('');
    } catch (e) {
      const message = e.response?.data?.detail || e.message || 'Upload failed.';
      if (onError) onError(String(message));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (docId) => {
    if (!billId || !window.confirm('Remove this document?')) return;
    setRemovingId(docId);
    try {
      await purchaseBillAPI.removeDocument(billId, docId);
      onChange?.(documents.filter((doc) => doc.id !== docId));
    } catch (e) {
      const message = e.response?.data?.detail || e.message || 'Remove failed.';
      if (onError) onError(String(message));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Box>
      {canUpload && (
        <Box
          sx={{
            mb: documents.length ? 1.5 : 0,
            p: 2,
            borderRadius: 2,
            border: `2px dashed ${alpha(accent, 0.35)}`,
            bgcolor: alpha(accent, 0.03),
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField
              select
              size="small"
              label="Document type"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              sx={{ minWidth: 180, bgcolor: '#fff', borderRadius: 1.5 }}
            >
              {DOCUMENT_TYPES.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            {documentType === 'OTHER' && (
              <TextField
                size="small"
                label="Label (optional)"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="E-way bill, GRN, etc."
                sx={{ flex: 1, bgcolor: '#fff', borderRadius: 1.5 }}
              />
            )}
            <Button
              component="label"
              variant="outlined"
              size="small"
              disabled={uploading}
              startIcon={uploading ? <CircularProgress size={14} /> : <AttachFile />}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, flexShrink: 0 }}
            >
              {uploading ? 'Uploading…' : 'Upload file'}
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={handleUpload}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
              />
            </Button>
          </Stack>
          <Typography sx={{ fontSize: '0.72rem', color: slate[500], mt: 1 }}>
            PDF, image, Word, or Excel — original supplier invoice and related documents
          </Typography>
        </Box>
      )}

      {!billId && !readOnly && (
        <Typography sx={{ fontSize: '0.82rem', color: slate[500], fontStyle: 'italic' }}>
          Save the bill first, then upload the original invoice and other documents.
        </Typography>
      )}

      {documents.length > 0 ? (
        <Stack spacing={1}>
          {documents.map((doc) => (
            <Box
              key={doc.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                p: 1.25,
                borderRadius: 1.5,
                border: `1px solid ${slate[200]}`,
                bgcolor: '#fff',
              }}
            >
              <Description sx={{ color: accent, fontSize: 22, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>
                  {doc.display_label || doc.label || 'Document'}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: slate[500], wordBreak: 'break-all' }}>
                  {doc.file_name || doc.file_url?.split('/').pop()}
                </Typography>
              </Box>
              {doc.file_url && (
                <Tooltip title="Open document">
                  <IconButton
                    size="small"
                    component="a"
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ color: accent }}
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {canUpload && (
                <Tooltip title="Remove document">
                  <IconButton
                    size="small"
                    onClick={() => handleRemove(doc.id)}
                    disabled={removingId === doc.id}
                    sx={{ color: slate[400], '&:hover': { color: 'error.main' } }}
                  >
                    {removingId === doc.id ? <CircularProgress size={16} /> : <DeleteOutline fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
        </Stack>
      ) : billId && readOnly ? (
        <Typography sx={{ fontSize: '0.82rem', color: slate[500] }}>No documents attached.</Typography>
      ) : null}
    </Box>
  );
}
