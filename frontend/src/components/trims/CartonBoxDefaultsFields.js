import React from 'react';
import { Grid, TextField, MenuItem, Typography } from '@mui/material';
import { CARTON_DIM_UNITS } from './trimConstants';

export default function CartonBoxDefaultsFields({ values, onChange, sxInput = {} }) {
  const setField = (field, value) => onChange({ ...values, [field]: value });

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#92400e', mb: 0.5 }}>
          Carton Dimensions (defaults)
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>
          Saved with this trim and used when picking it on an indent.
        </Typography>
      </Grid>
      <Grid item xs={12} sm={3}>
        <TextField
          size="small"
          fullWidth
          label="Pcs/Box"
          type="number"
          value={values.pcs_per_carton}
          onChange={(e) => setField('pcs_per_carton', e.target.value)}
          sx={sxInput}
        />
      </Grid>
      <Grid item xs={12} sm={3}>
        <TextField
          size="small"
          fullWidth
          label="PLY"
          value={values.carton_ply}
          onChange={(e) => setField('carton_ply', e.target.value)}
          placeholder="5 PLY"
          sx={sxInput}
        />
      </Grid>
      <Grid item xs={12} sm={2}>
        <TextField
          size="small"
          fullWidth
          select
          label="Dim. unit"
          value={values.carton_dimensions_unit || 'CMS'}
          onChange={(e) => setField('carton_dimensions_unit', e.target.value)}
          sx={sxInput}
        >
          {CARTON_DIM_UNITS.map((u) => (
            <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
          ))}
        </TextField>
      </Grid>
      <Grid item xs={12} sm={4}>
        <TextField
          size="small"
          fullWidth
          label={`Dimensions (L × W × H, ${values.carton_dimensions_unit === 'INCH' ? 'Inches' : 'CMS'})`}
          value={values.carton_dimensions}
          onChange={(e) => setField('carton_dimensions', e.target.value)}
          sx={sxInput}
        />
      </Grid>
    </Grid>
  );
}
