import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Typography, IconButton, Chip, Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Add, Edit, Delete, LocalShipping, Visibility, Checkroom, Print,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import SupplierPOViewModal from '../components/procurement/SupplierPOViewModal';
import { BuyerPoDetailDialog } from './BuyerPOs';
import { dataGridSx, slate } from '../theme/appTheme';
import { formatDateDisplay } from '../utils/formatDate';
import { procurementAPI } from '../services/api';

const STATUS_COLORS = {
  DRAFT: 'default',
  ORDERED: 'info',
  PARTIAL: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
};

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

export default function Procurement() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewId, setViewId] = useState(null);
  const [buyerPoId, setBuyerPoId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await procurementAPI.getAll();
      setRows(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this purchase order?')) return;
    try {
      await procurementAPI.delete(id);
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
        px: 0.25,
        overflow: 'visible',
      }}
    >
      {children}
    </Box>
  );

  const gridSx = {
    ...dataGridSx,
    width: '100%',
    maxWidth: '100%',
    bgcolor: '#fff',
    border: 'none',
    // Grow with rows — no internal vertical scrollbar; page scrolls instead.
    '& .MuiDataGrid-main': { overflow: 'visible' },
    '& .MuiDataGrid-virtualScroller': {
      overflowX: 'auto !important',
      overflowY: 'visible !important',
    },
    // MUI X v7 adds a filler / scrollbar gutter that looks like an empty last column.
    '& .MuiDataGrid-filler': { display: 'none !important', width: '0 !important', minWidth: '0 !important' },
    '& .MuiDataGrid-scrollbarFiller': { display: 'none !important', width: '0 !important', minWidth: '0 !important' },
    '& .MuiDataGrid-scrollbarFiller--header': { display: 'none !important' },
    '& .MuiDataGrid-scrollbarFiller--borderTop': { display: 'none !important' },
    '& .MuiDataGrid-scrollbarFiller--borderBottom': { display: 'none !important' },
    '& .MuiDataGrid-columnHeadersInner': { width: '100% !important' },
    '& .MuiDataGrid-virtualScrollerContent': { width: '100% !important' },
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
      alignItems: 'center',
      borderBottom: `1px solid ${slate[100]}`,
      outline: 'none',
      py: '12px !important',
      px: '8px !important',
      whiteSpace: 'normal !important',
      overflow: 'visible !important',
      textOverflow: 'clip !important',
      lineHeight: 1.45,
    },
    '& .MuiDataGrid-cellContent': {
      whiteSpace: 'normal',
      overflow: 'visible',
      textOverflow: 'clip',
      lineHeight: 1.45,
      width: '100%',
    },
    '& .MuiDataGrid-row.po-row--alt': {
      bgcolor: `${alpha('#0f766e', 0.07)} !important`,
    },
  };

  const columns = [
    {
      field: 'po_number', headerName: 'PO Number', width: 150,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', fontFamily: 'monospace', color: 'primary.main', whiteSpace: 'nowrap' }}>
          {p.value}
        </Typography>
      ),
    },
    {
      field: 'vendor_name', headerName: 'Supplier', flex: 1, minWidth: 200,
      renderCell: (p) => cell('left',
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0, width: '100%' }}>
          <LocalShipping sx={{ fontSize: 16, color: 'primary.main', opacity: 0.7, mt: 0.15, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.45 }}>
            {p.value || '—'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'reference_number', headerName: 'Reference', width: 150,
      renderCell: (p) => {
        const label = p.value || p.row.buyer_po_number || '—';
        const canOpen = Boolean(p.row.buyer_po);
        return cell('left',
          canOpen ? (
            <Typography
              component="button"
              type="button"
              onClick={() => setBuyerPoId(p.row.buyer_po)}
              sx={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'primary.main',
                cursor: 'pointer',
                border: 'none',
                bgcolor: 'transparent',
                p: 0,
                font: 'inherit',
                textAlign: 'left',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                '&:hover': { color: 'primary.dark' },
              }}
            >
              {label}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '0.82rem', whiteSpace: 'normal', wordBreak: 'break-word' }}>{label}</Typography>
          )
        );
      },
    },
    {
      field: 'order_date', headerName: 'Order Date', width: 118,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {formatDateDisplay(p.value)}
        </Typography>
      ),
    },
    {
      field: 'expected_delivery_date', headerName: 'Delivery', width: 118,
      renderCell: (p) => cell('left',
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
          {formatDateDisplay(p.value)}
        </Typography>
      ),
    },
    {
      field: 'total_amount', headerName: 'Total (₹)', width: 130, align: 'right', headerAlign: 'right',
      renderCell: (p) => cell('right',
        <Typography
          className="font-numeric"
          sx={{
            fontWeight: 700,
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
          {p.value != null ? Number(p.value).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
        </Typography>
      ),
    },
    {
      field: 'status', headerName: 'Status', width: 120, align: 'center', headerAlign: 'center',
      renderCell: (p) => cell('center',
        <Chip label={p.value} size="small" color={STATUS_COLORS[p.value] || 'default'}
          sx={{ fontWeight: 700, fontSize: '0.68rem', textTransform: 'uppercase' }} />
      ),
    },
    {
      field: 'actions', headerName: 'Actions', width: 108, sortable: false, align: 'center', headerAlign: 'center',
      disableColumnMenu: true,
      renderCell: (p) => cell('center',
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.15, py: 0.25 }}>
          <Box sx={{ display: 'flex', gap: 0.15 }}>
            <Tooltip title="View">
              <IconButton size="small" onClick={() => setViewId(p.row.id)}>
                <Visibility fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Print">
              <IconButton size="small" onClick={() => navigate(`/procurement/${p.row.id}?print=1`)}>
                <Print fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.15 }}>
            <Tooltip title="Edit">
              <IconButton size="small" color="primary" onClick={() => navigate(`/procurement/${p.row.id}`)}>
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => handleDelete(p.row.id)}>
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, width: '100%', maxWidth: '100%', minWidth: 0 }}>
      <PageHeader
        title="Supplier Purchase Orders"
        subtitle="Raise POs to trim and fabric suppliers with GST breakdown and print-ready layout"
        actions={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              startIcon={<Add />}
              variant="contained"
              onClick={() => navigate('/procurement/new')}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}
            >
              Raise Trim PO
            </Button>
            <Button
              startIcon={<Checkroom />}
              variant="contained"
              onClick={() => navigate('/procurement/new?mode=fabric')}
              sx={{
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: 1.5,
                color: '#fff',
                border: `1px solid ${alpha('#0d9488', 0.45)}`,
                boxShadow: `0 2px 10px ${alpha('#0f766e', 0.35)}`,
                backgroundColor: '#0f766e',
                backgroundImage: `repeating-linear-gradient(135deg, ${alpha('#fff', 0.08)} 0px, ${alpha('#fff', 0.08)} 4px, transparent 4px, transparent 10px)`,
                '&:hover': {
                  backgroundColor: '#0d9488',
                  boxShadow: `0 4px 14px ${alpha('#0f766e', 0.45)}`,
                },
              }}
            >
              Raise Fabric PO
            </Button>
          </Box>
        }
      />

      <DataGridShell
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          // Let the grid size to its rows (no fixed viewport → no table vertical scroll).
          '& > .MuiDataGrid-root': {
            height: 'auto !important',
            width: '100%',
          },
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
          getRowClassName={(p) => (p.indexRelativeToCurrentPage % 2 === 1 ? 'po-row--alt' : '')}
          sx={gridSx}
          disableRowSelectionOnClick
          disableColumnMenu
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </DataGridShell>

      <SupplierPOViewModal
        open={Boolean(viewId)}
        poId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => { setViewId(null); navigate(`/procurement/${id}`); }}
      />

      {buyerPoId && (
        <BuyerPoDetailDialog
          poId={buyerPoId}
          onClose={() => setBuyerPoId(null)}
        />
      )}
    </Box>
  );
}
