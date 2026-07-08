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
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PageHeader from '../components/PageHeader';
import DocumentationGuideNav from '../components/documentation/DocumentationGuideNav';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import { DOCUMENTATION_GUIDES } from '../config/documentationGuides';

const ScribeEmbed = ({ src, title, fill = false }) => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      borderRadius: 2,
      overflow: 'hidden',
      border: `1px solid ${slate[200]}`,
      bgcolor: slate[50],
      ...(fill
        ? {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }
        : {
            minHeight: { xs: 360, sm: 420 },
          }),
    }}
  >
    <Box
      component="iframe"
      src={src}
      title={title}
      allow="fullscreen"
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
              height: { xs: 400, sm: 480 },
            }),
      }}
    />
  </Box>
);

export default function DocumentationPage({ viewportOffset = 200 }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeId, setActiveId] = useState(DOCUMENTATION_GUIDES[0]?.id || '');

  const activeGuide = useMemo(
    () => DOCUMENTATION_GUIDES.find((g) => g.id === activeId) || DOCUMENTATION_GUIDES[0],
    [activeId],
  );

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && DOCUMENTATION_GUIDES.some((g) => g.id === hash)) {
      setActiveId(hash);
    }
  }, []);

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
      <PageHeader kicker="Help" title="Documentation" compact />

      {isMobile && (
        <TextField
          select
          fullWidth
          size="small"
          label="Select guide"
          value={activeGuide?.id || ''}
          onChange={(e) => selectGuide(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#fff' },
            '& .MuiInputLabel-root': { fontWeight: 600 },
          }}
        >
          {DOCUMENTATION_GUIDES.map((guide, i) => (
            <MenuItem key={guide.id} value={guide.id} sx={{ py: 1.25 }}>
              <Stack spacing={0.25}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: 'primary.main', letterSpacing: '0.06em' }}>
                  GUIDE {String(i + 1).padStart(2, '0')} · {guide.category.toUpperCase()}
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
          gridTemplateColumns: { xs: '1fr', md: 'minmax(272px, 300px) 1fr' },
          gap: { xs: 1.5, md: 2 },
          alignItems: 'stretch',
          mt: { xs: 0, md: 1 },
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
            p: { xs: 1.25, sm: 1.5 },
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {activeGuide && (
            <>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1, flexShrink: 0, minWidth: 0, gap: 1 }}
              >
                <Chip
                  label={activeGuide.category}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ fontWeight: 700, fontSize: '0.7rem', height: 24, flexShrink: 0 }}
                />
                <Typography
                  variant="subtitle2"
                  fontWeight={800}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    lineHeight: 1.3,
                    letterSpacing: '-0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeGuide.title}
                </Typography>
              </Stack>
              {isMobile && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1.25, lineHeight: 1.5, flexShrink: 0 }}
                >
                  {activeGuide.description}
                </Typography>
              )}
              <ScribeEmbed
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
