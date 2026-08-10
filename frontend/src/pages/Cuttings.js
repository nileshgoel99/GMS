import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Chip, IconButton, Tooltip, Typography,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { ContentCut, Delete, Visibility } from '@mui/icons-material';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import CuttingViewModal from '../components/production/CuttingViewModal';
import { dataGridSx, slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { productionAPI } from '../services/api';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const fmtQty = (n) => {
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

function groupByBuyerPo(records) {
  const map = new Map();
  records.forEach((r) => {
    const key = r.buyer_po ?? `unknown-${r.buyer_po_number || r.id}`;
    if (!map.has(key)) {
      map.set(key, {
        id: `po-${key}`,
        buyer_po: r.buyer_po,
        buyer_po_number: r.buyer_po_number || '—',
        pi_number: r.pi_number || '—',
        cuttings: [],
      });
    }
    const g = map.get(key);
    g.cuttings.push(r);
    if (r.pi_number && g.pi_number === '—') g.pi_number = r.pi_number;
  });

  return Array.from(map.values())
    .map((g) => ({
      ...g,
      cutting_count: g.cuttings.length,
      total_pcs: g.cuttings.reduce((s, c) => s + (Number(c.total_pcs) || 0), 0),
      total_used: g.cuttings.reduce((s, c) => s + (Number(c.total_consumption) || 0), 0),
      latest_date: g.cuttings.reduce(
        (latest, c) => (!latest || (c.cutting_date && c.cutting_date > latest) ? c.cutting_date : latest),
        null,
      ),
      consumption_unit: g.cuttings[0]?.consumption_unit || 'MTRS',
    }))
    .sort((a, b) => String(b.latest_date || '').localeCompare(String(a.latest_date || '')));
}

export default function Cuttings() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalGroup, setModalGroup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productionAPI.getCuttings();
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => groupByBuyerPo(rows), [rows]);

  const handleDeleteGroup = async (group) => {
    if (!window.confirm(`Delete all ${group.cutting_count} cutting record(s) for PO ${group.buyer_po_number}?`)) return;
    try {
      await Promise.all(group.cuttings.map((c) => productionAPI.deleteCutting(c.id)));
      load();
    } catch (e) {
      alert('Delete failed: ' + (e.response?.data?.detail || e.message));
    }
  };

  const cell = (align = 'left', children) => (
    <Box sx={{
      display: 'flex', alignItems: 'center', width: '100%', height: '100%', px: 0.5,
      justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
    }}>
      {children}
    </Box>
  );

  const columns = [
    {
      field: 'buyer_po_number',
      headerName: 'Buyer PO',
      flex: 1.1,
      minWidth: 130,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontWeight: 800, fontSize: '0.88rem', color: 'primary.main' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'pi_number',
      headerName: 'PI',
      flex: 0.9,
      minWidth: 110,
      renderCell: (p) => cell('left', <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{p.value || '—'}</Typography>),
    },
    {
      field: 'cutting_count',
      headerName: 'Cuttings',
      width: 100,
      align: 'center',
      headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Chip size="small" label={p.value} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
      ),
    },
    {
      field: 'latest_date',
      headerName: 'Latest cut',
      width: 115,
      renderCell: (p) => cell('left', <Typography sx={{ fontSize: '0.82rem' }}>{formatDateDisplay(p.value)}</Typography>),
    },
    {
      field: 'total_pcs',
      headerName: 'Total pcs',
      width: 95,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right', <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{fmtQty(p.value)}</Typography>),
    },
    {
      field: 'total_used',
      headerName: 'Fabric used',
      width: 110,
      align: 'right',
      headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>
          {fmtQty(p.value)} {p.row.consumption_unit || ''}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 100,
      sortable: false,
      filterable: false,
      renderCell: (p) => cell('center',
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="View cuttings">
            <IconButton size="small" color="primary" onClick={() => setModalGroup(p.row)}>
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete all for this PO">
            <IconButton size="small" color="error" onClick={() => handleDeleteGroup(p.row)}>
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
        kicker="Production"
        title="Cutting"
        subtitle="Grouped by Buyer PO — view cuttings in detail or edit from the modal"
        actions={
          <Button
            variant="contained"
            startIcon={<ContentCut />}
            onClick={() => navigate('/production/cutting/new')}
          >
            Record Cutting
          </Button>
        }
      />

      <DataGridShell>
        <DataGrid
          rows={groups}
          columns={columns}
          loading={loading}
          autoHeight
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{
            ...dataGridSx,
            '& .MuiDataGrid-row': { cursor: 'default' },
          }}
          getRowHeight={() => 'auto'}
          onRowClick={(params) => setModalGroup(params.row)}
        />
      </DataGridShell>

      <CuttingViewModal
        open={Boolean(modalGroup)}
        group={modalGroup}
        onClose={() => setModalGroup(null)}
        onEdit={(cuttingId) => {
          setModalGroup(null);
          navigate(`/production/cutting/${cuttingId}`);
        }}
      />

      {!loading && groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          No cutting records yet. Use Record Cutting to add one.
        </Typography>
      ) : null}
    </Box>
  );
}
