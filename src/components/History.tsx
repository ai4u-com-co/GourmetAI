import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardMedia, IconButton, Dialog, DialogTitle, DialogContent, Button, Divider } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { getHistory, deleteFromHistory, clearHistory, legacyHistoryCount, importLegacyHistory, discardLegacyHistory } from '../utils/historyService';
import { HistoryItem } from '../types';

const History: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [legacy, setLegacy] = useState<number>(() => legacyHistoryCount());

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setHistory(getHistory());
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteFromHistory(id);
    loadHistory();
  };

  const handleImportLegacy = () => {
    importLegacyHistory();
    setLegacy(0);
    loadHistory();
  };

  const handleDiscardLegacy = () => {
    if (window.confirm('¿Descartar para siempre las creaciones anteriores de este dispositivo?')) {
      discardLegacyHistory();
      setLegacy(0);
    }
  };

  const legacyBanner = legacy > 0 && (
    <Box sx={{ p: 2, mb: 2, border: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        Encontramos {legacy} creaciones anteriores guardadas en este dispositivo. ¿Las importas a tu cuenta?
      </Typography>
      <Button size="small" variant="contained" onClick={handleImportLegacy} sx={{ mr: 1 }}>Importar a mi cuenta</Button>
      <Button size="small" onClick={handleDiscardLegacy}>Ahora no</Button>
    </Box>
  );

  const handleClear = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar todo el historial?')) {
      clearHistory();
      loadHistory();
    }
  };

  if (history.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        {legacyBanner}
        <Typography variant="body1" color="text.secondary">
          No tienes creaciones guardadas todavía.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ py: 2 }}>
      {legacyBanner}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold">Tus Creaciones</Typography>
        <Button size="small" color="error" onClick={handleClear}>Borrar Todo</Button>
      </Box>
      
      <Grid container spacing={2}>
        {history.map((item) => (
          <Grid item xs={6} sm={4} key={item.id}>
            <Card 
              sx={{ 
                cursor: 'pointer', 
                position: 'relative',
                '&:hover .overlay': { opacity: 1 }
              }}
              onClick={() => setSelectedItem(item)}
            >
              <CardMedia
                component="img"
                height="140"
                image={item.generatedImages[0]}
                alt="Plato generado"
              />
              <Box 
                className="overlay"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0,
                  transition: 'opacity 0.2s'
                }}
              >
                <VisibilityIcon sx={{ color: 'white' }} />
              </Box>
              <IconButton 
                size="small" 
                sx={{ 
                  position: 'absolute', 
                  top: 5, 
                  right: 5, 
                  bgcolor: 'rgba(255,255,255,0.7)',
                  '&:hover': { bgcolor: 'white' }
                }}
                onClick={(e) => handleDelete(item.id, e)}
              >
                <DeleteIcon fontSize="small" color="error" />
              </IconButton>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog 
        open={Boolean(selectedItem)} 
        onClose={() => setSelectedItem(null)}
        maxWidth="md"
        fullWidth
      >
        {selectedItem && (
          <>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              Detalles de la Creación
              <Typography variant="caption" color="text.secondary">
                {new Date(selectedItem.timestamp).toLocaleString()}
              </Typography>
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Imagen Generada</Typography>
                  <img 
                    src={selectedItem.generatedImages[0]} 
                    alt="Generada" 
                    style={{ width: '100%', borderRadius: '8px' }} 
                  />
                  {selectedItem.originalImage && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Imagen Original</Typography>
                      <img 
                        src={selectedItem.originalImage} 
                        alt="Original" 
                        style={{ width: '100%', borderRadius: '8px', opacity: 0.7 }} 
                      />
                    </Box>
                  )}
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    {selectedItem.type === 'improvement' ? 'Mejora Gourmet' : 'Creación desde Cero'}
                  </Typography>
                  
                  {selectedItem.idea && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" color="primary">Concepto:</Typography>
                      <Typography variant="body2">{selectedItem.idea}</Typography>
                    </Box>
                  )}

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="primary">Ingredientes:</Typography>
                    <Typography variant="body2">{selectedItem.ingredients}</Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" color="primary" gutterBottom>Parámetros:</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(selectedItem.parameters).map(([key, value]) => (
                      value && (Array.isArray(value) ? value.length > 0 : true) && (
                        <Box 
                          key={key} 
                          sx={{ 
                            px: 1, 
                            py: 0.5, 
                            bgcolor: 'action.hover', 
                            borderRadius: 1,
                            fontSize: '0.75rem'
                          }}
                        >
                          <strong>{key}:</strong> {Array.isArray(value) ? value.join(', ') : value}
                        </Box>
                      )
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default History;
