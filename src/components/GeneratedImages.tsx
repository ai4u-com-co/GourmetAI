import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Button,
  Typography,
  Dialog,
  DialogContent,
  IconButton,
  Alert,
  useTheme,
  alpha,
  CircularProgress,
  LinearProgress,
  Fade
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import { downloadImage } from '../utils/imageUtils';
import { downloadImageWithMetadata, createMetadata } from '../utils/metadataUtils';
import { DishParameters } from '../types';
import { extensionOf } from '../services/imageOptions';

interface LoadingMessage {
  text: string;
  icon: string;
}

const LOADING_MESSAGES: LoadingMessage[] = [
  { text: 'ANALYZING COMPOSITION', icon: '' },
  { text: 'DETECTING INGREDIENTS', icon: '' },
  { text: 'APPLYING CULINARY STYLING', icon: '' },
  { text: 'ADJUSTING LIGHTING', icon: '' },
  { text: 'PLATING DISH', icon: '' },
  { text: 'ADDING FINISHING TOUCHES', icon: '' },
  { text: 'CAPTURING FINAL SHOT', icon: '' },
];

interface GeneratedImagesProps {
  images: string[];
  isLoading: boolean;
  error: string | null;
  parameters: DishParameters | null;
  seed: number | null;
  ingredients: string;
}

const GeneratedImages: React.FC<GeneratedImagesProps> = ({ images, isLoading, error, parameters, seed, ingredients }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [variantIndex, setVariantIndex] = useState<number>(0);
  const theme = useTheme();

  // Una generación nueva vuelve a mostrar la primera propuesta.
  useEffect(() => {
    setVariantIndex(0);
  }, [images]);

  const calculateProgress = (elapsedSeconds: number): number => {
    const totalEstimatedSeconds = 120;
    const progressRatio = Math.min(elapsedSeconds / totalEstimatedSeconds, 0.95);
    
    if (progressRatio <= 0.167) {
      return progressRatio * 1.8;
    } else if (progressRatio <= 0.667) {
      return 0.3 + (progressRatio - 0.167) * 0.8;
    } else {
      return 0.7 + (progressRatio - 0.667) * 0.75;
    }
  };

  useEffect(() => {
    if (!isLoading && startTime !== null) {
      setProgress(100);
      const timer = setTimeout(() => {
        setLoadingMessageIndex(0);
        setProgress(0);
        setStartTime(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, startTime]);

  useEffect(() => {
    if (!isLoading) return;

    if (startTime === null) {
      setStartTime(Date.now());
      setProgress(0);
    }

    const messageInterval = setInterval(() => {
      setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);

    const progressInterval = setInterval(() => {
      if (startTime !== null) {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const calculatedProgress = calculateProgress(elapsedSeconds);
        setProgress(Math.min(calculatedProgress * 100, 95));
      }
    }, 1000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(progressInterval);
    };
  }, [isLoading, startTime]);

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl);
    setOpenDialog(true);
  };

  const handleDownload = async (imageUrl: string, index: number = 0) => {
    const filename = `gourmet_variante_${index + 1}`;
    const ext = extensionOf(imageUrl); // jpg, webp o png según lo que devolvió el servidor

    if (parameters && seed && ingredients) {
      try {
        const metadata = createMetadata(parameters, seed, ingredients);
        await downloadImageWithMetadata(imageUrl, metadata, filename, ext);
      } catch (error) {
        console.error('Error downloading with metadata, using simple download:', error);
        await downloadImage(imageUrl, `${filename}.${ext}`);
      }
    } else {
      await downloadImage(imageUrl, `${filename}.${ext}`);
    }
  };

  if (error) {
    return (
      <Alert 
        severity="error" 
        sx={{ 
          mb: 2, 
          borderRadius: 0,
          border: `1px solid ${theme.palette.error.main}`,
          backgroundColor: alpha(theme.palette.error.main, 0.05),
        }}
      >
        {error}
      </Alert>
    );
  }

  if (isLoading) {
    const currentMessage = LOADING_MESSAGES[loadingMessageIndex];
    
    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          borderRadius: 0,
          border: `1px solid ${theme.palette.divider}`,
          minHeight: '100%',
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 4 }}>
          <CircularProgress
            size={80}
            thickness={1}
            sx={{ color: alpha(theme.palette.text.primary, 0.2), position: 'absolute' }}
            variant="determinate"
            value={100}
          />
          <CircularProgress
            size={80}
            thickness={1}
            sx={{ color: 'text.primary' }}
          />
        </Box>

        <Typography
          variant="h6"
          sx={{
            mb: 1,
            textAlign: 'center',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            fontSize: '0.875rem',
            animation: 'fadeIn 0.5s ease-out',
            '@keyframes fadeIn': {
              '0%': { opacity: 0 },
              '100%': { opacity: 1 },
            },
          }}
          key={loadingMessageIndex}
        >
          {currentMessage.text}
        </Typography>

        <Box sx={{ width: '60%', maxWidth: 240, mt: 4 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 2,
              backgroundColor: alpha(theme.palette.text.primary, 0.1),
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'text.primary',
              },
            }}
          />
        </Box>
      </Paper>
    );
  }

  if (!images || images.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: { xs: 6, md: 8 },
          textAlign: 'center',
          backgroundColor: 'background.default',
          minHeight: '100%',
          height: '100%',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 0,
          border: `1px dashed ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ maxWidth: 360 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700, 
              color: 'text.secondary', 
              mb: 2, 
              opacity: 0.3,
              letterSpacing: '-0.02em'
            }}
          >
            CANVAS
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Your gourmet creation will appear here.
          </Typography>
        </Box>
      </Paper>
    );
  }

  const safeIndex = Math.min(variantIndex, images.length - 1);
  const imageUrl = images[safeIndex];
  // Fondo transparente (recorte): se muestra sobre un tablero para que se vea que es transparente.
  const isCutout = parameters?.background === 'transparent';
  const checker = isCutout
    ? {
        backgroundColor: theme.palette.background.paper,
        backgroundImage: `linear-gradient(45deg, ${alpha(theme.palette.text.primary, 0.08)} 25%, transparent 25%, transparent 75%, ${alpha(theme.palette.text.primary, 0.08)} 75%), linear-gradient(45deg, ${alpha(theme.palette.text.primary, 0.08)} 25%, transparent 25%, transparent 75%, ${alpha(theme.palette.text.primary, 0.08)} 75%)`,
        backgroundSize: '24px 24px',
        backgroundPosition: '0 0, 12px 12px',
      }
    : {};

  return (
    <Fade in={true} timeout={800}>
      <Box 
        sx={{ 
          height: '100%', 
          width: '100%',
          display: 'flex', 
          flexDirection: 'column',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography
            variant="overline"
            sx={{
              color: 'text.secondary',
              letterSpacing: '0.2em',
              fontWeight: 600,
            }}
          >
            RESULT
          </Typography>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => handleDownload(imageUrl, safeIndex)}
            sx={{
              minHeight: 44,
              borderRadius: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              fontSize: '0.75rem',
            }}
          >
            Download
          </Button>
        </Box>
        
        <Paper
          elevation={0}
          sx={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 0,
            cursor: 'zoom-in',
            width: '100%',
            maxWidth: '100%',
            bgcolor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            display: 'block',
            transition: 'all 0.3s ease',
            '&:hover .overlay': { opacity: 1 },
            ...checker,
          }}
          onClick={() => handleImageClick(imageUrl)}
        >
          <img
            src={imageUrl}
            alt="VisualFeast gourmet creation"
            style={{
              width: '100%',
              maxWidth: '100%',
              height: 'auto',
              objectFit: 'contain',
              display: 'block',
              minHeight: 0,
            }}
          />
          
          <Box
            className="overlay"
            sx={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              bgcolor: 'rgba(0,0,0,0.3)',
              opacity: 0,
              transition: 'opacity 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="button" sx={{ color: 'white', letterSpacing: '0.2em', border: '1px solid white', px: 3, py: 1 }}>
              VIEW FULLSIZE
            </Typography>
          </Box>
        </Paper>

        {images.length > 1 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Propuesta {safeIndex + 1} de {images.length}. Elige la que prefieras y descárgala.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(images.length, 4)}, minmax(0, 1fr))`, gap: 1 }}>
              {images.map((src, i) => (
                <Box
                  key={i}
                  component="button"
                  type="button"
                  aria-label={`Ver propuesta ${i + 1}`}
                  aria-pressed={i === safeIndex}
                  onClick={() => setVariantIndex(i)}
                  sx={{
                    p: 0,
                    minHeight: 44,
                    cursor: 'pointer',
                    bgcolor: 'background.paper',
                    border: `2px solid ${i === safeIndex ? theme.palette.text.primary : theme.palette.divider}`,
                    overflow: 'hidden',
                    ...checker,
                  }}
                >
                  <img src={src} alt={`Propuesta ${i + 1}`} style={{ width: '100%', height: '100%', maxHeight: 120, objectFit: 'cover', display: 'block' }} />
                </Box>
              ))}
            </Box>
          </Box>
        )}

        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          maxWidth="xl"
          fullWidth
          PaperProps={{
            sx: { 
              bgcolor: 'transparent', 
              boxShadow: 'none',
              overflow: 'hidden',
              borderRadius: 0,
            },
          }}
        >
          <DialogContent sx={{ p: 0, position: 'relative', display: 'flex', justifyContent: 'center', bgcolor: 'black' }}>
            <IconButton
              onClick={() => setOpenDialog(false)}
              sx={{
                position: 'absolute',
                right: 24,
                top: 24,
                color: 'white',
                border: '1px solid white',
                borderRadius: 0,
                '&:hover': { bgcolor: 'white', color: 'black' },
                zIndex: 10,
              }}
            >
              <CloseIcon />
            </IconButton>
            {selectedImage && (
              <img
                src={selectedImage}
                alt="Full size"
                style={{
                  maxWidth: '100%',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default GeneratedImages;
