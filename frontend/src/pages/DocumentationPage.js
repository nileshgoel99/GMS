import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Stack,
  useMediaQuery,
  MenuItem,
  TextField,
} from '@mui/material';
import { MenuBook, PlayCircleOutline } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import PageHeader from '../components/PageHeader';
import { slate, sectionPaperSxByIndex } from '../theme/appTheme';
import { DOCUMENTATION_GUIDES, guideCategories } from '../config/documentationGuides';

const ScribeEmbed = ({ src, title }) => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      borderRadius: 2,
      overflow: 'hidden',
      border: `1px solid ${slate[200]}`,
      bgcolor: slate[50],
      minHeight: { xs: 360, sm: 480, md: 560 },
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
        height: { xs: 420, sm: 520, md: 640, lg: 720 },
        minHeight: 480,
        border: 0,
        aspectRatio: '16 / 12',
      }}
    />
  </Box>
);

export default function DocumentationPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [activeId, setActiveId] = useState(DOCUMENTATION_GUIDES[0]?.id || '');

  const activeGuide = useMemo(
    () => DOCUMENTATION_GUIDES.find((g) => g.id === activeId) || DOCUMENTATION_GUIDES[0],
    [activeId],
  );

  const categories = useMemo(() => guideCategories(DOCUMENTATION_GUIDES), []);

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

  const guideList = (
    <List disablePadding dense={isMobile}>
      {categories.map((category) => (
        <Box key={category} sx={{ mb: 1.5 }}>
          <Typography
            sx={{
              px: 1.25,
              py: 0.5,
              fontSize: '0.62rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: slate[500],
            }}
          >
            {category}
          </Typography>
          {DOCUMENTATION_GUIDES.filter((g) => g.category === category).map((guide) => {
            const selected = guide.id === activeGuide?.id;
            return (
              <ListItemButton
                key={guide.id}
                selected={selected}
                onClick={() => selectGuide(guide.id)}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.35,
                  py: 1.1,
                  px: 1.25,
                  alignItems: 'flex-start',
                  border: `1px solid ${selected ? alpha(theme.palette.primary.main, 0.35) : 'transparent'}`,
                  bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                  },
                }}
              >
                <PlayCircleOutline
                  sx={{
                    fontSize: 20,
                    mr: 1.25,
                    mt: 0.15,
                    color: selected ? 'primary.main' : slate[400],
                    flexShrink: 0,
                  }}
                />
                <ListItemText
                  primary={guide.title}
                  secondary={guide.description}
                  primaryTypographyProps={{
                    fontSize: '0.82rem',
                    fontWeight: selected ? 700 : 600,
                    lineHeight: 1.35,
                    color: selected ? slate[900] : slate[700],
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.72rem',
                    lineHeight: 1.4,
                    mt: 0.35,
                  }}
                />
              </ListItemButton>
            );
          })}
        </Box>
      ))}
    </List>
  );

  return (
    <Box>
      <PageHeader
        kicker="Help"
        title="Documentation"
        subtitle="Video walkthroughs and step-by-step guides for everyday tasks in GMS."
        compact
      />

      {isMobile && (
        <TextField
          select
          fullWidth
          size="small"
          label="Select guide"
          value={activeGuide?.id || ''}
          onChange={(e) => selectGuide(e.target.value)}
          sx={{ mb: 2 }}
        >
          {DOCUMENTATION_GUIDES.map((guide) => (
            <MenuItem key={guide.id} value={guide.id}>
              {guide.title}
            </MenuItem>
          ))}
        </TextField>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(260px, 320px) 1fr' },
          gap: { xs: 2, md: 2.5 },
          alignItems: 'start',
        }}
      >
        {!isMobile && (
          <Paper
            elevation={0}
            sx={{
              ...sectionPaperSxByIndex(0),
              p: 1.25,
              position: 'sticky',
              top: 88,
              maxHeight: 'calc(100vh - 120px)',
              overflowY: 'auto',
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 0.75, mb: 1.25 }}>
              <MenuBook sx={{ fontSize: 20, color: 'primary.main' }} />
              <Typography variant="subtitle2" fontWeight={800}>
                Guides
              </Typography>
              <Chip label={DOCUMENTATION_GUIDES.length} size="small" sx={{ ml: 'auto', fontWeight: 700 }} />
            </Stack>
            {guideList}
          </Paper>
        )}

        <Paper elevation={0} sx={{ ...sectionPaperSxByIndex(1), p: { xs: 1.5, sm: 2 } }}>
          {activeGuide && (
            <>
              <Stack
                direction="row"
                flexWrap="wrap"
                spacing={1}
                alignItems="center"
                sx={{ mb: 1.5, gap: 1 }}
              >
                <Chip label={activeGuide.category} size="small" color="primary" variant="outlined" />
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Interactive video guide
                </Typography>
              </Stack>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 0.75, lineHeight: 1.35 }}>
                {activeGuide.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 720 }}>
                {activeGuide.description}
              </Typography>
              <ScribeEmbed src={activeGuide.embedUrl} title={activeGuide.title} />
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
