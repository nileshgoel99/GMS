import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Button, Typography, TextField, IconButton, Chip, MenuItem, Switch,
  FormControlLabel, Tabs, Tab, Checkbox, FormGroup, FormControlLabel as MuiFormControlLabel,
  Tooltip, Avatar,
} from '@mui/material';
import { Add, Edit, Delete, ManageAccounts, Security } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import PageHeader from '../components/PageHeader';
import DataGridShell from '../components/DataGridShell';
import { dataGridSx, slate } from '../theme/appTheme';
import { accountsAPI } from '../services/api';
import { ALL_MODULES, moduleLabel } from '../config/permissions';
import { confirmDiscardUnsaved } from '../hooks/useUnsavedChanges';

const asList = (d) => (Array.isArray(d) ? d : d?.results ?? []);

const userInitials = (row) => {
  const fn = (row.first_name || '').trim();
  const ln = (row.last_name || '').trim();
  if (fn || ln) {
    return `${fn.charAt(0)}${ln.charAt(0) || fn.charAt(1) || ''}`.toUpperCase();
  }
  const u = (row.username || 'U').trim();
  return u.slice(0, 2).toUpperCase();
};

const capitalizeWord = (s) => {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const displayPersonName = (row) => {
  const first = capitalizeWord(row.first_name);
  const last = capitalizeWord(row.last_name);
  const full = [first, last].filter(Boolean).join(' ');
  return full || capitalizeWord(row.username) || '—';
};

const emptyUserForm = (roleId = '') => ({
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  role_id: roleId,
  is_active: true,
});

const emptyRoleForm = () => ({
  name: '',
  code: '',
  description: '',
  is_admin: false,
  modules: ['dashboard'],
});

function DialogShell({ open, title, onClose, children, onSave, saving, saveLabel = 'Save', isDirty = false }) {
  if (!open) return null;
  const requestClose = () => {
    if (!confirmDiscardUnsaved(isDirty)) return;
    onClose();
  };
  return (
    <Box sx={{
      position: 'fixed', inset: 0, bgcolor: 'rgba(15,23,42,0.45)', zIndex: 1300,
      display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
    }}
    onClick={requestClose}
    >
      <Box sx={{ bgcolor: '#fff', borderRadius: 2, p: 3, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 2 }}>{title}</Typography>
        {children}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 3 }}>
          <Button onClick={requestClose} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={onSave} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default function UsersPage() {
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [roleSearch, setRoleSearch] = useState('');

  const [userDialog, setUserDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm());

  const [roleDialog, setRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState(emptyRoleForm());

  const [saving, setSaving] = useState(false);
  const userBaselineRef = useRef(JSON.stringify(emptyUserForm()));
  const roleBaselineRef = useRef(JSON.stringify(emptyRoleForm()));

  const loadRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await accountsAPI.getRoles({ search: roleSearch });
      setRoles(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRoles(false);
    }
  }, [roleSearch]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await accountsAPI.getUsers({ search: userSearch });
      setUsers(asList(res.data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  }, [userSearch]);

  useEffect(() => { loadRoles(); }, [loadRoles]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const defaultRoleId = roles.find((r) => r.code === 'MERCHANDISER')?.id || roles[0]?.id || '';

  const gridSx = {
    ...dataGridSx,
    width: '100%',
    bgcolor: '#fff',
    '& .MuiDataGrid-columnHeaders': {
      ...(dataGridSx['& .MuiDataGrid-columnHeaders'] || {}),
      bgcolor: slate[50],
      borderBottom: `2px solid ${slate[200]}`,
    },
  };

  // ── User handlers ──
  const openNewUser = () => {
    setEditingUser(null);
    const next = emptyUserForm(defaultRoleId);
    setUserForm(next);
    userBaselineRef.current = JSON.stringify(next);
    setUserDialog(true);
  };

  const openEditUser = (row) => {
    setEditingUser(row);
    const next = {
      username: row.username,
      email: row.email || '',
      first_name: row.first_name || '',
      last_name: row.last_name || '',
      password: '',
      role_id: row.role_id || defaultRoleId,
      is_active: row.is_active,
    };
    setUserForm(next);
    userBaselineRef.current = JSON.stringify(next);
    setUserDialog(true);
  };

  const saveUser = async () => {
    if (!editingUser && !userForm.username.trim()) { alert('Username is required.'); return; }
    if (!editingUser && !userForm.password) { alert('Password is required for new users.'); return; }
    if (!userForm.role_id) { alert('Select a role.'); return; }
    setSaving(true);
    try {
      if (editingUser) {
        const payload = {
          email: userForm.email,
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          role_id: userForm.role_id,
          is_active: userForm.is_active,
        };
        if (userForm.password) payload.password = userForm.password;
        await accountsAPI.updateUser(editingUser.id, payload);
      } else {
        await accountsAPI.createUser(userForm);
      }
      setUserDialog(false);
      loadUsers();
    } catch (e) {
      alert(JSON.stringify(e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  // ── Role handlers ──
  const openNewRole = () => {
    setEditingRole(null);
    const next = emptyRoleForm();
    setRoleForm(next);
    roleBaselineRef.current = JSON.stringify(next);
    setRoleDialog(true);
  };

  const openEditRole = (row) => {
    setEditingRole(row);
    const next = {
      name: row.name,
      code: row.code,
      description: row.description || '',
      is_admin: row.is_admin,
      modules: row.is_admin ? [] : [...(row.modules || [])],
    };
    setRoleForm(next);
    roleBaselineRef.current = JSON.stringify(next);
    setRoleDialog(true);
  };

  const toggleModule = (key) => {
    setRoleForm((f) => ({
      ...f,
      modules: f.modules.includes(key)
        ? f.modules.filter((m) => m !== key)
        : [...f.modules, key],
    }));
  };

  const saveRole = async () => {
    if (!roleForm.name.trim()) { alert('Role name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description,
        is_admin: roleForm.is_admin,
        modules: roleForm.is_admin ? [] : roleForm.modules,
      };
      if (roleForm.code.trim()) payload.code = roleForm.code.trim().toUpperCase();
      if (editingRole) {
        await accountsAPI.updateRole(editingRole.id, payload);
      } else {
        await accountsAPI.createRole(payload);
      }
      setRoleDialog(false);
      loadRoles();
      loadUsers();
    } catch (e) {
      alert(JSON.stringify(e.response?.data || e.message));
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (row) => {
    if (row.is_system) { alert('System roles cannot be deleted.'); return; }
    if (row.user_count > 0) { alert('Reassign users before deleting this role.'); return; }
    if (!window.confirm(`Delete role "${row.name}"?`)) return;
    try {
      await accountsAPI.deleteRole(row.id);
      loadRoles();
    } catch (e) {
      alert(JSON.stringify(e.response?.data || e.message));
    }
  };

  const userColumns = [
    {
      field: 'username',
      headerName: 'User',
      flex: 1.2,
      minWidth: 180,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', height: '100%' }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.02em',
              bgcolor: alpha('#0f766e', 0.12),
              color: '#0f766e',
              border: `1px solid ${alpha('#0f766e', 0.25)}`,
            }}
          >
            {userInitials(row)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.25, textTransform: 'capitalize' }}>
              {displayPersonName(row)}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', lineHeight: 1.3 }}>
              @{row.username}
            </Typography>
          </Box>
        </Box>
      ),
    },
    { field: 'email', headerName: 'Email', flex: 1.2, minWidth: 160 },
    {
      field: 'role_label',
      headerName: 'Role',
      width: 140,
      renderCell: ({ value }) => (
        <Chip label={value} size="small" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
      ),
    },
    {
      field: 'is_active',
      headerName: 'Active',
      width: 90,
      renderCell: ({ value }) => (
        <Chip label={value ? 'Yes' : 'No'} size="small" color={value ? 'success' : 'default'} variant="outlined" sx={{ fontWeight: 700, fontSize: '0.68rem' }} />
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 56,
      sortable: false,
      renderCell: ({ row }) => (
        <IconButton size="small" onClick={() => openEditUser(row)} aria-label="Edit user">
          <Edit fontSize="small" />
        </IconButton>
      ),
    },
  ];

  const roleColumns = [
    { field: 'name', headerName: 'Role', flex: 1, minWidth: 120 },
    { field: 'code', headerName: 'Code', width: 130 },
    {
      field: 'modules',
      headerName: 'Access',
      flex: 2,
      minWidth: 200,
      renderCell: ({ row }) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.35, py: 0.5 }}>
          {row.is_admin ? (
            <Chip label="All modules" size="small" color="primary" sx={{ fontSize: '0.65rem', height: 22 }} />
          ) : (
            (row.modules || []).slice(0, 4).map((m) => (
              <Chip key={m} label={moduleLabel(m)} size="small" variant="outlined" sx={{ fontSize: '0.62rem', height: 22 }} />
            ))
          )}
          {!row.is_admin && (row.modules || []).length > 4 && (
            <Chip label={`+${row.modules.length - 4}`} size="small" sx={{ fontSize: '0.62rem', height: 22 }} />
          )}
        </Box>
      ),
    },
    {
      field: 'user_count',
      headerName: 'Users',
      width: 80,
      align: 'center',
      headerAlign: 'center',
    },
    {
      field: 'actions',
      headerName: '',
      width: 96,
      sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <IconButton size="small" onClick={() => openEditRole(row)} aria-label="Edit role">
            <Edit fontSize="small" />
          </IconButton>
          {!row.is_system && (
            <Tooltip title={row.user_count > 0 ? 'Role has assigned users' : 'Delete role'}>
              <span>
                <IconButton size="small" onClick={() => deleteRole(row)} disabled={row.user_count > 0} aria-label="Delete role">
                  <Delete fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Users & roles"
        subtitle="Admin only — create roles, assign module access, and manage user accounts"
        icon={<ManageAccounts />}
      />

      <Box sx={{ borderBottom: `1px solid ${slate[200]}`, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Users" sx={{ textTransform: 'none', fontWeight: 700 }} />
          <Tab label="Roles" icon={<Security sx={{ fontSize: 18 }} />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
        </Tabs>
      </Box>

      {tab === 0 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField size="small" placeholder="Search users…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} sx={{ minWidth: 240 }} />
            <Button variant="contained" startIcon={<Add />} onClick={openNewUser} sx={{ fontWeight: 700, textTransform: 'none', ml: 'auto' }}>
              New user
            </Button>
          </Box>
          <DataGridShell>
            <DataGrid
              rows={users}
              columns={userColumns}
              loading={loadingUsers}
              disableRowSelectionOnClick
              autoHeight
              rowHeight={56}
              sx={gridSx}
            />
          </DataGridShell>
        </>
      )}

      {tab === 1 && (
        <>
          <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField size="small" placeholder="Search roles…" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} sx={{ minWidth: 240 }} />
            <Button variant="contained" startIcon={<Add />} onClick={openNewRole} sx={{ fontWeight: 700, textTransform: 'none', ml: 'auto' }}>
              New role
            </Button>
          </Box>
          <DataGridShell>
            <DataGrid rows={roles} columns={roleColumns} loading={loadingRoles} disableRowSelectionOnClick autoHeight getRowHeight={() => 'auto'} sx={gridSx} />
          </DataGridShell>
        </>
      )}

      <DialogShell
        open={userDialog}
        title={editingUser ? `Edit user — ${editingUser.username}` : 'New user'}
        onClose={() => setUserDialog(false)}
        onSave={saveUser}
        saving={saving}
        isDirty={JSON.stringify(userForm) !== userBaselineRef.current}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!editingUser && (
            <TextField size="small" fullWidth label="Username *" value={userForm.username}
              onChange={(e) => setUserForm((f) => ({ ...f, username: e.target.value }))} />
          )}
          <TextField size="small" fullWidth label="Email" value={userForm.email}
            onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))} />
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <TextField size="small" label="First name" value={userForm.first_name}
              onChange={(e) => setUserForm((f) => ({ ...f, first_name: e.target.value }))} />
            <TextField size="small" label="Last name" value={userForm.last_name}
              onChange={(e) => setUserForm((f) => ({ ...f, last_name: e.target.value }))} />
          </Box>
          <TextField size="small" fullWidth select label="Role *" value={userForm.role_id}
            onChange={(e) => setUserForm((f) => ({ ...f, role_id: e.target.value }))}>
            {roles.map((r) => (
              <MenuItem key={r.id} value={r.id}>{r.name}{r.is_admin ? ' (full access)' : ''}</MenuItem>
            ))}
          </TextField>
          <TextField size="small" fullWidth type="password"
            label={editingUser ? 'New password (leave blank to keep)' : 'Password *'}
            value={userForm.password}
            onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))} />
          <FormControlLabel
            control={<Switch checked={userForm.is_active} onChange={(e) => setUserForm((f) => ({ ...f, is_active: e.target.checked }))} />}
            label="Active"
          />
        </Box>
      </DialogShell>

      <DialogShell
        open={roleDialog}
        title={editingRole ? `Edit role — ${editingRole.name}` : 'New role'}
        onClose={() => setRoleDialog(false)}
        onSave={saveRole}
        saving={saving}
        isDirty={JSON.stringify(roleForm) !== roleBaselineRef.current}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField size="small" fullWidth label="Role name *" value={roleForm.name}
            onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))} />
          <TextField size="small" fullWidth label="Code (optional)" value={roleForm.code}
            placeholder="Auto-generated from name"
            onChange={(e) => setRoleForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            disabled={editingRole?.is_system} />
          <TextField size="small" fullWidth multiline minRows={2} label="Description" value={roleForm.description}
            onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))} />
          <FormControlLabel
            control={
              <Switch
                checked={roleForm.is_admin}
                onChange={(e) => setRoleForm((f) => ({ ...f, is_admin: e.target.checked, modules: e.target.checked ? [] : f.modules }))}
                disabled={editingRole?.is_system && editingRole?.is_admin}
              />
            }
            label="Admin — full access to all modules"
          />
          {!roleForm.is_admin && (
            <Box sx={{ border: `1px solid ${slate[200]}`, borderRadius: 1.5, p: 1.5 }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 1, color: 'text.secondary' }}>Module access</Typography>
              <FormGroup>
                {ALL_MODULES.map(({ key, label }) => (
                  <MuiFormControlLabel
                    key={key}
                    control={
                      <Checkbox
                        size="small"
                        checked={roleForm.modules.includes(key)}
                        onChange={() => toggleModule(key)}
                      />
                    }
                    label={<Typography sx={{ fontSize: '0.82rem' }}>{label}</Typography>}
                  />
                ))}
              </FormGroup>
            </Box>
          )}
        </Box>
      </DialogShell>
    </Box>
  );
}
