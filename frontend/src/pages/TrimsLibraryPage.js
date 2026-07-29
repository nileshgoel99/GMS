import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, TextField, IconButton, Chip, Tooltip,
} from '@mui/material';
import { Add, Edit, Delete, LibraryBooks } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { ordersAPI } from '../services/api';
import {
  isCartonBoxCategory,
  formatTrimPropertyLabel,
  formatCartonBoxSummary,
  indentTrimCategoryRank,
  sortIndentTrimLines,
} from '../components/trims/trimConstants';
import AddTrimModal from '../components/trims/AddTrimModal';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function TrimsLibraryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const showSpinner = !initialLoadDone.current;
    if (showSpinner) setLoading(true);
    try {
      const res = await ordersAPI.getTrimsMaster({
        search: debouncedSearch,
        page_size: 500,
      });
      setRows(sortIndentTrimLines(asList(res.data)));
      initialLoadDone.current = true;
    } catch (e) {
      console.error(e);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };
  const handleSaved = (saved) => {
    if (saved?.id) {
      setRows((prev) => sortIndentTrimLines(
        prev.some((row) => row.id === saved.id)
          ? prev.map((row) => (row.id === saved.id ? saved : row))
          : [...prev, saved],
      ));
    }
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this trim? This won\'t affect existing indents.')) return;
    try {
      await ordersAPI.deleteTrim(id);
      load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  const cell = (align = 'left', children) => (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        width: '100%',
        minWidth: 0,
        minHeight: 64,
        px: 0.75,
        py: 1,
      }}
    >
      {children}
    </Box>
  );

  const trimsGridSx = {
    ...dataGridSx,
    width: '100%',
    border: 'none',
    bgcolor: '#fff',
    '& .MuiDataGrid-main': { overflow: 'visible' },
    '& .MuiDataGrid-virtualScroller': {
      overflowX: 'auto !important',
      overflowY: 'visible !important',
      overscrollBehavior: 'auto',
    },
    '& .MuiDataGrid-filler, & .MuiDataGrid-scrollbarFiller': {
      display: 'none !important',
      width: '0 !important',
      minWidth: '0 !important',
    },
    '& .MuiDataGrid-columnHeaders': {
      ...(dataGridSx['& .MuiDataGrid-columnHeaders'] || {}),
      bgcolor: slate[50],
      borderBottom: `2px solid ${slate[200]}`,
    },
    '& .MuiDataGrid-cell': {
      ...(dataGridSx['& .MuiDataGrid-cell'] || {}),
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid ${slate[100]}`,
      py: '6px !important',
      overflow: 'visible !important',
      whiteSpace: 'normal !important',
      lineHeight: 1.4,
    },
    '& .MuiDataGrid-row': {
      minHeight: '76px !important',
    },
    '& .MuiDataGrid-row.trim-row--alt': {
      bgcolor: `${alpha('#0f766e', 0.075)} !important`,
    },
    '& .MuiDataGrid-row.trim-row--alt:hover': {
      bgcolor: `${alpha('#0f766e', 0.13)} !important`,
    },
    '& .MuiDataGrid-row:not(.trim-row--alt):hover': {
      bgcolor: `${alpha('#6366f1', 0.055)} !important`,
    },
  };

  const columns = [
    {
      field: 'name', headerName: 'Trim Name', flex: 2.2, minWidth: 280,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, minWidth: 0, width: '100%' }}>
          <Box sx={{
            width: 32, height: 32, borderRadius: 1.25, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: alpha('#0f766e', 0.1), color: '#0f766e',
          }}>
            <LibraryBooks sx={{ fontSize: 18 }} />
          </Box>
          <Typography sx={{
            fontWeight: 750, fontSize: '0.88rem', textTransform: 'uppercase',
            whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.4,
          }}>
            {p.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'category', headerName: 'Category', flex: 1, minWidth: 150, align: 'center', headerAlign: 'center',
      sortComparator: (v1, v2, cellParams1, cellParams2) => {
        const row1 = cellParams1?.api?.getRow?.(cellParams1.id) || {};
        const row2 = cellParams2?.api?.getRow?.(cellParams2.id) || {};
        const r1 = indentTrimCategoryRank(v1, row1.name);
        const r2 = indentTrimCategoryRank(v2, row2.name);
        if (r1 !== r2) return r1 - r2;
        return String(v1 || '').localeCompare(String(v2 || ''), undefined, { sensitivity: 'base' });
      },
      renderCell: (p) => cell('center',
        p.value ? (
          <Chip label={p.value} size="small" sx={{
            height: 28, fontWeight: 700, fontSize: '0.72rem',
            bgcolor: alpha('#6366f1', 0.11), color: '#4338ca',
            border: `1px solid ${alpha('#6366f1', 0.2)}`,
          }} />
        ) : (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>
        )
      ),
    },
    {
      field: 'properties', headerName: 'Properties', flex: 2.4, minWidth: 330, sortable: false,
      renderCell: (p) => {
        const props = p.value || [];
        const defaults = p.row.default_property_values || {};
        if (isCartonBoxCategory(p.row.category) && formatCartonBoxSummary(defaults)) {
          return cell('left',
            <Typography sx={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
              {formatCartonBoxSummary(defaults)}
            </Typography>,
          );
        }
        if (!props.length) {
          return cell('left', <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled' }}>—</Typography>);
        }
        return cell('left',
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.65, alignItems: 'center', py: 0.25 }}>
            {props.map((prop, i) => (
              <Chip
                key={i}
                size="small"
                label={formatTrimPropertyLabel(prop)}
                variant="outlined"
                sx={{
                  height: 27, fontSize: '0.7rem', fontWeight: 650,
                  bgcolor: '#fff', borderColor: slate[300],
                }}
              />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'default_unit', headerName: 'Default Unit', width: 135, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center', <Chip label={p.value} size="small" variant="outlined" sx={{ height: 28, fontSize: '0.72rem', fontWeight: 750 }} />),
    },
    {
      field: 'actions', headerName: 'Actions', width: 120, sortable: false, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit trim"><IconButton size="small" color="primary" onClick={() => openEdit(p.row)}><Edit fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(p.row.id)}><Delete fontSize="small" /></IconButton></Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
      }}
    >
      <Box>
        <PageHeader
          title="Trims Library"
          subtitle="Define trims with configurable properties (name + unit) used when building indents"
          compact
          actions={
            <Button startIcon={<Add />} variant="contained" onClick={openNew} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}>
              Add Trim
            </Button>
          }
        />

        <Box sx={{ mb: 1.5 }}>
          <TextField
            size="small"
            placeholder="Search by name or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ width: { xs: '100%', sm: 320 }, '& .MuiInputBase-root': { borderRadius: 2 } }}
          />
        </Box>
      </Box>

      <DataGridShell
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          '& > .MuiDataGrid-root': {
            height: 'auto !important',
            width: '100%',
          },
          '&:hover': { boxShadow: (theme) => theme.shadows[1] },
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          autoHeight
          getRowHeight={() => 'auto'}
          columnHeaderHeight={48}
          scrollbarSize={0}
          getRowClassName={(p) => (p.indexRelativeToCurrentPage % 2 === 1 ? 'trim-row--alt' : '')}
          sx={trimsGridSx}
          disableRowSelectionOnClick
          disableColumnMenu
          pageSizeOptions={[50, 100, 250, 500]}
          initialState={{
            pagination: { paginationModel: { pageSize: 100 } },
          }}
        />
      </DataGridShell>

      <AddTrimModal
        open={modalOpen}
        editing={editing}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </Box>
  );
}
