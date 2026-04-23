import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Chip, Tooltip, Stack, Alert } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, AttachFile } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx } from '../theme/appTheme';
import { ordersAPI } from '../services/api';

const STATUS_COLORS = {
  DRAFT: 'default',
  SUBMITTED: 'info',
  APPROVED: 'success',
  CLOSED: 'default',
};

const asList = (resData) => {
  if (Array.isArray(resData)) return resData;
  if (resData && Array.isArray(resData.results)) return resData.results;
  return [];
};

const Intents = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attachIntentId, setAttachIntentId] = useState(null);
  const [attachFile, setAttachFile] = useState(null);
  const [attachDesc, setAttachDesc] = useState('');

  const piFilter = searchParams.get('piFilter');

  const fetchRows = async () => {
    try {
      const res = await ordersAPI.getIntents();
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this intent?')) return;
    try {
      await ordersAPI.deleteIntent(id);
      fetchRows();
    } catch (e) {
      console.error(e);
      alert('Error deleting intent');
    }
  };

  const openAttach = (row) => {
    setAttachIntentId(row.id);
    setAttachFile(null);
    setAttachDesc('');
  };

  const submitAttachment = async () => {
    if (!attachFile || !attachIntentId) return;
    const fd = new FormData();
    fd.append('file', attachFile);
    if (attachDesc) fd.append('description', attachDesc);
    try {
      await ordersAPI.uploadIntentAttachment(attachIntentId, fd);
      setAttachIntentId(null);
      fetchRows();
    } catch (e) {
      console.error(e);
      alert('Upload failed');
    }
  };

  const displayRows = piFilter
    ? rows.filter((r) => r.pi === Number(piFilter))
    : rows;

  const columns = [
    { field: 'indent_number', headerName: 'Indent no.', width: 180 },
    { field: 'pi_number', headerName: 'PI', width: 120 },
    { field: 'intent_date', headerName: 'Date', width: 110 },
    {
      field: 'sheets',
      headerName: 'Sheets',
      width: 100,
      sortable: false,
      type: 'number',
      valueGetter: (_v, r) => (Array.isArray(r.sheets) ? r.sheets.length : 0),
    },
    { field: 'garment_sheet_name', headerName: 'Tab labels (summary)', minWidth: 200, flex: 1 },
    { field: 'total_garment_qty', headerName: 'Total pcs', width: 100, type: 'number' },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (p) => <Chip label={p.value} color={STATUS_COLORS[p.value] || 'default'} size="small" />,
    },
    { field: 'lines_count', headerName: 'BOM lines', width: 90 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (p) => (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Open">
            <IconButton size="small" color="primary" onClick={() => navigate(`/intents/${p.row.id}`)}>
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Attach file">
            <IconButton size="small" color="primary" onClick={() => openAttach(p.row)}>
              <AttachFile fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDelete(p.row.id)}>
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
        kicker="Planning"
        title="Intents (indents)"
        subtitle="Each intent is one commercial indent. Use the full editor to add multiple Excel-style labelled sheets, sizes, and BOM."
        actions={
          <Button variant="contained" size="large" startIcon={<Add />} onClick={() => navigate('/intents/new')}>
            New intent
          </Button>
        }
      />

      {piFilter ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setSearchParams({}, { replace: true })}>
          Filtered to one PI. Close to see all.
        </Alert>
      ) : null}

      <DataGridShell sx={{ height: { xs: 520, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={displayRows}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10, 25]}
          loading={loading}
          disableSelectionOnClick
          sx={{ ...dataGridSx, height: '100%' }}
        />
      </DataGridShell>

      <Dialog open={!!attachIntentId} onClose={() => setAttachIntentId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Attach document</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Button variant="outlined" component="label">
              Choose file
              <input type="file" hidden onChange={(e) => setAttachFile(e.target.files?.[0] || null)} />
            </Button>
            {attachFile ? <Typography variant="body2">{attachFile.name}</Typography> : null}
            <TextField label="Description" value={attachDesc} onChange={(e) => setAttachDesc(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAttachIntentId(null)} color="inherit">
            Cancel
          </Button>
          <Button variant="contained" onClick={submitAttachment} disabled={!attachFile}>
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Intents;
