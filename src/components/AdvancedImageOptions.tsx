import React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { ASPECT_RATIOS } from '../constants/parameters';
import { DishParameters } from '../types';
import {
  BACKGROUND_CHOICES,
  CHEAPEST,
  FORMAT_CHOICES,
  MODEL_CHOICES,
  QUALITY_CHOICES,
  TIER_CHOICES,
  imageRequestOptions,
  isCheapest,
  summarize,
} from '../services/imageOptions';
import type { Resolved } from '../services/openai-image-core.ts';

interface Props {
  parameters: DishParameters;
  onParameterChange: (p: Partial<DishParameters>) => void;
  isAdmin: boolean;
  estimate: Resolved;
  disabled?: boolean;
}

const hintOf = (choices: { value: string; hint?: string }[], value: unknown) => choices.find((c) => c.value === value)?.hint;

/** «Opciones avanzadas del modelo»: plegado por defecto; todo arranca en lo más económico. */
const AdvancedImageOptions: React.FC<Props> = ({ parameters, onParameterChange, isAdmin, estimate, disabled }) => {
  const theme = useTheme();
  const o = imageRequestOptions(parameters);
  const set = (field: keyof DishParameters) => (e: SelectChangeEvent<string>) => onParameterChange({ [field]: e.target.value });
  const custom = o.imageSize === 'custom';
  const [w, h] = String(o.size ?? '').split('x');
  const resolvedFormat = estimate.ok ? estimate.value.format : o.format;
  const slow = o.quality === 'xhigh' || o.quality === 'max';

  const field = { fullWidth: true, disabled } as const;
  const selectSx = { borderRadius: 0, minHeight: 48 };

  return (
    <Accordion
      disableGutters
      sx={{
        background: 'transparent',
        boxShadow: 'none',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 0,
        mb: 3,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 56, px: 2 }} aria-controls="opciones-avanzadas" id="opciones-avanzadas-cabecera">
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.9rem' }}>
            Opciones avanzadas del modelo
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }} data-testid="resumen-opciones">
            {summarize(parameters)}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails id="opciones-avanzadas" sx={{ px: 2, pb: 3 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
          Todo arranca en lo más económico. Explora con <strong>Flare + Borrador</strong> y, cuando te guste el resultado, repite con{' '}
          <strong>Sunburst</strong> y más calidad para la entrega final.
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <FormControl {...field}>
            <InputLabel id="opt-modelo">Modelo</InputLabel>
            <Select labelId="opt-modelo" label="Modelo" value={String(o.model)} onChange={set('model')} sx={selectSx} inputProps={{ 'data-testid': 'opt-modelo' }}>
              {MODEL_CHOICES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
            <FormHelperText>{hintOf(MODEL_CHOICES, o.model)}</FormHelperText>
          </FormControl>

          <FormControl {...field}>
            <InputLabel id="opt-calidad">Calidad</InputLabel>
            <Select labelId="opt-calidad" label="Calidad" value={String(o.quality)} onChange={set('quality')} sx={selectSx} inputProps={{ 'data-testid': 'opt-calidad' }}>
              {QUALITY_CHOICES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
            <FormHelperText>{hintOf(QUALITY_CHOICES, o.quality)}</FormHelperText>
          </FormControl>

          <FormControl {...field}>
            <InputLabel id="opt-formato">Formato (destino)</InputLabel>
            <Select labelId="opt-formato" label="Formato (destino)" value={String(o.aspectRatio)} onChange={set('aspectRatio')} sx={selectSx} disabled={disabled || custom} inputProps={{ 'data-testid': 'opt-formato' }}>
              {ASPECT_RATIOS.map((a) => <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>)}
            </Select>
            {custom && <FormHelperText>Con tamaño personalizado, el formato sale de las medidas.</FormHelperText>}
          </FormControl>

          <FormControl {...field}>
            <InputLabel id="opt-resolucion">Resolución</InputLabel>
            <Select labelId="opt-resolucion" label="Resolución" value={String(o.imageSize)} onChange={set('imageSize')} sx={selectSx} inputProps={{ 'data-testid': 'opt-resolucion' }}>
              {TIER_CHOICES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
            <FormHelperText>{estimate.ok ? `Saldrá de ${estimate.value.width}×${estimate.value.height} px.` : ' '}</FormHelperText>
          </FormControl>

          {custom && (
            <Box sx={{ gridColumn: { sm: '1 / -1' }, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Ancho (px)"
                value={w ?? ''}
                onChange={(e) => onParameterChange({ customSize: `${e.target.value.replace(/\D/g, '').slice(0, 4)}x${h ?? ''}` })}
                inputProps={{ inputMode: 'numeric', 'data-testid': 'opt-ancho' }}
                disabled={disabled}
                helperText="Múltiplo de 16"
              />
              <TextField
                label="Alto (px)"
                value={h ?? ''}
                onChange={(e) => onParameterChange({ customSize: `${w ?? ''}x${e.target.value.replace(/\D/g, '').slice(0, 4)}` })}
                inputProps={{ inputMode: 'numeric', 'data-testid': 'opt-alto' }}
                disabled={disabled}
                helperText="Relación máxima 3:1"
              />
            </Box>
          )}

          <FormControl {...field}>
            <InputLabel id="opt-salida">Formato de salida</InputLabel>
            <Select labelId="opt-salida" label="Formato de salida" value={String(o.format)} onChange={set('format')} sx={selectSx} inputProps={{ 'data-testid': 'opt-salida' }}>
              {FORMAT_CHOICES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
            <FormHelperText>{hintOf(FORMAT_CHOICES, resolvedFormat)}</FormHelperText>
          </FormControl>

          <FormControl {...field}>
            <InputLabel id="opt-fondo">Fondo</InputLabel>
            <Select labelId="opt-fondo" label="Fondo" value={String(o.background)} onChange={set('background')} sx={selectSx} inputProps={{ 'data-testid': 'opt-fondo' }}>
              {BACKGROUND_CHOICES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
            </Select>
            <FormHelperText>{hintOf(BACKGROUND_CHOICES, o.background)}</FormHelperText>
          </FormControl>

          <FormControl {...field}>
            <InputLabel id="opt-variantes">Variantes del mismo plato</InputLabel>
            <Select labelId="opt-variantes" label="Variantes del mismo plato" value={String(o.n)} onChange={(e) => onParameterChange({ numberOfImages: Number(e.target.value) })} sx={selectSx} inputProps={{ 'data-testid': 'opt-variantes' }}>
              {[1, 2, 3, 4].map((n) => <MenuItem key={n} value={String(n)}>{n === 1 ? '1 propuesta' : `${n} propuestas`}</MenuItem>)}
            </Select>
            <FormHelperText>Cada propuesta cuesta lo mismo que una imagen. Útil para elegir entre varias presentaciones.</FormHelperText>
          </FormControl>
        </Box>

        {isAdmin && (
          <FormControlLabel
            sx={{ mt: 2, minHeight: 44 }}
            control={
              <Switch
                checked={o.moderation === 'low'}
                disabled={disabled}
                onChange={(e) => onParameterChange({ moderation: e.target.checked ? 'low' : 'auto' })}
                inputProps={{ 'aria-label': 'Moderación baja', ...({ 'data-testid': 'opt-moderacion' } as object) }}
              />
            }
            label="Moderación baja (solo administradores)"
          />
        )}

        {o.background === 'transparent' && o.format === 'jpeg' && (
          <Alert severity="info" sx={{ mt: 2, borderRadius: 0 }}>La transparencia no existe en JPEG: se guardará en WebP.</Alert>
        )}
        {slow && (
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 0 }} data-testid="aviso-lento">
            Esta calidad puede tardar entre 30 y 90 segundos. No cierres la página mientras se genera.
          </Alert>
        )}
        {!estimate.ok && (
          <Alert severity="error" sx={{ mt: 2, borderRadius: 0 }} data-testid="error-opciones">{estimate.message}</Alert>
        )}

        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={() => onParameterChange({ ...CHEAPEST })}
          disabled={disabled || isCheapest(parameters)}
          sx={{ mt: 2, minHeight: 44, borderRadius: 0, borderColor: theme.palette.divider, color: 'text.secondary' }}
        >
          Volver a lo más económico
        </Button>
      </AccordionDetails>
    </Accordion>
  );
};

export default AdvancedImageOptions;
