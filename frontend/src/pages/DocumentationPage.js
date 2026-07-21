import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
  useMediaQuery,
  MenuItem,
  TextField,
  Divider,
} from '@mui/material';
import { PlayCircleOutline } from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import PageHeader from '../components/PageHeader';
import DocumentationGuideNav from '../components/documentation/DocumentationGuideNav';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import {
  DOCUMENTATION_GUIDES,
  guidesInCategoryOrder,
} from '../config/documentationGuides';

const orderedGuides = () => guidesInCategoryOrder(DOCUMENTATION_GUIDES);

const VideoEmbed = ({ src, title, fill = false }) => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      borderRadius: 2,
      overflow: 'hidden',
      border: `1px solid ${slate[200]}`,
      bgcolor: '#0f172a',
      ...(fill
        ? {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }
        : {
            aspectRatio: '16 / 9',
            minHeight: { xs: 220, sm: 280 },
          }),
    }}
  >
    <Box
      component="iframe"
      src={src}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      sx={{
        display: 'block',
        width: '100%',
        border: 0,
        ...(fill
          ? {
              flex: 1,
              minHeight: { xs: 360, md: 420 },
              height: '100%',
            }
          : {
              height: '100%',
              minHeight: { xs: 220, sm: 280 },
            }),
      }}
    />
  </Box>
);

export default function DocumentationPage({ viewportOffset = 200 }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const guides = useMemo(() => orderedGuides(), []);
  const [activeId, setActiveId] = useState(guides[0]?.id || '');

  const activeGuide = useMemo(
    () => guides.find((g) => g.id === activeId) || guides[0],
    [activeId, guides],
  );

  const activeStep = useMemo(() => {
    const idx = guides.findIndex((g) => g.id === activeGuide?.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [guides, activeGuide]);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && guides.some((g) => g.id === hash)) {
      setActiveId(hash);
    }
  }, [guides]);

  const selectGuide = (id) => {
    setActiveId(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: { md: `calc(100dvh - ${viewportOffset}px)` },
        maxHeight: { md: `calc(100dvh - ${viewportOffset}px)` },
      }}
    >
      <PageHeader
        kicker="Help"
        title="Documentation"
        subtitle="Watch short videos in workflow order: Buyers → Buyers PO → Indents → Suppliers → Procurement → Users"
        compact
      />

      {isMobile && (
        <TextField
          select
          fullWidth
          size="small"
          label="Choose a guide"
          value={activeGuide?.id || ''}
          onChange={(e) => selectGuide(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' },
            '& .MuiInputLabel-root': { fontWeight: 600 },
          }}
        >
          {guides.map((guide, i) => (
            <MenuItem key={guide.id} value={guide.id} sx={{ py: 1.25, alignItems: 'flex-start' }}>
              <Stack spacing={0.25}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'primary.main', letterSpacing: '0.06em' }}>
                  {String(i + 1).padStart(2, '0')} · {guide.category.toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: '0.84rem', fontWeight: 700 }}>{guide.title}</Typography>
              </Stack>
            </MenuItem>
          ))}
        </TextField>
      )}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 320px) 1fr' },
          gap: { xs: 1.5, md: 2 },
          alignItems: 'stretch',
          mt: { xs: 0, md: 0.5 },
        }}
      >
        {!isMobile && (
          <DocumentationGuideNav
            activeId={activeGuide?.id}
            onSelect={selectGuide}
            fillHeight
          />
        )}

        <Paper
          elevation={0}
          sx={{
            ...sectionPaperSxByIndex(1),
            p: { xs: 1.5, sm: 2 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {activeGuide && (
            <>
              <Box sx={{ flexShrink: 0, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
                  <Chip
                    label={`Guide ${activeStep} of ${guides.length}`}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      fontSize: '0.68rem',
                      height: 24,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.dark',
                    }}
                  />
                  <Chip
                    label={activeGuide.category}
                    size="small"
                    variant="outlined"
                    color="primary"
                    sx={{ fontWeight: 700, fontSize: '0.7rem', height: 24 }}
                  />
                </Stack>
                <Typography
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '1.05rem', sm: '1.2rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.3,
                    color: slate[900],
                  }}
                >
                  {activeGuide.title}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.75,
                    fontSize: '0.875rem',
                    lineHeight: 1.55,
                    color: slate[600],
                    maxWidth: 640,
                  }}
                >
                  {activeGuide.description}
                </Typography>
              </Box>

              <Divider sx={{ mb: 1.5, borderColor: slate[200], flexShrink: 0 }} />

              <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1, flexShrink: 0 }}>
                <PlayCircleOutline sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: slate[500], letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Watch the video
                </Typography>
              </Stack>

              <VideoEmbed
                src={activeGuide.embedUrl}
                title={activeGuide.title}
                fill={!isMobile}
              />
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
