import React, { useState, useEffect } from 'react';
import GeneratedImages from '../GeneratedImages';
import { 
  Paper, 
  Typography, 
  Box, 
  Button, 
  CircularProgress, 
  IconButton, 
  Tooltip,
  Snackbar,
  Alert,
  useTheme
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { DishParameters } from '../../types';

interface DishPreviewProps {
  images: string[];
  isLoading: boolean;
  error: string | null;
  parameters: DishParameters | null;
  seed: number | null;
  ingredients: string;
  recipe: string | null;
  onGenerateRecipe: () => Promise<void>;
  isRecipeLoading: boolean;
}

const DishPreview: React.FC<DishPreviewProps> = ({ 
  images, 
  isLoading, 
  error, 
  parameters, 
  seed, 
  ingredients, 
  recipe,
  onGenerateRecipe,
  isRecipeLoading
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const theme = useTheme();

  useEffect(() => {
    console.log('🔍 DishPreview - recipe changed:', recipe);
    console.log('🔍 DishPreview - recipe length:', recipe?.length);
    console.log('🔍 DishPreview - isLoading:', isLoading);
    console.log('🔍 DishPreview - isRecipeLoading:', isRecipeLoading);
    console.log('🔍 DishPreview - images:', images?.length);
  }, [recipe, isLoading, isRecipeLoading, images]);

  const handleCopyRecipe = async () => {
    if (!recipe) return;
    
    try {
      await navigator.clipboard.writeText(recipe);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
      const textArea = document.createElement('textarea');
      textArea.value = recipe;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('Error en fallback de copiar:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  const hasRecipe = recipe && typeof recipe === 'string' && recipe.trim().length > 0;

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 2, 
        width: '100%',
        height: 'auto',
        minHeight: 'auto',
        flexGrow: 1,
      }}
    >
      <Box sx={{ mb: 1, pb: 1, borderBottom: `2px solid ${theme.palette.text.primary}` }}>
        <Typography 
          variant="h6" 
          sx={{ 
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '1rem'
          }}
        >
          CANVAS
        </Typography>
      </Box>

      <Box 
        sx={{ 
          flexShrink: 0,
          flexGrow: hasRecipe ? 0 : 1,
          height: hasRecipe ? 'auto' : '100%',
          maxHeight: hasRecipe ? '400px' : 'none',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: hasRecipe ? '250px' : '400px',
          width: '100%'
        }}
      >
        <Box sx={{ 
          width: '100%', 
          height: hasRecipe ? 'auto' : '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <GeneratedImages 
            images={images}
            isLoading={isLoading}
            error={error}
            parameters={parameters}
            seed={seed}
            ingredients={ingredients}
          />
        </Box>
      </Box>
      
      {images && images.length > 0 && !hasRecipe && !isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
              <Button 
                variant="outlined" 
                startIcon={isRecipeLoading ? <CircularProgress size={20} /> : <RestaurantMenuIcon />}
                onClick={onGenerateRecipe}
                disabled={isRecipeLoading}
                sx={{ 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em',
                    fontWeight: 600
                }}
              >
                  {isRecipeLoading ? 'Generando Receta...' : 'Generar Receta del Plato · 1 crédito'}
              </Button>
          </Box>
      )}

      {hasRecipe && !isLoading && (
        <Paper 
          elevation={0} 
          sx={{ 
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid', 
            borderColor: 'divider',
            bgcolor: 'background.paper',
            borderRadius: 2,
            width: '100%',
            height: 'auto',
            minHeight: 'auto',
            maxHeight: 'none',
            overflow: 'visible',
          }}
        >
          <Box 
            sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              p: 2.5,
              pb: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.default',
              flexShrink: 0
            }}
          >
            <Typography 
              variant="h6" 
              sx={{ 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em', 
                fontWeight: 700,
                fontSize: '1rem',
                color: 'text.primary'
              }}
            >
              Receta Sugerida
            </Typography>
            <Tooltip title={copied ? "¡Copiado!" : "Copiar receta"} arrow>
              <IconButton
                onClick={handleCopyRecipe}
                size="small"
                disabled={!recipe}
                sx={{
                  color: copied ? 'success.main' : 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: copied ? 'success.main' : 'primary.main'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {copied ? <CheckCircleIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          <Box 
            sx={{ 
              p: 3,
              width: '100%',
              userSelect: 'text',
              WebkitUserSelect: 'text',
              MozUserSelect: 'text',
              msUserSelect: 'text',
            }}
          >
            <Box 
              component="div"
              sx={{ 
                '& h3': { 
                  fontSize: '1.25rem', 
                  fontWeight: 700,
                  mt: 0, 
                  mb: 2, 
                  color: 'primary.main',
                  lineHeight: 1.4
                },
                '& h4': {
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  mt: 2.5,
                  mb: 1.5,
                  color: 'text.primary',
                  lineHeight: 1.4
                },
                '& p': {
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  mb: 1.5,
                  color: 'text.primary'
                },
                '& strong': { 
                  fontWeight: 600,
                  color: 'text.primary' 
                },
                '& em': {
                  fontStyle: 'italic',
                  color: 'text.secondary'
                },
                '& ul, & ol': { 
                  pl: 3,
                  mb: 2,
                  '& li': {
                    fontSize: '0.95rem',
                    lineHeight: 1.8,
                    mb: 0.75,
                    color: 'text.primary',
                    '&::marker': {
                      color: 'primary.main'
                    }
                  }
                },
                '& ul': {
                  listStyleType: 'disc'
                },
                '& ol': {
                  listStyleType: 'decimal'
                },
                '& code': {
                  fontSize: '0.85em',
                  bgcolor: 'action.selected',
                  px: 0.5,
                  py: 0.25,
                  borderRadius: 0.5,
                  fontFamily: 'monospace'
                },
                '& pre': {
                  bgcolor: 'action.selected',
                  p: 1.5,
                  borderRadius: 1,
                  overflow: 'auto',
                  mb: 2
                },
                '& blockquote': {
                  borderLeft: '3px solid',
                  borderColor: 'primary.main',
                  pl: 2,
                  ml: 0,
                  fontStyle: 'italic',
                  color: 'text.secondary',
                  mb: 2
                },
                typography: 'body1',
                color: 'text.primary',
                lineHeight: 1.6,
                width: '100%',
                pb: 2
              }}
            >
              {recipe && <ReactMarkdown>{recipe}</ReactMarkdown>}
            </Box>
          </Box>
        </Paper>
      )}

      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setCopied(false)} 
          severity="success" 
          sx={{ width: '100%' }}
          icon={<CheckCircleIcon />}
        >
          Receta copiada al portapapeles
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DishPreview;
