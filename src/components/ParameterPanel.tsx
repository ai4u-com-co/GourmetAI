import React from 'react';
import {
  Box,
  Paper,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Typography,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  SelectChangeEvent
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CasinoIcon from '@mui/icons-material/Casino';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  ESTILOS_PLATO,
  ILUMINACIONES,
  FONDOS,
  DECORACIONES_EXTRA,
  ANGULOS_CAMARA,
  INTENSIDAD_GOURMET_MIN,
  INTENSIDAD_GOURMET_MAX,
  AMBIENTES
} from '../constants/parameters';
import { generateRandomParameters, getDefaultParameters } from '../utils/randomParameters';
import { DishParameters } from '../types';
import AdvancedImageOptions from './AdvancedImageOptions';
import { estimateImage } from '../services/imageOptions';
import { useAuthContext } from '../context/AuthContext';

interface ParameterPanelProps {
  parameters: DishParameters;
  onParameterChange: (newParams: Partial<DishParameters>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hideHeaderControls?: boolean;
  extraCredits?: number; // costo fijo adicional (p. ej. detectar ingredientes en el flujo de foto)
  inputPixels?: number[]; // píxeles (ya reducidos) de cada foto que se enviará: se cobran como entrada
}

const ParameterPanel: React.FC<ParameterPanelProps> = ({
  parameters,
  onParameterChange,
  onGenerate,
  isGenerating,
  hideHeaderControls = false,
  extraCredits = 0,
  inputPixels = []
}) => {
  const theme = useTheme();
  const { isAdmin, credits } = useAuthContext();
  const {
    intensidadGourmet,
    estiloPlato,
    iluminacion,
    fondo,
    decoracionesExtra,
    anguloCamara,
    ambiente
  } = parameters;
  // Mismo cálculo que el servidor: el costo que ves es el que se cobra (el servidor manda).
  const estimate = estimateImage(parameters, inputPixels, isAdmin);
  const total = estimate.ok ? estimate.value.credits + extraCredits : 0;
  const lacksCredits = !isAdmin && estimate.ok && total > credits;

  const handleDecoracionChange = (value: string) => {
    const current = decoracionesExtra || [];
    const updated = current.includes(value)
      ? current.filter(d => d !== value)
      : [...current, value];
    onParameterChange({ decoracionesExtra: updated });
  };

  const handleRandomize = () => {
    const randomParams = generateRandomParameters();
    onParameterChange(randomParams);
  };

  const handleReset = () => {
    const defaultParams = getDefaultParameters();
    onParameterChange(defaultParams);
  };

  const accordionStyle = {
    background: 'transparent',
    boxShadow: 'none',
    border: 'none',
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:before': { display: 'none' },
    '&:last-child': { borderBottom: 'none' },
    '&.Mui-expanded': { margin: 0 },
    borderRadius: 0,
  };

  const summaryStyle = {
    px: 0,
    minHeight: 64,
    '& .MuiAccordionSummary-content': { margin: '12px 0' },
  };

  const handleSelectChange = (field: keyof DishParameters) => (event: SelectChangeEvent<string>) => {
    onParameterChange({ [field]: event.target.value });
  };

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 0, 
        borderRadius: 0,
        border: 'none',
        backgroundColor: 'transparent',
      }}
    >
      {!hideHeaderControls && (
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Button
          variant="outlined"
          startIcon={<CasinoIcon />}
          onClick={handleRandomize}
          disabled={isGenerating}
          fullWidth
          sx={{ borderRadius: 0, borderColor: theme.palette.divider, color: 'text.secondary' }}
        >
          Aleatorio
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={handleReset}
          disabled={isGenerating}
          fullWidth
          sx={{ borderRadius: 0, borderColor: theme.palette.divider, color: 'text.secondary' }}
        >
          Reset
        </Button>
      </Box>
      )}

      <Box sx={{ mb: 4, pb: 1, borderBottom: `2px solid ${theme.palette.text.primary}` }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '1rem'
          }}
        >
          Configuración
        </Typography>
      </Box>

      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>
            Intensidad
          </Typography>
          <Typography variant="subtitle2" fontWeight="bold">
            {intensidadGourmet} / 10
          </Typography>
        </Box>
        <Slider
          value={intensidadGourmet}
          min={INTENSIDAD_GOURMET_MIN}
          max={INTENSIDAD_GOURMET_MAX}
          step={1}
          onChange={(_, value) => onParameterChange({ intensidadGourmet: value as number })}
          disabled={isGenerating}
          sx={{
            color: 'text.primary',
            height: 2,
            padding: '13px 0',
            '& .MuiSlider-thumb': {
              height: 20,
              width: 20,
              backgroundColor: 'text.primary',
              border: '1px solid currentColor',
              '&:hover': {
                boxShadow: 'none',
              },
            },
            '& .MuiSlider-track': {
              height: 2,
            },
            '& .MuiSlider-rail': {
              color: theme.palette.divider,
              opacity: 1,
              height: 2,
            },
          }}
        />
      </Box>

      <AdvancedImageOptions
        parameters={parameters}
        onParameterChange={onParameterChange}
        isAdmin={isAdmin}
        estimate={estimate}
        disabled={isGenerating}
      />

      <Accordion sx={accordionStyle}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summaryStyle}>
          <Typography variant="subtitle1" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
            Estilo & Ambiente
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel>Estilo de Plato</InputLabel>
            <Select
              value={estiloPlato}
              label="Estilo de Plato"
              onChange={handleSelectChange('estiloPlato')}
            >
              {ESTILOS_PLATO.map((e) => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel>Fondo</InputLabel>
            <Select
              value={fondo}
              label="Fondo"
              onChange={handleSelectChange('fondo')}
            >
              {FONDOS.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel>Ambiente</InputLabel>
            <Select
              value={ambiente || 'sin-preferencia'}
              label="Ambiente"
              onChange={handleSelectChange('ambiente')}
            >
              {AMBIENTES.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={accordionStyle}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summaryStyle}>
          <Typography variant="subtitle1" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
            Cámara & Luz
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel>Iluminación</InputLabel>
            <Select
              value={iluminacion}
              label="Iluminación"
              onChange={handleSelectChange('iluminacion')}
            >
              {ILUMINACIONES.map((i) => <MenuItem key={i.value} value={i.value}>{i.label}</MenuItem>)}
            </Select>
          </FormControl>
          
          <FormControl fullWidth sx={{ mb: 2 }} size="small">
            <InputLabel>Ángulo</InputLabel>
            <Select
              value={anguloCamara}
              label="Ángulo"
              onChange={handleSelectChange('anguloCamara')}
            >
              {ANGULOS_CAMARA.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </Select>
          </FormControl>
        </AccordionDetails>
      </Accordion>

      <Accordion sx={accordionStyle}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={summaryStyle}>
          <Typography variant="subtitle1" fontWeight="600" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
            Detalles Extra
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 0 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {DECORACIONES_EXTRA.map((decoracion) => {
              const isSelected = (decoracionesExtra || []).includes(decoracion.value);
              return (
                <Chip
                  key={decoracion.value}
                  label={decoracion.label}
                  onClick={() => !isGenerating && handleDecoracionChange(decoracion.value)}
                  color={isSelected ? "primary" : "default"}
                  variant={isSelected ? "filled" : "outlined"}
                  sx={{ borderRadius: 0 }}
                />
              );
            })}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ mt: 4, p: 2, border: `1px solid ${theme.palette.divider}` }} data-testid="costo">
        {estimate.ok ? (
          <>
            <Typography variant="body2" fontWeight={700}>
              Costo: {total} {total === 1 ? 'crédito' : 'créditos'}
              {isAdmin ? ' · sin límite para administradores' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
              {estimate.value.n > 1 ? `${estimate.value.n} propuestas` : '1 imagen'} de {estimate.value.size} px
              {inputPixels.length ? ` · ${inputPixels.length} ${inputPixels.length === 1 ? 'foto enviada' : 'fotos enviadas'}` : ''}
              {extraCredits ? ` · ${extraCredits} por detectar los ingredientes` : ''}
              {isAdmin ? '' : ` · tu saldo: ${credits}`}
            </Typography>
            {lacksCredits && (
              <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                No te alcanzan los créditos para esta combinación: baja la calidad, el tamaño o las propuestas.
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="body2" color="error">Revisa las opciones avanzadas: {estimate.message}</Typography>
        )}
      </Box>

      <Button
        variant="contained"
        fullWidth
        size="large"
        onClick={onGenerate}
        disabled={isGenerating || !estimate.ok || lacksCredits}
        sx={{
          mt: 2,
          py: 2,
          minHeight: 48,
          borderRadius: 0,
          fontWeight: 700,
          letterSpacing: '0.1em',
          fontSize: '0.9rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
            bgcolor: 'text.primary',
            opacity: 0.9,
          },
        }}
      >
        {isGenerating ? 'PROCESANDO...' : estimate.ok ? `GENERAR IMAGEN · ${total} ${total === 1 ? 'CRÉDITO' : 'CRÉDITOS'}` : 'GENERAR IMAGEN'}
      </Button>
    </Paper>
  );
};

export default ParameterPanel;
