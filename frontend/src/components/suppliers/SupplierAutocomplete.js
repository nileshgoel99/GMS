import React, { useEffect, useMemo, useState } from 'react';
import {
  Autocomplete, Box, Chip, CircularProgress, TextField, Typography, createFilterOptions,
} from '@mui/material';
import { AddBusiness } from '@mui/icons-material';
import { suppliersAPI } from '../../services/api';

const filter = createFilterOptions();

const suppliesList = (supplier) => {
  const raw = supplier?.supplies_in;
  if (Array.isArray(raw)) return raw.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return [raw.trim()];
  return [];
};

const suppliesMatch = (supplier, hint) => {
  const h = (hint || '').trim().toLowerCase();
  if (!h) return false;
  return suppliesList(supplier).some((x) => x.toLowerCase() === h || x.toLowerCase().includes(h));
};

/**
 * Supplier picker with type-to-search and "Create new supplier" when no match.
 * value = supplier id | null
 *
 * suppliesInHint — trim name/category; used to sort matches and seed supplies_in on create.
 */
export default function SupplierAutocomplete({
  suppliers = [],
  value = null,
  onChange,
  onSuppliersChange,
  suppliesInHint = '',
  label = 'Supplier (optional)',
  placeholder = 'Search or create supplier…',
  size = 'small',
  disabled = false,
  fullWidth = true,
  compact = false,
  TextFieldProps = {},
}) {
  const [inputValue, setInputValue] = useState('');
  const [creating, setCreating] = useState(false);

  const selected = useMemo(
    () => suppliers.find((s) => s.id === value) || null,
    [suppliers, value],
  );

  const sortedSuppliers = useMemo(() => {
    if (!suppliesInHint) return suppliers;
    return [...suppliers].sort((a, b) => {
      const am = suppliesMatch(a, suppliesInHint) ? 0 : 1;
      const bm = suppliesMatch(b, suppliesInHint) ? 0 : 1;
      if (am !== bm) return am - bm;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [suppliers, suppliesInHint]);

  useEffect(() => {
    setInputValue(selected?.name || '');
  }, [selected?.id, selected?.name]);

  const createSupplier = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const hint = (suppliesInHint || '').trim();
      const res = await suppliersAPI.create({
        name: trimmed,
        country: 'India',
        is_active: true,
        supplies_in: hint ? [hint] : [],
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
      options={sortedSuppliers}
      value={selected}
      inputValue={inputValue}
      disableClearable={!!compact}
      forcePopupIcon={!compact}
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
                  {suppliesInHint ? ` · supplies ${suppliesInHint}` : ''}
                </Typography>
              </Box>
            </Box>
          );
        }
        const supplies = suppliesList(option);
        return (
          <Box component="li" {...props}>
            <Box sx={{ minWidth: 0, width: '100%' }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{option.name}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                {[option.country, option.gst].filter(Boolean).join(' · ')}
              </Typography>
              {supplies.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                  {supplies.slice(0, 4).map((s) => (
                    <Chip
                      key={s}
                      label={s}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.62rem',
                        fontWeight: suppliesMatch({ supplies_in: [s] }, suppliesInHint) ? 700 : 500,
                        bgcolor: suppliesMatch({ supplies_in: [s] }, suppliesInHint) ? 'primary.50' : 'action.hover',
                      }}
                    />
                  ))}
                  {supplies.length > 4 && (
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', alignSelf: 'center' }}>
                      +{supplies.length - 4}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => {
        const { sx: textFieldSx, ...restTextFieldProps } = TextFieldProps || {};
        return (
          <TextField
            {...params}
            size={size}
            fullWidth={fullWidth}
            label={compact ? undefined : label}
            placeholder={placeholder}
            helperText={compact ? undefined : 'Type a name to search, or create a new supplier'}
            multiline={!!compact}
            minRows={1}
            maxRows={compact ? 3 : undefined}
            InputProps={{
              ...params.InputProps,
              endAdornment: compact
                ? (creating ? <CircularProgress color="inherit" size={16} sx={{ mr: 1 }} /> : null)
                : (
                  <>
                    {creating ? <CircularProgress color="inherit" size={16} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
            }}
            inputProps={{
              ...params.inputProps,
              title: selected?.name || inputValue || '',
            }}
            sx={[
              compact && {
                '& .MuiInputBase-root': { pr: '10px !important' },
                '& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button': {
                  WebkitAppearance: 'none',
                  margin: 0,
                },
                '& input[type=number]': { MozAppearance: 'textfield' },
              },
              textFieldSx,
            ]}
            {...restTextFieldProps}
          />
        );
      }}
    />
  );
}
