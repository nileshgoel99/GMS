import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete, Box, CircularProgress, TextField, Typography, createFilterOptions,
} from '@mui/material';
import { AddBusiness } from '@mui/icons-material';
import { suppliersAPI } from '../../services/api';

const filter = createFilterOptions();

/**
 * Supplier picker with type-to-search and "Create new supplier" when no match.
 * value = supplier id | null
 */
export default function SupplierAutocomplete({
  suppliers = [],
  value = null,
  onChange,
  onSuppliersChange,
  label = 'Supplier (optional)',
  placeholder = 'Search or create supplier…',
  size = 'small',
  disabled = false,
  fullWidth = true,
  TextFieldProps = {},
}) {
  const [inputValue, setInputValue] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === value) || null,
    [suppliers, value],
  );

  useEffect(() => {
    setInputValue(selected?.name || '');
  }, [selected?.id, selected?.name]);

  const createSupplier = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await suppliersAPI.create({
        name: trimmed,
        country: 'India',
        is_active: true,
      });
      const created = res.data;
      const nextList = [...suppliers.filter((s) => s.id !== created.id), created]
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      onSuppliersChange?.(nextList);
      onChange?.(created.id);
      setInputValue(created.name || trimmed);
    } catch (e) {
      const msg = e.response?.data ? JSON.stringify(e.response.data) : e.message;
      alert(`Could not create supplier: ${msg}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Autocomplete
      fullWidth={fullWidth}
      size={size}
      disabled={disabled || creating}
      options={suppliers}
      value={selected}
      inputValue={inputValue}
      onInputChange={(_, v, reason) => {
        if (reason === 'reset' && selected) {
          setInputValue(selected.name || '');
          return;
        }
        setInputValue(v);
      }}
      onChange={async (_, option) => {
        if (!option) {
          onChange?.(null);
          return;
        }
        if (option.__create) {
          await createSupplier(option.inputValue || option.name);
          return;
        }
        onChange?.(option.id);
      }}
      filterOptions={(options, params) => {
        const filtered = filter(options, params);
        const typed = (params.inputValue || '').trim();
        if (!typed) return filtered;

        const exact = options.some(
          (s) => String(s.name || '').trim().toLowerCase() === typed.toLowerCase(),
        );
        if (!exact) {
          filtered.push({
            __create: true,
            inputValue: typed,
            name: typed,
            id: `__create__:${typed}`,
          });
        }
        return filtered;
      }}
      getOptionLabel={(o) => {
        if (!o) return '';
        if (typeof o === 'string') return o;
        if (o.__create) return o.inputValue || o.name || '';
        return o.name || '';
      }}
      isOptionEqualToValue={(a, b) => a?.id === b?.id}
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      renderOption={(props, option) => {
        if (option.__create) {
          const { key, ...rest } = props;
          return (
            <Box
              component="li"
              key={key}
              {...rest}
              sx={{
                display: 'flex !important',
                alignItems: 'center',
                gap: 1,
                py: '10px !important',
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <AddBusiness sx={{ fontSize: 18, color: 'primary.main' }} />
              <Box>
                <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'primary.main' }}>
                  Create new supplier
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  &ldquo;{option.inputValue}&rdquo;
                </Typography>
              </Box>
            </Box>
          );
        }
        return (
          <Box component="li" {...props}>
            <Box>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{option.name}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                {[option.country, option.gst].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size={size}
          fullWidth={fullWidth}
          label={label}
          placeholder={placeholder}
          helperText="Type a name to search, or create a new supplier"
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {creating ? <CircularProgress color="inherit" size={16} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
          {...TextFieldProps}
        />
      )}
    />
  );
}
