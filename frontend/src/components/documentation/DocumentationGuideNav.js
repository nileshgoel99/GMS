import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
} from '@mui/material';
import {
  PlayArrow,
  PeopleOutline,
  ReceiptLong,
  AssignmentOutlined,
  StorefrontOutlined,
  LocalShippingOutlined,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { slate } from '../../theme/appTheme';
import {
  DOCUMENTATION_GUIDES,
  guideCategories,
} from '../../config/documentationGuides';

const CATEGORY_META = {
  Buyers: { accent: '#0f766e', Icon: PeopleOutline, step: 1 },
  'Buyers PO': { accent: '#0369a1', Icon: ReceiptLong, step: 2 },
  Indents: { accent: '#b45309', Icon: AssignmentOutlined, step: 3 },
  Suppliers: { accent: '#7c3aed', Icon: StorefrontOutlined, step: 4 },
  Procurement: { accent: '#047857', Icon: LocalShippingOutlined, step: 5 },
};

const categoryMeta = (name) => CATEGORY_META[name] || {
  accent: slate[500],
  Icon: PlayArrow,
  step: 0,
};

/** Left navigation — workflow-ordered guide index. */
export default function DocumentationGuideNav({
  activeId,
  onSelect,
  stickyTop = 88,
  fillHeight = false,
}) {
  const theme = useTheme();
  const categories = guideCategories(DOCUMENTATION_GUIDES);

  return (
    <Paper
      elevation={0}
      sx={{
        position: fillHeight ? 'relative' : 'sticky',
        top: fillHeight ? 'auto' : stickyTop,
        height: fillHeight ? '100%' : 'auto',
        maxHeight: fillHeight ? '100%' : `calc(100vh - ${stickyTop + 32}px)`,
        overflowY: 'auto',
        borderRadius: 2.5,
        border: `1px solid ${slate[200]}`,
        bgcolor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: alpha(slate[400], 0.35),
          borderRadius: 999,
        },
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1.75,
          borderBottom: `1px solid ${slate[200]}`,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', color: slate[900] }}>
          Learning path
        </Typography>
        <Typography sx={{ mt: 0.4, fontSize: '0.75rem', color: slate[500], lineHeight: 1.45, fontWeight: 500 }}>
          Follow the steps in order — from buyers to supplier POs.
        </Typography>
      </Box>

      <Box sx={{ p: 1.5, flex: 1 }}>
        {categories.map((category) => {
          const meta = categoryMeta(category);
          const Icon = meta.Icon;
          const guides = DOCUMENTATION_GUIDES.filter((g) => g.category === category);
          const hasActive = guides.some((g) => g.id === activeId);

          return (
            <Box key={category} sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.5, mb: 1 }}>
                <Box
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: 1.25,
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(meta.accent, hasActive ? 0.18 : 0.1),
                    color: meta.accent,
                    flexShrink: 0,
                  }}
                >
                  <Icon sx={{ fontSize: 15 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    sx={{
                      fontSize: '0.62rem',
                      fontWeight: 800,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: slate[500],
                      lineHeight: 1.2,
                    }}
                  >
                    Step {meta.step || '—'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: slate[800], lineHeight: 1.25 }}>
                    {category}
                  </Typography>
                </Box>
              </Stack>

              <Stack spacing={0.6}>
                {guides.map((guide, idx) => {
                  const selected = guide.id === activeId;
                  return (
                    <Box
                      key={guide.id}
                      component="button"
                      type="button"
                      onClick={() => onSelect(guide.id)}
                      sx={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        cursor: 'pointer',
                        font: 'inherit',
                        outline: 'none',
                        p: 0,
                        borderRadius: 1.75,
                        bgcolor: selected ? alpha(meta.accent, 0.1) : slate[50],
                        border: `1px solid ${selected ? alpha(meta.accent, 0.45) : slate[200]}`,
                        boxShadow: selected ? `inset 3px 0 0 0 ${meta.accent}` : 'none',
                        transition: 'background-color 0.15s ease, border-color 0.15s ease',
                        '&:hover': {
                          bgcolor: selected ? alpha(meta.accent, 0.14) : alpha(slate[100], 0.95),
                          borderColor: selected ? alpha(meta.accent, 0.55) : slate[300],
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1} sx={{ px: 1.25, py: 1.1, alignItems: 'flex-start' }}>
                        <Box
                          sx={{
                            mt: 0.15,
                            width: 22,
                            height: 22,
                            borderRadius: '50%',
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: selected ? meta.accent : '#fff',
                            color: selected ? '#fff' : meta.accent,
                            border: `1px solid ${alpha(meta.accent, 0.35)}`,
                            fontSize: '0.65rem',
                            fontWeight: 800,
                          }}
                        >
                          {selected ? <PlayArrow sx={{ fontSize: 14 }} /> : idx + 1}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{
                              fontWeight: selected ? 800 : 700,
                              fontSize: '0.8rem',
                              lineHeight: 1.35,
                              color: slate[900],
                            }}
                          >
                            {guide.title}
                          </Typography>
                          <Typography
                            sx={{
                              mt: 0.35,
                              fontSize: '0.7rem',
                              lineHeight: 1.4,
                              color: slate[500],
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {guide.description}
                          </Typography>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
