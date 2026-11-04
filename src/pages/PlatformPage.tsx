import React from 'react';
import { Alert, Box, Button, CircularProgress, Container, Paper, Typography } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import DishModule from '../components/DishModule/DishModule';
import { useAuthContext } from '../context/AuthContext';

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 4 }}>{children}</Box>
);

const PlatformPage: React.FC = () => {
  const { state, error, email, signIn, signOut } = useAuthContext();

  if (state === 'loading') {
    return (
      <Centered>
        <CircularProgress aria-label="Verificando tu acceso" />
      </Centered>
    );
  }

  if (state === 'signed_out') {
    return (
      <Centered>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, maxWidth: 440, width: '100%', textAlign: 'center', borderRadius: 0 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Entra a VisualFeast
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Mejora fotos de tus platos, crea imágenes y recetas gourmet. Entra con tu cuenta de Google.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
              {error}
            </Alert>
          )}
          <Button
            fullWidth
            size="large"
            variant="contained"
            startIcon={<GoogleIcon />}
            onClick={signIn}
            sx={{ minHeight: 48, borderRadius: 0, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}
          >
            Continuar con Google
          </Button>
        </Paper>
      </Centered>
    );
  }

  if (state === 'no_access') {
    return (
      <Centered>
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 5 }, maxWidth: 440, width: '100%', textAlign: 'center', borderRadius: 0 }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
            Esta cuenta aún no tiene acceso
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {email ? `Entraste como ${email}, pero esa cuenta` : 'Tu cuenta'} todavía no está invitada a VisualFeast. Pide acceso o entra con otra cuenta.
          </Typography>
          <Button fullWidth variant="outlined" onClick={signOut} sx={{ minHeight: 48, borderRadius: 0 }}>
            Entrar con otra cuenta
          </Button>
        </Paper>
      </Centered>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pt: 2, pb: 8 }}>
      <Container maxWidth="lg">
        <DishModule />
      </Container>
    </Box>
  );
};

export default PlatformPage;
