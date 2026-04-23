import { createTheme, alpha } from '@mui/material/styles';

/** Slate scale — aligns with SteelWMS text + borders */
export const slate = {
  950: '#020617',
  900: '#0f172a',
  800: '#1e293b',
  700: '#334155',
  600: '#475569',
  500: '#64748b',
  400: '#94a3b8',
  300: '#cbd5e1',
  200: '#e2e8f0',
  100: '#f1f5f9',
  50: '#f8fafc',
};

/** Warm canvas — unbleached / mill floor neutrals */
export const warm = {
  50: '#faf8f4',
  100: '#f3efe6',
  200: '#e8e0d4',
  paper: '#ffffff',
  white: '#ffffff',
  canvas: '#f4f1ea',
};

/** Muted accents for chips / charts */
export const spectrum = {
  violet: '#6366f1',
  violetDeep: '#4338ca',
  indigo: '#4f46e5',
  fuchsia: '#7c3aed',
  cyan: '#0ea5e9',
  sky: '#38bdf8',
  amber: '#f59e0b',
  emerald: '#10b981',
  pink: '#ec4899',
};

/** Garment production — deep teal (quality / floor), not SaaS purple */
const brand = {
  main: '#0f766e',
  light: '#14b8a6',
  dark: '#0d5c56',
  contrastText: '#ffffff',
};

export const emerald = {
  main: '#10b981',
  light: '#34d399',
  dark: '#059669',
  vivid: '#10b981',
  contrastText: '#ffffff',
};

/** Light shell — indigo on cool white */
export const navy = {
  deep: '#1e1b4b',
  panel: '#312e81',
  mid: '#4338ca',
};

const base = createTheme();

const rSm = 8;
const rMd = 12;
const rLg = 18;

/** Single professional UI stack: readable in forms, strong hierarchy for headings. */
const fontUi =
  '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", sans-serif';

const softElevation = [
  'none',
  `0 1px 2px ${alpha(slate[900], 0.04)}`,
  `0 2px 8px ${alpha(slate[900], 0.05)}`,
  `0 4px 16px ${alpha(slate[900], 0.06)}`,
  `0 8px 24px ${alpha(slate[900], 0.07)}`,
  `0 12px 32px ${alpha(slate[900], 0.08)}`,
  `0 16px 40px ${alpha(slate[900], 0.09)}`,
  `0 20px 48px ${alpha(slate[900], 0.1)}`,
  ...base.shadows.slice(7),
];

/** Soft wash — teal + subtle thread (amber) hint */
const atmosphereBg = `
  radial-gradient(ellipse 120% 85% at 8% -8%, ${alpha(brand.main, 0.09)}, transparent 58%),
  radial-gradient(ellipse 92% 58% at 96% 2%, ${alpha('#b45309', 0.045)}, transparent 52%),
  radial-gradient(ellipse 72% 48% at 50% 100%, ${alpha(slate[600], 0.035)}, transparent 55%)
`;

/** Cross-hatch linen (technical drawing) */
const linenTexture = `
  repeating-linear-gradient(
    -11deg,
    ${alpha(slate[800], 0.018)} 0px,
    ${alpha(slate[800], 0.018)} 1px,
    transparent 1px,
    transparent 6px
  )
`;

/** Micro-dot grid */
const dotGrid = `
  radial-gradient(circle at 1px 1px, ${alpha(slate[600], 0.055)} 1px, transparent 0)
`;

export const appTheme = createTheme({
  palette: {
    mode: 'light',
    primary: brand,
    secondary: {
      main: slate[600],
      light: slate[500],
      dark: slate[800],
      contrastText: '#ffffff',
    },
    background: {
      default: warm.canvas,
      paper: warm.paper,
    },
    text: {
      primary: slate[800],
      secondary: slate[600],
      disabled: alpha(slate[500], 0.75),
    },
    divider: slate[200],
    success: { main: '#10B981', light: '#34d399', dark: '#059669', contrastText: '#fff' },
    warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706', contrastText: slate[900] },
    error: { main: '#EF4444', light: '#f87171', dark: '#dc2626', contrastText: '#fff' },
    info: { main: '#0ea5e9', light: '#38bdf8', dark: '#0284c7', contrastText: '#fff' },
    grey: {
      ...base.palette.grey,
      50: warm[50],
      100: warm[100],
    },
    action: {
      hover: alpha(slate[800], 0.04),
      selected: alpha(brand.main, 0.1),
      focus: alpha(brand.main, 0.18),
      disabledBackground: alpha(slate[500], 0.12),
    },
  },
  shape: {
    borderRadius: rMd,
  },
  shadows: softElevation,
  transitions: {
    ...base.transitions,
    duration: {
      ...base.transitions.duration,
      enteringScreen: 280,
      leavingScreen: 240,
    },
    easing: {
      ...base.transitions.easing,
      emphasis: 'cubic-bezier(0.2, 0, 0, 1)',
    },
  },
  typography: {
    fontFamily: fontUi,
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.03em',
      lineHeight: 1.12,
      fontSize: '2.125rem',
      color: slate[800],
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.028em',
      lineHeight: 1.2,
      fontSize: '1.75rem',
      color: slate[800],
    },
    h3: {
      fontWeight: 700,
      letterSpacing: '-0.024em',
      lineHeight: 1.25,
      fontSize: '1.5rem',
      color: slate[800],
    },
    h4: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
      lineHeight: 1.3,
      fontSize: '1.28rem',
      color: slate[800],
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.015em',
      lineHeight: 1.35,
      color: slate[800],
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
      lineHeight: 1.4,
      color: slate[800],
    },
    subtitle1: {
      fontWeight: 500,
      letterSpacing: '-0.01em',
      lineHeight: 1.6,
      color: slate[600],
    },
    subtitle2: {
      fontWeight: 500,
      fontSize: '0.8125rem',
      lineHeight: 1.55,
      letterSpacing: 0,
      color: slate[500],
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      letterSpacing: '-0.011em',
      color: slate[800],
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.55,
      letterSpacing: '-0.008em',
      color: slate[600],
    },
    button: {
      fontWeight: 600,
      letterSpacing: '0.01em',
      textTransform: 'none',
      lineHeight: 1.5,
    },
    overline: {
      fontWeight: 600,
      letterSpacing: '0.08em',
      fontSize: '0.7rem',
      lineHeight: 1.5,
      color: slate[500],
    },
    caption: {
      fontSize: '0.75rem',
      lineHeight: 1.5,
      letterSpacing: '0.01em',
      color: slate[500],
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: warm.canvas,
          backgroundImage: `${atmosphereBg}, ${linenTexture}, ${dotGrid}`,
          backgroundSize: 'auto, auto, 20px 20px',
          backgroundAttachment: 'fixed',
        },
        '*, *::before, *::after': {
          scrollBehavior: 'smooth',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: rMd },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: rMd,
          backgroundImage: 'none',
          transition: 'box-shadow 0.2s ease',
        },
        elevation1: {
          boxShadow: softElevation[1],
          border: `1px solid ${slate[200]}`,
        },
        elevation2: {
          boxShadow: softElevation[2],
        },
      },
    },
    /** Drawer / AppBar use Paper — keep shell square where sidebar meets header */
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          borderRadius: 0,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: rMd,
          paddingInline: 18,
          paddingBlock: 9,
          minHeight: 40,
          fontSize: '0.875rem',
          transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease',
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${brand.light} 0%, ${brand.main} 44%, ${brand.dark} 100%)`,
          boxShadow: `0 2px 10px ${alpha(brand.main, 0.28)}`,
          '&:hover': {
            background: `linear-gradient(135deg, #5eead4 0%, ${brand.light} 38%, ${brand.main} 100%)`,
            boxShadow: `0 4px 18px ${alpha(brand.main, 0.34)}`,
          },
        },
        containedSecondary: {
          backgroundColor: slate[100],
          color: slate[800],
          boxShadow: 'none',
          '&:hover': {
            backgroundColor: slate[200],
            boxShadow: 'none',
          },
        },
        outlined: {
          borderWidth: '1px',
          borderColor: slate[200],
          color: slate[700],
          '&:hover': {
            borderColor: alpha(brand.main, 0.45),
            backgroundColor: alpha(brand.main, 0.05),
          },
        },
        text: {
          '&:hover': { backgroundColor: alpha(brand.main, 0.06) },
        },
        sizeLarge: {
          paddingInline: 22,
          paddingBlock: 11,
          minHeight: 44,
          fontSize: '0.9375rem',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: rSm,
          transition: 'background-color 0.15s ease',
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'medium' },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontFamily: fontUi,
          fontWeight: 500,
          fontSize: '0.8125rem',
          letterSpacing: '0.01em',
          textTransform: 'none',
          color: slate[600],
          lineHeight: 1.4,
          transformOrigin: 'top left',
          '&.Mui-focused': { color: brand.dark, fontWeight: 600 },
          '&.MuiInputLabel-shrink': {
            fontWeight: 600,
            color: slate[500],
            letterSpacing: '0.02em',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: warm.paper,
          fontSize: '1rem',
          minHeight: 48,
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease',
          boxShadow: 'none',
          alignItems: 'center',
          '&:hover': {
            backgroundColor: warm.paper,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(brand.main, 0.4),
            },
          },
          '&.Mui-focused': {
            backgroundColor: '#fff',
            boxShadow: `0 0 0 3px ${alpha(brand.main, 0.2)}`,
            '& .MuiOutlinedInput-notchedOutline': {
              borderWidth: '1.5px',
              borderColor: brand.main,
            },
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: base.palette.error.main,
          },
          '&.MuiInputBase-multiline': {
            minHeight: 0,
            alignItems: 'flex-start',
            paddingTop: 4,
            paddingBottom: 4,
          },
        },
        notchedOutline: {
          borderColor: slate[200],
        },
        input: {
          fontWeight: 500,
          letterSpacing: '-0.01em',
          padding: '12px 14px',
          lineHeight: 1.5,
          '&::placeholder': {
            color: alpha(slate[500], 0.7),
            opacity: 1,
            fontWeight: 400,
          },
        },
        inputMultiline: {
          padding: '12px 14px !important',
          minHeight: 96,
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          fontWeight: 400,
          fontSize: '0.8125rem',
          lineHeight: 1.45,
          marginTop: 6,
          marginLeft: 2,
        },
      },
    },
    MuiSelect: {
      defaultProps: { size: 'medium' },
      styleOverrides: {
        select: { fontWeight: 400 },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: rMd,
          marginTop: 4,
          border: `1px solid ${slate[200]}`,
          boxShadow: softElevation[3],
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: rSm,
          fontSize: '0.9375rem',
          minHeight: 44,
          '&.Mui-selected': {
            backgroundColor: alpha(brand.main, 0.1),
            fontWeight: 600,
            '&:hover': { backgroundColor: alpha(brand.main, 0.14) },
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          padding: 8,
          '& .MuiSwitch-switchBase.Mui-checked': {
            color: brand.light,
            '& + .MuiSwitch-track': {
              backgroundColor: brand.main,
              opacity: 1,
            },
          },
        },
        track: {
          borderRadius: 12,
          opacity: 1,
          backgroundColor: alpha(slate[500], 0.35),
        },
        thumb: {
          boxShadow: `0 1px 3px ${alpha(slate[900], 0.2)}`,
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          borderRadius: rSm,
          '&:hover': { backgroundColor: alpha(brand.main, 0.06) },
          '&.Mui-checked': { color: brand.main },
        },
      },
    },
    MuiFormControlLabel: {
      styleOverrides: {
        label: {
          fontWeight: 500,
          fontSize: '0.875rem',
          color: slate[700],
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.875rem',
          minHeight: 44,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: rLg,
          border: `1px solid ${alpha('#fff', 0.9)}`,
          boxShadow: softElevation[5],
          backgroundColor: alpha(warm.paper, 0.88),
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontFamily: fontUi,
          fontSize: '1.2rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          paddingBottom: 12,
          borderBottom: `1px solid ${slate[200]}`,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          borderTop: `1px solid ${slate[200]}`,
          gap: 8,
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { paddingTop: 16 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
          borderRadius: rSm,
          fontVariantNumeric: 'tabular-nums',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          fontWeight: 500,
          borderRadius: rSm,
          padding: '6px 10px',
          boxShadow: softElevation[2],
          background: slate[800],
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: rMd,
          alignItems: 'flex-start',
          boxShadow: 'none',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: rSm,
          height: 4,
          backgroundColor: alpha(slate[500], 0.15),
        },
      },
    },
    MuiCircularProgress: {
      defaultProps: { thickness: 4 },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: slate[200] },
      },
    },
  },
});

export const layoutDrawerWidth = 300;

/** Sidebar — deep mill green / graphite (garment floor, not generic SaaS) */
export const navChrome = {
  gradient: `linear-gradient(180deg, #142322 0%, #1e3330 46%, #162827 100%)`,
  sheen: `linear-gradient(135deg, ${alpha('#fff', 0.035)} 0%, transparent 40%, ${alpha(brand.light, 0.08)} 100%)`,
  border: alpha('#fff', 0.08),
  rail: brand.light,
  textMuted: alpha(slate[300], 0.88),
  text: slate[100],
  accentBar: alpha(brand.main, 0.28),
};

export const ink = slate;

export const accent = { ...brand };

export const dataGridSx = {
  border: 'none',
  borderRadius: '12px',
  fontFamily: fontUi,
  '& .MuiDataGrid-columnHeaders': {
    backgroundColor: alpha(slate[800], 0.03),
    fontWeight: 600,
    fontSize: '0.75rem',
    textTransform: 'none',
    letterSpacing: '0.04em',
    color: slate[500],
    borderBottom: `1px solid ${slate[200]}`,
    fontFamily: fontUi,
  },
  '& .MuiDataGrid-row': {
    transition: 'background-color 0.15s ease',
  },
  '& .MuiDataGrid-row:hover': {
    backgroundColor: alpha(brand.main, 0.04),
  },
  '& .MuiDataGrid-row.Mui-selected': {
    backgroundColor: alpha(brand.main, 0.08),
    '&:hover': { backgroundColor: alpha(brand.main, 0.1) },
  },
  '& .MuiDataGrid-cell': {
    borderColor: alpha(slate[200], 0.8),
    fontSize: '0.875rem',
    fontVariantNumeric: 'tabular-nums',
  },
  '& .MuiDataGrid-footerContainer': {
    borderTop: `1px solid ${slate[200]}`,
    backgroundColor: warm[50],
  },
};
