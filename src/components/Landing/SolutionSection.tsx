import React from 'react';
import { Typography, Grid, Box, useTheme, Button } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import SectionWrapper from './SectionWrapper';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

const SolutionSection: React.FC = () => {
  const theme = useTheme();

  return (
    <SectionWrapper bgcolor="background.paper" sx={{ overflowX: 'clip' }}>
      <Grid container spacing={8} alignItems="center">
        <Grid item xs={12} md={6}>
          <Box sx={{ position: 'relative' }}>
            <Box 
              component="img"
              src="/images/home/home.jpg"
              alt="VisualFeast AI Solution"
              sx={{ 
                width: '100%', 
                borderRadius: 4, 
                boxShadow: '0 30px 60px rgba(0,0,0,0.12)',
                position: 'relative',
                zIndex: 2
              }}
            />
            <Box 
              sx={{ 
                position: 'absolute',
                top: -20,
                right: -20,
                width: '100%',
                height: '100%',
                bgcolor: theme.palette.secondary.main,
                borderRadius: 4,
                zIndex: 1,
                opacity: 0.1
              }}
            />
          </Box>
        </Grid>
        <Grid item xs={12} md={6}>
          <Typography 
            variant="overline" 
            sx={{ color: theme.palette.secondary.main, fontWeight: 700, mb: 2, display: 'block' }}
          >
            La Solución Inteligente
          </Typography>
          <Typography variant="h2" sx={{ mb: 3, fontWeight: 700 }}>
            VisualFeast: El Chef Digital que tu Negocio Necesita
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 4, color: 'text.secondary', fontSize: '1.2rem' }}>
            Transformamos tus ideas en imágenes hiperrealistas y recetas detalladas en segundos. Usamos IA de vanguardia para que puedas enfocarte en lo que mejor haces: cocinar.
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 5 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <AutoAwesomeIcon color="secondary" />
              <Typography variant="body1">
                <strong>Marketing Gastronómico:</strong> Imágenes diseñadas para vender más.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <AutoAwesomeIcon color="secondary" />
              <Typography variant="body1">
                <strong>Ahorro Estratégico:</strong> Elimina costos innecesarios en fotografía.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <AutoAwesomeIcon color="secondary" />
              <Typography variant="body1">
                <strong>Innovación Culinaria:</strong> Visualiza tendencias antes que nadie.
              </Typography>
            </Box>
          </Box>

          <Button 
            variant="contained" 
            color="secondary" 
            size="large"
            component={RouterLink}
            to="/app"
            sx={{ 
              py: 2, 
              px: 4, 
              borderRadius: '50px',
              fontWeight: 700,
              fontSize: '1rem',
              boxShadow: `0 10px 20px ${theme.palette.secondary.main}44`
            }}
          >
            Empezar a Crear Gratis
          </Button>
        </Grid>
      </Grid>
    </SectionWrapper>
  );
};

export default SolutionSection;
