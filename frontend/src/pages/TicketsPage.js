import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { Delete, Visibility } from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { ticketsAPI } from '../services/api';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

const statusColor = (s) => {
  switch (s) {
    case 'OPEN': return '#0369a1';
    case 'IN_PROGRESS': return '#b45309';
    case 'RESOLVED': return '#047857';
    case 'CLOSED': return '#64748b';
    default: return slate[500];
  }
};

const typeColor = (t) => (t === 'FEATURE' ? '#7c3aed' : '#dc2626');

export default function TicketsPage() {
  const theme = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editStatus, setEditStatus] = useState('OPEN');
  const [editNotes, setEditNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType) params.ticket_type = filterType;
      if (filterStatus) params.status = filterStatus;
      const res = await ticketsAPI.getAll(params);
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (row) => {
    setSelected(row);
    setEditStatus(row.status || 'OPEN');
    setEditNotes(row.admin_notes || '');
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await ticketsAPI.update(selected.id, {
        status: editStatus,
        admin_notes: editNotes,
      });
      setSelected(res.data);
      setRows((prev) => prev.map((r) => (r.id === res.data.id ? res.data : r)));
    } catch (e) {
      alert(e.response?.data ? JSON.stringify(e.response.data) : e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this ticket permanently?')) return;
    try {
      await ticketsAPI.remove(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      alert(e.response?.data ? JSON.stringify(e.response.data) : e.message);
    }
  };

  const columns = useMemo(() => [
    {
      field: 'id',
      headerName: '#',
      width: 70,
    },
    {
      field: 'ticket_type',
      headerName: 'Type',
      width: 130,
      renderCell: (p) => (
        <Chip
          size="small"
          label={p.row.ticket_type_display || p.value}
          sx={{
            height: 22,
            fontWeight: 700,
            fontSize: '0.7rem',
            bgcolor: alpha(typeColor(p.value), 0.1),
            color: typeColor(p.value),
          }}
        />
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1.4,
      minWidth: 180,
      renderCell: (p) => (
        <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', color: slate[800] }} noWrap>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (p) => (
        <Chip
          size="small"
          label={p.row.status_display || p.value}
          sx={{
            height: 22,
            fontWeight: 700,
            fontSize: '0.7rem',
            bgcolor: alpha(statusColor(p.value), 0.12),
            color: statusColor(p.value),
          }}
        />
      ),
    },
    {
      field: 'created_by_name',
      headerName: 'From',
      width: 140,
      renderCell: (p) => (
        <Typography sx={{ fontSize: '0.8rem', color: slate[600] }} noWrap>
          {p.value || '—'}
        </Typography>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Submitted',
      width: 150,
      valueGetter: (v, row) => row.created_at,
      renderCell: (p) => (
        <Typography sx={{ fontSize: '0.75rem', color: slate[500] }}>
          {p.value ? new Date(p.value).toLocaleString() : '—'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Box>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => openDetail(p.row)}>
              <Visibility fontSize="small" />
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
  ], []);

  return (
    <Box>
      <PageHeader
        kicker="Support"
        title="Tickets"
        subtitle="Bug reports and feature requests submitted by users across the app."
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
            px: 2.5,
            py: 1.75,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1.5,
            borderBottom: `1px solid ${slate[200]}`,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
          }}
        >
          <TextField
            select
            size="small"
            label="Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All types</MenuItem>
            <MenuItem value="BUG">Bug report</MenuItem>
            <MenuItem value="FEATURE">Feature request</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            {STATUS_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: 'center', ml: 'auto', fontWeight: 500 }}>
            {rows.length} {rows.length === 1 ? 'ticket' : 'tickets'}
          </Typography>
        </Box>

        <Box sx={{ height: { xs: 480, md: 560 }, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            onRowDoubleClick={(params) => openDetail(params.row)}
            sx={{ ...dataGridSx, height: '100%', border: 'none' }}
          />
        </Box>
      </DataGridShell>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        {selected && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>
              Ticket #{selected.id}
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip
                  size="small"
                  label={selected.ticket_type_display}
                  sx={{ fontWeight: 700, bgcolor: alpha(typeColor(selected.ticket_type), 0.1), color: typeColor(selected.ticket_type) }}
                />
                <Chip
                  size="small"
                  label={selected.status_display}
                  sx={{ fontWeight: 700, bgcolor: alpha(statusColor(selected.status), 0.12), color: statusColor(selected.status) }}
                />
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', mb: 1 }}>{selected.title}</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: slate[500], mb: 2 }}>
                From {selected.created_by_name || '—'} · {selected.created_at ? new Date(selected.created_at).toLocaleString() : ''}
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: slate[800], mb: 2 }}>
                {selected.description}
              </Typography>

              {selected.page_url && (
                <Typography sx={{ fontSize: '0.8rem', color: slate[500], mb: 2 }}>
                  Page: <Box component="span" sx={{ fontFamily: 'monospace', color: slate[700] }}>{selected.page_url}</Box>
                </Typography>
              )}

              {selected.attachments?.length > 0 && (
                <Box sx={{ mb: 2.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: slate[600], mb: 1 }}>
                    Attachments
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
                    {selected.attachments.map((a) => (
                      <Box
                        key={a.id}
                        component="a"
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{
                          display: 'block',
                          width: 120,
                          height: 90,
                          borderRadius: 1.5,
                          overflow: 'hidden',
                          border: `1px solid ${slate[200]}`,
                        }}
                      >
                        <Box component="img" src={a.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              <TextField
                select
                size="small"
                fullWidth
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                sx={{ mb: 2 }}
              >
                {STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                fullWidth
                multiline
                minRows={3}
                label="Admin notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
              <Button color="error" onClick={() => handleDelete(selected.id)} sx={{ textTransform: 'none', mr: 'auto' }}>
                Delete
              </Button>
              <Button onClick={() => setSelected(null)} sx={{ textTransform: 'none' }}>Close</Button>
              <Button variant="contained" onClick={handleSave} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
