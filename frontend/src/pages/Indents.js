import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Typography, IconButton, Chip, Tooltip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add, Edit, Delete, Visibility } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import IndentViewModal from '../components/indents/IndentViewModal';
import { dataGridSx, slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { ordersAPI } from '../services/api';

const STATUS_COLOR = { DRAFT: 'default', CONFIRMED: 'success' };

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

/** Full-value cell text — wraps instead of ellipsis. */
const cellTextSx = {
  fontSize: '0.82rem',
  lineHeight: 1.3,
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
  overflow: 'visible',
  textOverflow: 'clip',
};

export default function Indents() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [rows, setRows]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);

  const piFilter = searchParams.get('piId');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = piFilter ? { pi: piFilter } : {};
      const res = await ordersAPI.getIndents(params);
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [piFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this indent?')) return;
    try {
      await ordersAPI.deleteIndent(id);
      load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const cell = (align = 'left', children) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%',
        height: '100%',
        minWidth: 0,
        px: 0.25,
        overflow: 'visible',
      }}
    >
      {children}
    </Box>
  );

  const indentsGridSx = {
    ...dataGridSx,
    width: '100%',
    maxWidth: '100%',
    bgcolor: '#fff',
    border: 'none',
    '& .MuiDataGrid-main': { overflow: 'hidden' },
    '& .MuiDataGrid-virtualScroller': {
      overflowX: 'hidden !important',
      overflowY: 'auto !important',
    },
    '& .MuiDataGrid-columnHeaders': {
      ...(dataGridSx['& .MuiDataGrid-columnHeaders'] || {}),
      bgcolor: slate[50],
      borderBottom: `2px solid ${slate[200]}`,
    },
    '& .MuiDataGrid-columnHeaderTitle': {
      whiteSpace: 'normal',
      lineHeight: 1.2,
      overflow: 'visible',
      textOverflow: 'clip',
    },
    '& .MuiDataGrid-cell': {
      ...(dataGridSx['& .MuiDataGrid-cell'] || {}),
      display: 'flex',
      alignItems: 'flex-start',
      borderBottom: `1px solid ${slate[100]}`,
      outline: 'none',
      py: '8px !important',
      px: '6px !important',
      whiteSpace: 'normal !important',
      overflow: 'visible !important',
      textOverflow: 'clip !important',
      lineHeight: 1.35,
    },
    '& .MuiDataGrid-cellContent': {
      whiteSpace: 'normal',
      overflow: 'visible',
      textOverflow: 'clip',
      lineHeight: 1.35,
      width: '100%',
    },
    '& .MuiDataGrid-columnHeader, & .MuiDataGrid-cell': {
      minWidth: '0 !important',
    },
  };

  const columns = [
    {
      field: 'indent_number',
      headerName: 'Indent No',
      width: 108,
      renderCell: (p) => cell('left',
        <Typography sx={{ ...cellTextSx, fontWeight: 700, fontFamily: 'monospace', color: 'primary.main' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'pi_number',
      headerName: 'PI Ref',
      width: 96,
      renderCell: (p) => cell('left',
        <Typography sx={{ ...cellTextSx, fontWeight: 600 }}>{p.value}</Typography>
      ),
    },
    {
      field: 'pi_ref',
      headerName: 'Buyer PO',
      width: 88,
      renderCell: (p) => cell('left',
        <Typography sx={{ ...cellTextSx, color: 'text.secondary' }}>{p.value || '—'}</Typography>
      ),
    },
    {
      field: 'item_name',
      headerName: 'Item',
      flex: 1,
      minWidth: 160,
      renderCell: (p) => {
        const names = Array.isArray(p.row.item_names) && p.row.item_names.length
          ? p.row.item_names
          : String(p.value || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        return cell('left',
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 0.35,
            py: 0.25,
            width: '100%',
            minWidth: 0,
          }}>
            {names.length ? names.map((name, i) => (
              <Typography
                key={`${name}-${i}`}
                sx={{ ...cellTextSx, fontWeight: 600 }}
              >
                {name}
              </Typography>
            )) : (
              <Typography sx={{ ...cellTextSx, color: 'text.disabled' }}>—</Typography>
            )}
          </Box>
        );
      },
    },
    {
      field: 'total_qty',
      headerName: 'Qty',
      width: 64,
      type: 'number',
      align: 'left',
      headerAlign: 'left',
      renderCell: (p) => cell('left',
        <Typography sx={{ ...cellTextSx, fontWeight: 700 }}>{p.value?.toLocaleString()}</Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 92,
      align: 'left',
      headerAlign: 'left',
      renderCell: (p) => cell('left',
        <Chip
          label={p.value}
          size="small"
          color={STATUS_COLOR[p.value] || 'default'}
          sx={{
            fontWeight: 700,
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            height: 22,
            maxWidth: '100%',
            '& .MuiChip-label': {
              px: 0.75,
              whiteSpace: 'normal',
              overflow: 'visible',
              textOverflow: 'clip',
            },
          }}
        />
      ),
    },
    {
      field: 'indent_date',
      headerName: 'Date',
      width: 88,
      renderCell: (p) => cell('left',
        <Typography sx={{ ...cellTextSx, color: 'text.secondary' }}>{formatDateDisplay(p.value)}</Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Box sx={{ display: 'flex', gap: 0.15 }}>
          <Tooltip title="View Indent">
            <IconButton size="small" onClick={() => setViewId(p.row.id)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => navigate(`/indents/${p.row.id}`)}>
              <Edit fontSize="small" />
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
    <Box sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflowX: 'hidden' }}>
      <PageHeader
        title="Indents"
        subtitle="Material & trim indents raised against Proforma Invoices"
        actions={
          <Button startIcon={<Add />} variant="contained" onClick={() => navigate('/indents/new')}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5, whiteSpace: 'nowrap' }}>
            Create Indent
          </Button>
        }
      />

      <DataGridShell sx={{ width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowHeight={() => 'auto'}
          columnHeaderHeight={48}
          sx={indentsGridSx}
          disableRowSelectionOnClick
          disableColumnMenu
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>

      <IndentViewModal
        open={Boolean(viewId)}
        indentId={viewId}
        onClose={() => setViewId(null)}
      />
    </Box>
  );
}
