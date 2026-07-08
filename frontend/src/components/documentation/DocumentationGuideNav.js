import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Divider,
} from '@mui/material';
import {
  MenuBook,
  PlayArrow,
  ChevronRight,
  VideoLibrary,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import { slate, spectrum } from '../../theme/appTheme';
import { DOCUMENTATION_GUIDES, guideCategories } from '../../config/documentationGuides';

const CATEGORY_ACCENT = {
  Buyers: spectrum.indigo,
  'Buyer POs': spectrum.emerald,
};

const categoryAccent = (name) => CATEGORY_ACCENT[name] || spectrum.cyan;

/** Left navigation — professional guide index for documentation. */
export default function DocumentationGuideNav({
  activeId,
  onSelect,
  stickyTop = 88,
  fillHeight = false,
}) {
  const theme = useTheme();
  const categories = guideCategories(DOCUMENTATION_GUIDES);

  let guideIndex = 0;

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
        boxShadow: `0 4px 24px ${alpha(slate[900], 0.06)}`,
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-thumb': {
          bgcolor: alpha(slate[400], 0.35),
          borderRadius: 999,
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 1.75,
          pt: 1.5,
          pb: 1.25,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(spectrum.indigo, 0.05)} 100%)`,
          borderBottom: `1px solid ${slate[200]}`,
        }}
      >
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
              color: 'primary.dark',
            }}
          >
            <MenuBook sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: '0.95rem',
                letterSpacing: '-0.02em',
                color: slate[900],
                lineHeight: 1.25,
              }}
            >
              Guide library
            </Typography>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.35 }}>
              <VideoLibrary sx={{ fontSize: 14, color: slate[500] }} />
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: slate[500] }}>
                {DOCUMENTATION_GUIDES.length} interactive walkthroughs
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* Categories + guides */}
      <Box sx={{ p: 1.5 }}>
        {categories.map((category, catIdx) => {
          const accent = categoryAccent(category);
          const guides = DOCUMENTATION_GUIDES.filter((g) => g.category === category);

          return (
            <Box key={category} sx={{ mb: catIdx < categories.length - 1 ? 2 : 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 0.75, mb: 1 }}>
                <Box
                  sx={{
                    width: 3,
                    height: 14,
                    borderRadius: 999,
                    bgcolor: accent,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: slate[600],
                  }}
                >
                  {category}
                </Typography>
              </Stack>

              <Stack spacing={0.75}>
                {guides.map((guide) => {
                  guideIndex += 1;
                  const step = guideIndex;
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
                        fontFamily: 'inherit',
                        outline: 'none',
                        p: 0,
                        borderRadius: 2,
                        bgcolor: selected ? alpha(theme.palette.primary.main, 0.07) : 'transparent',
                        boxShadow: selected
                          ? `inset 3px 0 0 0 ${theme.palette.primary.main}, 0 2px 8px ${alpha(theme.palette.primary.main, 0.08)}`
                          : 'none',
                        border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.28) : slate[200]}`,
                        transition: 'background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                        '&:hover': {
                          bgcolor: selected
                            ? alpha(theme.palette.primary.main, 0.09)
                            : alpha(slate[100], 0.8),
                          borderColor: selected
                            ? alpha(theme.palette.primary.main, 0.35)
                            : slate[300],
                        },
                      }}
                    >
                      <Stack direction="row" spacing={1.25} sx={{ p: 1.25, alignItems: 'flex-start' }}>
                        <Box
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: 1,
                            flexShrink: 0,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                            bgcolor: selected ? theme.palette.primary.main : alpha(accent, 0.12),
                            color: selected ? '#fff' : accent,
                            border: `1px solid ${selected ? theme.palette.primary.dark : alpha(accent, 0.25)}`,
                          }}
                        >
                          {String(step).padStart(2, '0')}
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={0.5}>
                            <Typography
                              sx={{
                                fontWeight: selected ? 800 : 700,
                                fontSize: '0.8125rem',
                                lineHeight: 1.4,
                                letterSpacing: '-0.015em',
                                color: selected ? slate[900] : slate[800],
                              }}
                            >
                              {guide.title}
                            </Typography>
                            <ChevronRight
                              sx={{
                                fontSize: 18,
                                mt: 0.1,
                                flexShrink: 0,
                                color: selected ? 'primary.main' : slate[400],
                                opacity: selected ? 1 : 0.6,
                              }}
                            />
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                            <PlayArrow sx={{ fontSize: 14, color: selected ? 'primary.main' : slate[400] }} />
                            <Typography
                              sx={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                color: selected ? 'primary.dark' : slate[400],
                              }}
                            >
                              Video guide
                            </Typography>
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>

              {catIdx < categories.length - 1 && (
                <Divider sx={{ mt: 2, borderColor: alpha(slate[200], 0.9) }} />
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
