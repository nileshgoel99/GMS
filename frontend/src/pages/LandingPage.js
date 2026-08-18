import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Container,
  Grid,
  Typography,
  Stack,
  useTheme,
  alpha,
  Paper,
  IconButton,
  Divider,
  Chip,
} from '@mui/material';
import {
  ContentCut,
  Inventory2,
  Assignment,
  Insights,
  ArrowForward,
  CheckCircleOutline,
  KeyboardArrowDown,
  PrecisionManufacturing,
  LocalShipping,
  Analytics,
  MenuBook,
  OpenInNew,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { slate, warm } from '../theme/appTheme';
import BrandLogo from '../components/BrandLogo';

/**
 * Keyframes for subtle floating and entrance animations
 */
const animationStyles = `
  @keyframes float {
    0% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(0.8deg); }
    100% { transform: translateY(0px) rotate(0deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideRight {
    from { transform: translateX(-40px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes pulseGlow {
    0% { box-shadow: 0 0 0 0 rgba(15, 118, 110, 0.5); }
    70% { box-shadow: 0 0 0 20px rgba(15, 118, 110, 0); }
    100% { box-shadow: 0 0 0 0 rgba(15, 118, 110, 0); }
  }
  @keyframes gradientText {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes scaleIn {
    from { transform: scale(0.9); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }
  @keyframes slideUp {
    from { transform: translateY(50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-fadeIn { animation: fadeIn 1s ease-out both; }
  .animate-spin-slow { animation: spinSlow 12s linear infinite; }
  .reveal { opacity: 0; transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1); transform: translateY(40px); }
  .reveal.active { opacity: 1; transform: translateY(0); }
  .hover-lift { transition: transform 0.3s ease, box-shadow 0.3s ease; }
  .hover-lift:hover { transform: translateY(-10px); }
`;

const FeatureCard = ({ icon, title, description, index, delay = 0 }) => {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 5,
        height: '100%',
        borderRadius: 5,
        background: '#fff',
        border: `1px solid ${slate[100]}`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
          opacity: 0,
          transition: 'opacity 0.3s ease',
        },
        '&:hover': {
          transform: 'translateY(-12px)',
          borderColor: slate[200],
          boxShadow: `0 30px 60px ${alpha(slate[950], 0.08)}`,
          '&::before': {
            opacity: 1,
          },
          '& .icon-wrapper': {
            transform: 'scale(1.1) rotate(5deg)',
            background: theme.palette.primary.main,
            color: '#fff',
            boxShadow: `0 10px 20px ${alpha(theme.palette.primary.main, 0.3)}`,
          },
          '& .feature-index': {
            opacity: 0.1,
            transform: 'scale(1.2)',
          }
        },
      }}
    >
      <Box
        className="feature-index"
        sx={{
          position: 'absolute',
          top: 20,
          right: 20,
          fontSize: '4rem',
          fontWeight: 900,
          color: slate[900],
          opacity: 0.03,
          lineHeight: 1,
          pointerEvents: 'none',
          transition: 'all 0.5s ease',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </Box>

      <Box
        className="icon-wrapper"
        sx={{
          width: 64,
          height: 64,
          borderRadius: 3,
          display: 'grid',
          placeItems: 'center',
          mb: 4,
          background: alpha(theme.palette.primary.main, 0.06),
          color: theme.palette.primary.main,
          transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {React.cloneElement(icon, { sx: { fontSize: 32 } })}
      </Box>

      <Typography 
        variant="h5" 
        sx={{ 
          mb: 2, 
          fontWeight: 800, 
          color: slate[900],
          fontSize: '1.25rem',
          letterSpacing: '-0.02em'
        }}
      >
        {title}
      </Typography>
      
      <Typography 
        variant="body1" 
        sx={{ 
          color: slate[500], 
          lineHeight: 1.8, 
          fontSize: '0.95rem',
          fontWeight: 500
        }}
      >
        {description}
      </Typography>
      
      <Box sx={{ flex: 1 }} />
      
      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography 
          variant="button" 
          sx={{ 
            fontSize: '0.7rem', 
            fontWeight: 800, 
            color: theme.palette.primary.main,
            letterSpacing: '0.1em',
            opacity: 0.8
          }}
        >
          Learn More
        </Typography>
        <ArrowForward sx={{ fontSize: 14, color: theme.palette.primary.main, opacity: 0.8 }} />
      </Box>
    </Paper>
  );
};

export default function LandingPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      
      const reveals = document.querySelectorAll('.reveal');
      reveals.forEach(reveal => {
        const windowHeight = window.innerHeight;
        const revealTop = reveal.getBoundingClientRect().top;
        const revealPoint = 150;
        if (revealTop < windowHeight - revealPoint) {
          reveal.classList.add('active');
        }
      });
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: <Assignment fontSize="large" />,
      title: 'Order Tracking',
      description: 'Centralize every Buyer PO. Link Proforma Invoices directly to shop-floor requirements with zero data leakage.',
    },
    {
      icon: <PrecisionManufacturing fontSize="large" />,
      title: 'Production Control',
      description: 'From cutting to finishing. Manage your assembly line with real-time status updates and bottleneck identification.',
    },
    {
      icon: <ContentCut fontSize="large" />,
      title: 'Fabric Intelligence',
      description: 'Stop guessing roll balances. Our smart registry tracks every meter, accounting for shrinkage, waste, and rejects.',
    },
    {
      icon: <Inventory2 fontSize="large" />,
      title: 'Trim & Material',
      description: 'Never stall a line. Real-time inventory for thread, buttons, and fabric with automated procurement alerts.',
    },
    {
      icon: <LocalShipping fontSize="large" />,
      title: 'Logistics Flow',
      description: 'Streamline your shipping and purchase entries. Connect supply chain receipts directly to your production needs.',
    },
    {
      icon: <Analytics fontSize="large" />,
      title: 'Dynamic Reporting',
      description: 'Live performance metrics. Track efficiency, variance, and margins across every style and customer.',
    },
  ];

  return (
    <Box sx={{ bgcolor: warm.canvas, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{animationStyles}</style>

      {/* Navbar */}
      <Box
        component="nav"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          transition: 'all 0.3s ease',
          py: scrolled ? 1.25 : 2,
          px: { xs: 2, md: 6 },
          background: scrolled
            ? 'rgba(255, 255, 255, 0.9)'
            : 'rgba(255, 252, 247, 0.78)',
          backdropFilter: 'blur(18px)',
          borderBottom: `1px solid ${scrolled ? slate[200] : alpha(slate[200], 0.7)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => window.scrollTo(0, 0)}>
          <BrandLogo variant="lockup" tone="light" size={40} />
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            component="a"
            href="https://jbi.fabriflow.in/documentation"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              fontWeight: 700,
              color: slate[600],
              fontSize: '0.9rem',
              display: { xs: 'none', md: 'inline-flex' },
              '&:hover': { color: theme.palette.primary.main }
            }}
          >
            Docs
          </Button>
          <Button
            onClick={() => navigate('/login')}
            sx={{
              fontWeight: 700,
              color: slate[700],
              '&:hover': { color: theme.palette.primary.main }
            }}
          >
            Sign In
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate('/login')}
            sx={{
              px: 3,
              borderRadius: 3,
              fontWeight: 800,
              animation: !scrolled ? 'pulseGlow 2s infinite' : 'none',
            }}
          >
            Get Started
          </Button>
        </Stack>
      </Box>

      {/* Hero Section */}
      <Box
        sx={{
          pt: { xs: 15, md: 22 },
          pb: { xs: 10, md: 15 },
          position: 'relative',
          overflow: 'hidden',
          background: `radial-gradient(circle at 0% 0%, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 50%), radial-gradient(circle at 100% 100%, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%)`,
        }}
      >
        {/* Subtle grid pattern */}
        <Box sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.4,
          backgroundSize: '40px 40px',
          backgroundImage: `linear-gradient(to right, ${slate[100]} 1px, transparent 1px), linear-gradient(to bottom, ${slate[100]} 1px, transparent 1px)`,
          maskImage: 'radial-gradient(ellipse at center, black, transparent 80%)',
          zIndex: 0,
        }} />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography
                  component="span"
                  sx={{
                    display: 'inline-block',
                    px: 2.5,
                    py: 1,
                    borderRadius: 5,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    mb: 4,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                    animation: 'slideRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
                  }}
                >
                  The Next Generation Garment ERP
                </Typography>
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '3rem', md: '5.5rem' },
                    fontWeight: 900,
                    lineHeight: 1.05,
                    mb: 4,
                    color: slate[950],
                    letterSpacing: '-0.06em',
                    animation: 'slideRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
                  }}
                >
                  Garment <br />Production, <br />
                  <Box 
                    component="span" 
                    sx={{ 
                      background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: 'gradientText 4s linear infinite',
                    }}
                  >
                    Perfectly Balanced.
                  </Box>
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: slate[600],
                    mb: 6,
                    fontWeight: 500,
                    lineHeight: 1.7,
                    maxWidth: 580,
                    fontSize: '1.25rem',
                    animation: 'slideRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both',
                  }}
                >
                  From indent planning to the cutting floor. WeaveCore brings precision,
                  visibility, and intelligence to your garment manufacturing process.
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={3}
                  sx={{ animation: 'slideRight 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both' }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    endIcon={<ArrowForward />}
                    onClick={() => navigate('/login')}
                    sx={{
                      py: 2.5,
                      px: 5,
                      borderRadius: 4,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.4)}`,
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: `0 25px 50px ${alpha(theme.palette.primary.main, 0.5)}`,
                      }
                    }}
                  >
                    Start Production
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => {
                      document.getElementById('features').scrollIntoView({ behavior: 'smooth' });
                    }}
                    sx={{
                      py: 2.5,
                      px: 5,
                      borderRadius: 4,
                      fontSize: '1.1rem',
                      fontWeight: 800,
                      borderColor: slate[300],
                      color: slate[800],
                      bgcolor: 'rgba(255,255,255,0.4)',
                      backdropFilter: 'blur(10px)',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        bgcolor: 'rgba(255,255,255,0.8)',
                        transform: 'translateY(-4px)',
                      }
                    }}
                  >
                    Explore Features
                  </Button>
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box
                sx={{
                  position: 'relative',
                  animation: 'float 6s ease-in-out infinite',
                }}
              >
                {/* Visual Representation of App UI */}
                {/* Browser Shadow Background */}
                <Box sx={{
                  position: 'absolute',
                  inset: '20px -20px -20px 20px',
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  borderRadius: 4,
                  zIndex: 1,
                  filter: 'blur(40px)',
                }} />

                <Paper
                  elevation={0}
                  sx={{
                    width: '125%',
                    height: 540,
                    borderRadius: 5,
                    overflow: 'hidden',
                    border: `1px solid ${slate[200]}`,
                    background: '#fff',
                    ml: -10,
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: `0 30px 60px ${alpha(slate[950], 0.12)}, 0 10px 20px ${alpha(slate[950], 0.05)}`,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  {/* Browser Header */}
                  <Box sx={{ 
                    height: 54, 
                    bgcolor: '#fff', 
                    borderBottom: `1px solid ${slate[100]}`, 
                    px: 2.5, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2 
                  }}>
                    <Stack direction="row" spacing={1}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FF5F57' }} />
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#FFBC2E' }} />
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#28C840' }} />
                    </Stack>
                    <Box sx={{ 
                      flex: 1, 
                      mx: 2, 
                      height: 32, 
                      bgcolor: slate[50], 
                      borderRadius: 2, 
                      display: 'flex',
                      alignItems: 'center',
                      px: 2,
                      border: `1px solid ${slate[100]}`
                    }}>
                      <Typography sx={{ fontSize: '0.7rem', color: slate[400], fontWeight: 600, letterSpacing: '0.02em' }}>
                        app.weavecore.in/cutting/R-4029
                      </Typography>
                    </Box>
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: slate[100] }} />
                  </Box>

                  <Box sx={{ flex: 1, display: 'flex' }}>
                    {/* Left Sidebar Nav */}
                    <Box sx={{ width: 72, bgcolor: '#111827', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 4 }}>
                      <BrandLogo variant="mark" tone="dark" size={40} />
                      {[Assignment, ContentCut, Inventory2, LocalShipping, Analytics].map((Icon, i) => (
                        <Icon key={i} sx={{ color: i === 1 ? theme.palette.primary.light : alpha('#fff', 0.3), fontSize: 22, cursor: 'pointer', transition: 'color 0.2s', '&:hover': { color: '#fff' } }} />
                      ))}
                    </Box>

                    {/* Main Interface Content */}
                    <Box sx={{ flex: 1, p: 4, bgcolor: '#fdfdfd', overflow: 'hidden' }}>
                      <Stack spacing={4}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                          <Box>
                             <Typography variant="overline" sx={{ color: theme.palette.primary.main, fontWeight: 800, letterSpacing: '0.1em' }}>Production Unit 01</Typography>
                             <Typography variant="h5" sx={{ fontWeight: 900, color: slate[900] }}>Cutting Floor Control</Typography>
                          </Box>
                          <Stack direction="row" spacing={1}>
                             <Box sx={{ width: 80, height: 32, borderRadius: 2, bgcolor: slate[100] }} />
                             <Box sx={{ width: 32, height: 32, borderRadius: 2, bgcolor: theme.palette.primary.main, display: 'grid', placeItems: 'center' }}>
                                <ArrowForward sx={{ color: '#fff', fontSize: 16 }} />
                             </Box>
                          </Stack>
                        </Box>

                        {/* Top Stats Cards */}
                        <Grid container spacing={3}>
                          {[
                            { l: 'Efficiency', v: '94.2%', c: theme.palette.success.main, i: <Insights fontSize="small" /> },
                            { l: 'Avg. Waste', v: '1.4%', c: theme.palette.primary.main, i: <ContentCut fontSize="small" /> },
                            { l: 'Active Rolls', v: '18', c: theme.palette.warning.main, i: <Inventory2 fontSize="small" /> }
                          ].map((stat, i) => (
                            <Grid item xs={4} key={i}>
                              <Box sx={{ 
                                p: 2.5, bgcolor: '#fff', borderRadius: 4, 
                                border: `1px solid ${slate[100]}`, 
                                boxShadow: `0 10px 20px ${alpha(slate[950], 0.02)}`,
                                position: 'relative', overflow: 'hidden'
                              }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                   <Box sx={{ color: stat.c, display: 'flex' }}>{stat.i}</Box>
                                   <Typography variant="caption" sx={{ fontWeight: 700, color: slate[400] }}>{stat.l}</Typography>
                                </Box>
                                <Typography variant="h5" sx={{ fontWeight: 900, color: slate[900] }}>{stat.v}</Typography>
                                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, bgcolor: alpha(stat.c, 0.1) }}>
                                   <Box sx={{ width: '70%', height: '100%', bgcolor: stat.c }} />
                                </Box>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>

                        {/* Style List Mockup */}
                        <Box sx={{ p: 3, bgcolor: '#fff', borderRadius: 5, border: `1px solid ${slate[100]}`, flex: 1 }}>
                          <Typography variant="caption" sx={{ fontWeight: 800, color: slate[400], mb: 2.5, display: 'block', textTransform: 'uppercase' }}>Recent Cutting Orders</Typography>
                          <Stack spacing={2.5}>
                            {[
                              { s: 'Style #4029', c: 'Deep Navy', p: '850 pcs', q: 'In Progress' },
                              { s: 'Style #4032', c: 'Emerald Silk', p: '1,200 pcs', q: 'Completed' },
                              { s: 'Style #4018', c: 'White Cotton', p: '450 pcs', q: 'Queued' }
                            ].map((row, i) => (
                              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                <Box sx={{ width: 44, height: 44, borderRadius: 3, bgcolor: i === 1 ? alpha(theme.palette.success.main, 0.1) : slate[50], display: 'grid', placeItems: 'center' }}>
                                   <Box sx={{ width: 20, height: 20, borderRadius: 1, bgcolor: i === 0 ? '#1e1b4b' : i === 1 ? '#059669' : '#e2e8f0', border: '1px solid rgba(0,0,0,0.1)' }} />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: slate[800] }}>{row.s}</Typography>
                                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: slate[400] }}>{row.c} • {row.p}</Typography>
                                </Box>
                                <Chip label={row.q} size="small" sx={{ 
                                  height: 22, fontSize: '0.65rem', fontWeight: 800,
                                  bgcolor: row.q === 'Completed' ? alpha(theme.palette.success.main, 0.1) : row.q === 'In Progress' ? alpha(theme.palette.primary.main, 0.1) : slate[100],
                                  color: row.q === 'Completed' ? theme.palette.success.main : row.q === 'In Progress' ? theme.palette.primary.main : slate[500],
                                  border: 'none'
                                }} />
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      </Stack>
                    </Box>
                  </Box>
                </Paper>
                {/* Decorative floating elements */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: -30,
                    right: -40,
                    bgcolor: '#fff',
                    p: 2,
                    borderRadius: 4,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                    border: `1px solid ${slate[100]}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    zIndex: 3,
                    animation: 'float 5s ease-in-out infinite',
                  }}
                >
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.1), display: 'grid', placeItems: 'center' }}>
                    <CheckCircleOutline sx={{ color: theme.palette.success.main }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: slate[800] }}>Roll Verified</Typography>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: slate[400] }}>R-4029 • 55.4m</Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 40,
                    left: -60,
                    bgcolor: slate[900],
                    p: 2,
                    borderRadius: 4,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    zIndex: 3,
                    animation: 'float 6s ease-in-out infinite reverse',
                  }}
                >
                  <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.2), display: 'grid', placeItems: 'center' }}>
                    <ContentCut sx={{ color: theme.palette.primary.light }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#fff' }}>Cutting Active</Typography>
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 600, color: alpha('#fff', 0.5) }}>Unit 01 • Lay #12</Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>

        <Box sx={{ textAlign: 'center', mt: 8, animation: 'float 3s ease-in-out infinite' }}>
          <IconButton onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}>
            <KeyboardArrowDown sx={{ fontSize: 40, color: slate[400] }} />
          </IconButton>
        </Box>
      </Box>

      {/* Features Grid */}
      <Box 
        id="features" 
        sx={{ 
          py: { xs: 15, md: 25 }, 
          position: 'relative',
          bgcolor: '#fdfdfd',
        }}
      >
        {/* Section Decorative Elements */}
        <Box sx={{
          position: 'absolute',
          top: '10%',
          left: '5%',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.03)} 0%, transparent 70%)`,
          zIndex: 0,
        }} />
        
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'left', mb: 12 }} className="reveal">
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Box sx={{ width: 40, height: 2, bgcolor: theme.palette.primary.main }} />
              <Typography variant="overline" sx={{ color: theme.palette.primary.main, fontWeight: 900, letterSpacing: '0.2em' }}>
                Capabilities
              </Typography>
            </Stack>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 900,
                mb: 4,
                fontSize: { xs: '2.5rem', md: '4.5rem' },
                letterSpacing: '-0.05em',
                color: slate[950],
                maxWidth: 900,
                lineHeight: 1,
              }}
            >
              Engineered for the Modern <br />
              <Box 
                component="span" 
                sx={{ 
                  color: theme.palette.primary.main,
                  position: 'relative',
                  display: 'inline-block',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    bottom: 10,
                    left: 0,
                    right: 0,
                    height: 8,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    zIndex: -1,
                  }
                }}
              >
                Garment Lifecycle.
              </Box>
            </Typography>
            <Typography variant="h6" sx={{ color: slate[500], maxWidth: 650, fontWeight: 500, fontSize: '1.2rem', lineHeight: 1.6 }}>
              Say goodbye to fragmented spreadsheets. WeaveCore integrates every stage of 
              production into a single, high-precision intelligence layer.
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((f, i) => (
              <Grid item xs={12} sm={6} md={4} key={i} className="reveal">
                <FeatureCard {...f} index={i} delay={i * 0.1} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Industrial Detail Section */}
      <Box sx={{ py: 25, bgcolor: alpha(theme.palette.primary.main, 0.04), borderY: `1px solid ${slate[200]}`, position: 'relative', overflow: 'hidden' }}>
        <Box 
          sx={{ 
            position: 'absolute', 
            top: '10%', 
            left: '-5%', 
            width: '40%', 
            height: '80%', 
            background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 70%)`,
            zIndex: 0 
          }} 
        />
        <Box
          sx={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 400,
            height: 400,
            borderRadius: '50%',
            border: `1px dashed ${alpha(theme.palette.primary.main, 0.1)}`,
            animation: 'spinSlow 20s linear infinite',
            zIndex: 0,
          }}
        />
        <Container maxWidth="lg">
          <Grid container spacing={10} alignItems="center">
            <Grid item xs={12} md={6} className="reveal">
              <Typography variant="h3" sx={{ fontWeight: 900, mb: 4, fontSize: { xs: '2.2rem', md: '3.5rem' }, letterSpacing: '-0.04em' }}>
                Precision Fabric <br />Management
              </Typography>
              <Stack spacing={4}>
                {[
                  { t: 'Automatic roll balance carry-forward', d: 'Eliminate manual calculation errors on the floor.', i: <ContentCut /> },
                  { t: 'Reject and waste tracking per cutting', d: 'Keep a clean ledger of every single centimeter.', i: <PrecisionManufacturing /> },
                  { t: 'Supplier PI to Indent material matching', d: 'Seamless flow from procurement to end-use.', i: <Assignment /> },
                  { t: 'Size-wise cutting history and references', d: 'Trace every garment back to the specific roll.', i: <LocalShipping /> }
                ].map((item, i) => (
                  <Stack key={i} direction="row" spacing={3} alignItems="flex-start">
                    <Box sx={{ 
                      p: 1.5, 
                      borderRadius: 2, 
                      bgcolor: '#fff', 
                      boxShadow: `0 4px 12px ${alpha(slate[900], 0.05)}`,
                      color: theme.palette.primary.main,
                      display: 'flex'
                    }}>
                      {item.i}
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: slate[900], mb: 0.5 }}>{item.t}</Typography>
                      <Typography variant="body2" sx={{ color: slate[600], fontWeight: 500, fontSize: '1rem' }}>{item.d}</Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/login')}
                sx={{ mt: 6, py: 2.5, px: 6, borderRadius: 4, fontWeight: 900, fontSize: '1.1rem' }}
              >
                Explore Modules
              </Button>
            </Grid>
            <Grid item xs={12} md={6} className="reveal" style={{ transitionDelay: '0.3s' }}>
               <Box
                sx={{
                  p: 2,
                  borderRadius: 6,
                  bgcolor: '#fff',
                  boxShadow: `0 30px 60px ${alpha(slate[900], 0.08)}`,
                  border: `1px solid ${slate[200]}`,
                  transform: 'perspective(1000px) rotateY(-5deg) rotateX(5deg)',
                  transition: 'all 0.5s ease',
                  '&:hover': {
                    transform: 'perspective(1000px) rotateY(0deg) rotateX(0deg)',
                  }
                }}
              >
                <Box
                  sx={{
                    height: 450,
                    borderRadius: 4,
                    bgcolor: slate[50],
                    backgroundImage: `
                      repeating-linear-gradient(-11deg, ${alpha(slate[800], 0.015)} 0px, ${alpha(slate[800], 0.015)} 1px, transparent 1px, transparent 6px),
                      radial-gradient(circle at 1px 1px, ${alpha(slate[600], 0.05)} 1px, transparent 0)
                    `,
                    backgroundSize: 'auto, 20px 20px',
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                  }}
                >
                  <Box sx={{ 
                    position: 'absolute', 
                    top: 20, 
                    left: 20, 
                    px: 2, py: 1, 
                    bgcolor: theme.palette.primary.main, 
                    color: '#fff', 
                    borderRadius: 2,
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    letterSpacing: '0.1em'
                  }}>
                    SYSTEM_CORE_V4
                  </Box>
                  <Box sx={{ textAlign: 'center' }}>
                    <Insights sx={{ fontSize: 80, color: theme.palette.primary.main, mb: 3, opacity: 0.8 }} />
                    <Typography variant="h4" sx={{ fontWeight: 900, color: slate[800], mb: 1 }}>Live Plant Data</Typography>
                    <Typography sx={{ color: slate[500], fontWeight: 500 }}>Real-time synchronization across all departments</Typography>
                  </Box>
                  
                  <Grid container spacing={2} sx={{ mt: 5 }}>
                    {[85, 92, 74].map((val, i) => (
                      <Grid item xs={4} key={i}>
                        <Box sx={{ textAlign: 'center', p: 2, bgcolor: '#fff', borderRadius: 3, border: `1px solid ${slate[100]}` }}>
                          <Typography variant="h5" sx={{ fontWeight: 900, color: theme.palette.primary.main }}>{val}%</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: slate[400] }}>METRIC_0{i+1}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>
      {/* Documentation Highlight Section */}
      <Box sx={{ py: 15, bgcolor: slate[950], position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ 
          position: 'absolute', 
          inset: 0, 
          opacity: 0.1, 
          backgroundImage: `radial-gradient(${theme.palette.primary.main} 1px, transparent 1px)`, 
          backgroundSize: '30px 30px' 
        }} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.2), color: theme.palette.primary.light, display: 'flex' }}>
                  <MenuBook />
                </Box>
                <Typography variant="overline" sx={{ color: theme.palette.primary.light, fontWeight: 900, letterSpacing: '0.2em' }}>
                  System Intelligence
                </Typography>
              </Stack>
              <Typography variant="h3" sx={{ color: '#fff', fontWeight: 900, mb: 3, fontSize: { xs: '2rem', md: '3.5rem' }, letterSpacing: '-0.04em' }}>
                The Operational <br />
                <Box component="span" sx={{ color: theme.palette.primary.light }}>Blueprint.</Box>
              </Typography>
              <Typography sx={{ color: alpha('#fff', 0.6), mb: 5, fontSize: '1.2rem', fontWeight: 500, lineHeight: 1.6, maxWidth: 600 }}>
                Everything you need to master WeaveCore. From API integrations to 
                advanced roll management protocols—it's all in the playbook.
              </Typography>
              <Button
                variant="outlined"
                size="large"
                component="a"
                href="https://jbi.fabriflow.in/documentation"
                target="_blank"
                rel="noopener noreferrer"
                endIcon={<OpenInNew />}
                sx={{
                  py: 2, px: 5,
                  borderRadius: 4,
                  fontWeight: 800,
                  color: '#fff',
                  borderColor: alpha('#fff', 0.2),
                  '&:hover': {
                    borderColor: theme.palette.primary.light,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  }
                }}
              >
                Read the Docs
              </Button>
            </Grid>
            <Grid item xs={12} md={5} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Box sx={{ 
                p: 4, 
                bgcolor: alpha('#fff', 0.03), 
                borderRadius: 6, 
                border: `1px solid ${alpha('#fff', 0.1)}`,
                backdropFilter: 'blur(10px)'
              }}>
                <Stack spacing={3}>
                   {[
                     { t: 'Integration Guides', d: 'Connect your existing ERP/PLM data.' },
                     { t: 'Process Protocols', d: 'Standard operating procedures for cutting.' },
                     { t: 'API Reference', d: 'Build custom automations on our core.' }
                   ].map((item, i) => (
                     <Box key={i} sx={{ p: 2, borderRadius: 3, bgcolor: alpha('#fff', 0.02), border: `1px solid ${alpha('#fff', 0.05)}` }}>
                       <Typography sx={{ color: theme.palette.primary.light, fontWeight: 800, fontSize: '0.9rem', mb: 0.5 }}>{item.t}</Typography>
                       <Typography sx={{ color: alpha('#fff', 0.4), fontSize: '0.8rem', fontWeight: 500 }}>{item.d}</Typography>
                     </Box>
                   ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Final CTA */}
      <Box sx={{ py: 20, textAlign: 'center' }}>
        <Container maxWidth="sm" className="reveal">
          <Typography variant="h2" sx={{ fontWeight: 900, mb: 3, fontSize: { xs: '2.5rem', md: '4rem' }, letterSpacing: '-0.04em', color: slate[950] }}>
            Ready to streamline?
          </Typography>
          <Typography variant="h6" sx={{ color: slate[600], mb: 6, fontWeight: 500, fontSize: '1.25rem' }}>
            Join the production houses managing their entire flow with WeaveCore.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/login')}
            sx={{
              py: 2.5,
              px: 8,
              borderRadius: 5,
              fontSize: '1.2rem',
              fontWeight: 900,
              boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: `0 25px 50px ${alpha(theme.palette.primary.main, 0.4)}`,
              }
            }}
          >
            Access Dashboard
          </Button>
        </Container>
      </Box>

      {/* Footer */}
      <Box sx={{ py: 6, borderTop: `1px solid ${slate[200]}`, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: slate[500], fontWeight: 500 }}>
          © {new Date().getFullYear()} WeaveCore Garment Production Suite. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}
