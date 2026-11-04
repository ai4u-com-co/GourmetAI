import React, { useState } from 'react';
import { Box, Alert, Typography, Divider, Grid } from '@mui/material';
import ImageUploader from '../ImageUploader';
import ParameterPanel from '../ParameterPanel';
import { validateParameters } from '../../utils/validation';
import { DishParameters } from '../../types';

interface FromPhotoProps {
  parameters: DishParameters;
  onParameterChange: (newParams: Partial<DishParameters>) => void;
  onGenerate: (imageBase64: string, parameters: DishParameters) => Promise<any>;
  isGenerating: boolean;
}

const FromPhoto: React.FC<FromPhotoProps> = ({ parameters, onParameterChange, onGenerate, isGenerating }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedPlate, setSelectedPlate] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);
  const [selectedCutlery, setSelectedCutlery] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLocalError(null);
    if (!selectedImage) {
      setLocalError('Por favor, selecciona una imagen del plato primero');
      return;
    }

    const paramValidation = validateParameters(parameters);
    if (!paramValidation.valid) {
      setLocalError(paramValidation.error || 'Error en los parámetros');
      return;
    }

    try {
      // Pasamos las fotos de referencia en los parámetros si existen
      const paramsWithRefs = { 
        ...parameters, 
        plateImage: selectedPlate || undefined,
        tableImage: selectedTable || undefined,
        restaurantImage: selectedRestaurant || undefined,
        cutleryImage: selectedCutlery || undefined
      };
      await onGenerate(selectedImage, paramsWithRefs);
    } catch (err) {
      console.error('Error en generación:', err);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {localError && (
        <Alert severity="error">{localError}</Alert>
      )}
      
      <Box>
        <Typography variant="overline" sx={{ mb: 1, display: 'block', opacity: 0.7 }}>
          Paso 1: Tu Comida
        </Typography>
        <ImageUploader
          onImageSelect={setSelectedImage}
          selectedImage={selectedImage}
          label="Foto de tu Comida"
        />
      </Box>

      <Divider sx={{ my: 1, borderStyle: 'dashed', opacity: 0.5 }} />

      <Box>
        <Typography variant="overline" sx={{ mb: 1, display: 'block', opacity: 0.7 }}>
          Paso 2: Referencias de Estilo (Opcional)
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <ImageUploader
              onImageSelect={setSelectedPlate}
              selectedImage={selectedPlate}
              label="Foto del Plato Físico"
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.6, fontStyle: 'italic' }}>
              * La IA intentará emplatar tu comida en este plato.
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <ImageUploader
              onImageSelect={setSelectedTable}
              selectedImage={selectedTable}
              label="Foto de la Mesa"
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.6, fontStyle: 'italic' }}>
              * Referencia para la superficie y textura de la mesa.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <ImageUploader
              onImageSelect={setSelectedRestaurant}
              selectedImage={selectedRestaurant}
              label="Foto del Restaurante"
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.6, fontStyle: 'italic' }}>
              * Referencia para el ambiente y decoración de fondo.
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <ImageUploader
              onImageSelect={setSelectedCutlery}
              selectedImage={selectedCutlery}
              label="Foto de Cubiertos"
            />
            <Typography variant="caption" sx={{ mt: 1, display: 'block', opacity: 0.6, fontStyle: 'italic' }}>
              * Referencia para el estilo de los cubiertos (props).
            </Typography>
          </Grid>
        </Grid>
      </Box>
      
      <Divider sx={{ my: 1, borderStyle: 'dashed', opacity: 0.5 }} />

      <Box>
        <Typography variant="overline" sx={{ mb: 1, display: 'block', opacity: 0.7 }}>
          Paso 3: Ajustes Finales
        </Typography>
        <ParameterPanel
          parameters={parameters}
          onParameterChange={onParameterChange}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          extraCredits={1}
        />
      </Box>
    </Box>
  );
};

export default FromPhoto;
