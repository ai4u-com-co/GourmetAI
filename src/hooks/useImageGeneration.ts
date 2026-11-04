import { useState, useCallback } from 'react';
import { analyzeImage, generateGourmetVariants, generateImageFromPrompt, generateRecipe } from '../services/apiClient';
import { saveToHistory } from '../utils/historyService';
import { DishParameters } from '../types';

const useImageGeneration = () => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isRecipeGenerating, setIsRecipeGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [ingredients, setIngredients] = useState<string>('');
  const [recipe, setRecipe] = useState<string | null>(null);
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [lastParameters, setLastParameters] = useState<DishParameters | null>(null);
  const [lastIdea, setLastIdea] = useState<string | null>(null); 

  const generate = useCallback(async (imageBase64: string, parameters: DishParameters) => {
    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setRecipe(null);

    try {
      // Paso 1: Analizar imagen y detectar ingredientes
      const detectedIngredients = await analyzeImage(imageBase64);
      setIngredients(detectedIngredients);

      // Paso 2: Generar imagen gourmet (parameters incluye plateImage si se proporcionó)
      const variants = await generateGourmetVariants(
        imageBase64,
        parameters,
        detectedIngredients
      );

      if (!variants || variants.length === 0) {
        throw new Error('No se generó la imagen. Por favor, intenta de nuevo.');
      }

      setGeneratedImages(variants);
      setLastParameters(parameters);
      
      const seed = Date.now();
      setLastSeed(seed);

      // Guardar en historial local
      saveToHistory({
        type: 'improvement',
        originalImage: imageBase64,
        generatedImages: variants,
        ingredients: detectedIngredients,
        parameters,
        seed
      });

      return { variants, ingredients: detectedIngredients, seed };
    } catch (err: any) {
      const errorMessage = err.message || 'Error al generar las imágenes gourmet';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const generateFromScratch = useCallback(async (ingredientsList: string[], idea: string, parameters: DishParameters) => {
    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setRecipe(null);

    try {
      let input = '';
      if (idea) input += `Concepto: ${idea}. `;
      
      const getParamValue = (param: string | string[] | undefined): string => {
        if (!param) return '';
        return Array.isArray(param) ? param.join(', ') : param;
      };

      if (parameters.cuisineType && parameters.cuisineType.length > 0) {
        input += `Tipo de cocina: ${getParamValue(parameters.cuisineType)}. `;
      }
      if (parameters.dishCategory && parameters.dishCategory.length > 0) {
        input += `Categoría de plato: ${getParamValue(parameters.dishCategory)}. `;
      }
      if (parameters.cookingTechnique && parameters.cookingTechnique.length > 0) {
        input += `Técnica principal: ${getParamValue(parameters.cookingTechnique)}. `;
      }
      if (parameters.culinaryTags && parameters.culinaryTags.length > 0) {
        input += `Tags: ${parameters.culinaryTags.join(', ')}. `;
      }

      if (ingredientsList && ingredientsList.length > 0) {
        input += `Ingredientes: ${ingredientsList.join(', ')}.`;
      }

      const ingredientsStr = ingredientsList.join(', ');
      setIngredients(ingredientsStr);

      const variants = await generateImageFromPrompt(input, parameters);

      if (!variants || variants.length === 0) {
        throw new Error('No se generó la imagen. Por favor, intenta de nuevo.');
      }

      setGeneratedImages(variants);
      setLastParameters(parameters);
      setLastIdea(idea); 
      
      const seed = Date.now();
      setLastSeed(seed);

      // Guardar en historial local
      saveToHistory({
        type: 'scratch',
        idea,
        generatedImages: variants,
        ingredients: ingredientsStr,
        parameters,
        seed
      });

      return { variants, seed };
    } catch (err: any) {
      const errorMessage = err.message || 'Error al generar la imagen desde cero';
      setError(errorMessage);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const fetchRecipe = useCallback(async () => {
      if (!lastParameters || !generatedImages.length) {
        return;
      }
      
      setIsRecipeGenerating(true);
      setError(null); 
      
      try {
        let input = '';
        
        if (lastIdea && lastIdea.trim()) {
          input = lastIdea;
        } else {
          const getParamValue = (param: string | string[] | undefined): string => {
            if (!param) return '';
            return Array.isArray(param) ? param.join(', ') : param;
          };
          
          if (lastParameters.cuisineType && lastParameters.cuisineType.length > 0) {
            input += `Tipo de cocina: ${getParamValue(lastParameters.cuisineType)}. `;
          }
          if (lastParameters.dishCategory && lastParameters.dishCategory.length > 0) {
            input += `Categoría de plato: ${getParamValue(lastParameters.dishCategory)}. `;
          }
          if (ingredients && ingredients.trim()) {
            input += `Ingredientes: ${ingredients}. `;
          }
          
          if (!input.trim()) {
            input = 'Plato gourmet personalizado';
          }
        }
        
        const generatedRecipe = await generateRecipe(input, lastParameters, ingredients);
        
        if (generatedRecipe && generatedRecipe.trim().length > 0) {
          setRecipe(generatedRecipe);
        } else {
          setRecipe(null);
          setError('La receta generada está vacía. Por favor, intenta de nuevo.');
        }
      } catch (err: any) {
          console.error("❌ Error fetching recipe:", err);
          setError("No se pudo generar la receta: " + (err.message || 'Error desconocido'));
          setRecipe(null);
      } finally {
          setIsRecipeGenerating(false);
      }
  }, [lastParameters, generatedImages, ingredients, lastIdea]);

  const reset = useCallback(() => {
    setGeneratedImages([]);
    setError(null);
    setIngredients('');
    setRecipe(null);
    setLastSeed(null);
    setLastParameters(null);
    setLastIdea(null);
  }, []);

  return {
    generate,
    generateFromScratch,
    fetchRecipe,
    reset,
    isGenerating,
    isRecipeGenerating,
    error,
    generatedImages,
    ingredients,
    recipe,
    lastSeed,
    lastParameters
  };
};

export default useImageGeneration;
