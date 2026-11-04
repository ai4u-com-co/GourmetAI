import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { logError } from '../utils/logger';

interface State {
  failed: boolean;
}

/** Evita la pantalla en blanco: si un componente falla al dibujarse, se registra y se ofrece recargar. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError('render_error', error, { path: window.location.pathname, message: `${error.message} @ ${(info.componentStack || '').split('\n')[1]?.trim() ?? ''}`.slice(0, 300) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, px: 3, textAlign: 'center' }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          Algo salió mal en la app
        </Typography>
        <Typography color="text.secondary">Ya quedó registrado. Recarga la página e inténtalo de nuevo.</Typography>
        <Button variant="contained" onClick={() => window.location.reload()} sx={{ minHeight: 48, borderRadius: 0 }}>
          Recargar
        </Button>
      </Box>
    );
  }
}

export default ErrorBoundary;
