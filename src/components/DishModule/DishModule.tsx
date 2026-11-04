import React, { useState } from 'react';
import { Box, Tab, Tabs, Paper } from '@mui/material';
import FromScratch from './FromScratch';
import FromPhoto from './FromPhoto';
import DishPreview from './DishPreview';
import History from '../History';
import useImageGeneration from '../../hooks/useImageGeneration';
import { 
  INTENSIDAD_GOURMET_DEFAULT, 
  ESTILOS_PLATO, 
  ILUMINACIONES, 
  FONDOS, 
  ANGULOS_CAMARA, 
  TIPOS_VAJILLA, 
  COLORES_VAJILLA, 
  AMBIENTES, 
  MOMENTOS_DIA, 
  PROFUNDIDADES_CAMPO, 
  ASPECT_RATIOS, 
  DEFAULT_IMAGE_SIZE,
  DEFAULT_QUALITY,
  EFECTOS_VAPOR, 
  EFECTOS_FRESCURA 
} from '../../constants/parameters';
import { DishParameters } from '../../types';
import { CHEAPEST } from '../../services/imageOptions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = (props) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const DishModule: React.FC = () => {
  const [tabValue, setTabValue] = useState<number>(0);
  
  const [parameters, setParameters] = useState<DishParameters>({
    intensidadGourmet: INTENSIDAD_GOURMET_DEFAULT,
    estiloPlato: ESTILOS_PLATO[0].value,
    iluminacion: ILUMINACIONES[0].value,
    fondo: FONDOS[0].value,
    decoracionesExtra: [],
    anguloCamara: ANGULOS_CAMARA[0].value,
    tipoVajilla: TIPOS_VAJILLA[0].value,
    colorVajilla: COLORES_VAJILLA[0].value,
    ambiente: AMBIENTES[0].value,
    momentoDelDia: MOMENTOS_DIA[0].value,
    profundidadCampo: PROFUNDIDADES_CAMPO[0].value,
    aspectRatio: ASPECT_RATIOS[0].value,
    imageSize: DEFAULT_IMAGE_SIZE,
    quality: DEFAULT_QUALITY,
    numberOfImages: CHEAPEST.numberOfImages,
    model: CHEAPEST.model,
    format: CHEAPEST.format,
    background: CHEAPEST.background,
    moderation: CHEAPEST.moderation,
    customSize: CHEAPEST.customSize,
    efectoVapor: EFECTOS_VAPOR[0].value,
    efectoFrescura: EFECTOS_FRESCURA[0].value,
    props: [],
    cuisineType: [],
    dishCategory: [],
    cookingTechnique: [],
    culinaryTags: [],
    plateImage: '',
    tableImage: '',
    restaurantImage: '',
    cutleryImage: ''
  });

  const {
    generate,
    generateFromScratch,
    fetchRecipe,
    isGenerating,
    isRecipeGenerating,
    error,
    generatedImages,
    ingredients,
    recipe,
    lastSeed,
    lastParameters
  } = useImageGeneration();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleParameterChange = (newParams: Partial<DishParameters>) => {
    setParameters(prev => ({ ...prev, ...newParams }));
  };

  return (
    <Box>
      {/* Sección de Parámetros */}
      <Paper elevation={0} sx={{ bgcolor: 'transparent', mb: 6 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            aria-label="dish creation modes"
            variant="fullWidth"
            textColor="primary"
            indicatorColor="primary"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              '& .MuiTab-root': {
                textTransform: 'uppercase',
                fontWeight: 700,
                letterSpacing: '0.1em',
                fontSize: '0.8rem',
                py: 2
              }
            }}
          >
            <Tab label="Diseñar" />
            <Tab label="Fotografía" />
            <Tab label="Historial" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <FromScratch 
            parameters={parameters}
            onParameterChange={handleParameterChange}
            onGenerate={generateFromScratch}
            isGenerating={isGenerating}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <FromPhoto 
            parameters={parameters}
            onParameterChange={handleParameterChange}
            onGenerate={generate}
            isGenerating={isGenerating}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <History />
        </TabPanel>
      </Paper>

      {/* Sección de Generaciones */}
      <Box 
        sx={{ 
          display: 'flex', 
          flexDirection: 'column',
          mt: 4
        }}
      >
        <DishPreview
          images={generatedImages}
          isLoading={isGenerating}
          error={error}
          parameters={lastParameters}
          seed={lastSeed}
          ingredients={ingredients}
          recipe={recipe}
          onGenerateRecipe={fetchRecipe}
          isRecipeLoading={isRecipeGenerating}
        />
      </Box>
    </Box>
  );
};

export default DishModule;
