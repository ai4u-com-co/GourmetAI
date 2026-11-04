import { DishParameters } from '../types';

// Utilidades para manejar metadata en imágenes

interface Metadata {
  parameters: DishParameters;
  seed: number;
  ingredients: string;
  timestamp: string;
  app: string;
  version: string;
}

/**
 * Crea un objeto con metadata para incrustar en imágenes
 * @param {DishParameters} parameters - Parámetros de generación
 * @param {number} seed - Semilla de generación
 * @param {string} ingredients - Ingredientes detectados
 * @returns {Metadata} - Objeto con metadata
 */
export const createMetadata = (parameters: DishParameters, seed: number, ingredients: string): Metadata => {
  return {
    parameters,
    seed,
    ingredients,
    timestamp: new Date().toISOString(),
    app: 'VisualFeast',
    version: '1.0.0'
  };
};

/**
 * Convierte metadata a string JSON para incrustar
 * @param {Metadata} metadata - Objeto de metadata
 * @returns {string} - JSON string
 */
export const metadataToJSON = (metadata: Metadata): string => {
  return JSON.stringify(metadata, null, 2);
};

/**
 * Descarga una imagen junto con su archivo de metadata
 * @param {string} imageUrl - URL de la imagen
 * @param {Metadata} metadata - Metadata a guardar
 * @param {string} baseFilename - Nombre base del archivo (sin extensión)
 */
export const downloadImageWithMetadata = async (imageUrl: string, metadata: Metadata, baseFilename: string = 'gourmet-image', extension: string = 'png'): Promise<void> => {
  try {
    // Descargar imagen usando método mejorado para data URIs
    let imageBlobUrl: string;
    
    if (imageUrl.startsWith('data:')) {
      // Convertir data URI a Blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      imageBlobUrl = URL.createObjectURL(blob);
    } else {
      imageBlobUrl = imageUrl;
    }
    
    const imageLink = document.createElement('a');
    imageLink.href = imageBlobUrl;
    imageLink.download = `${baseFilename}.${extension}`;
    imageLink.style.display = 'none';
    document.body.appendChild(imageLink);
    imageLink.click();
    document.body.removeChild(imageLink);
    
    // Limpiar blob URL si se creó
    if (imageUrl.startsWith('data:')) {
      setTimeout(() => {
        URL.revokeObjectURL(imageBlobUrl);
      }, 100);
    }

    // Descargar metadata
    const metadataBlob = new Blob([metadataToJSON(metadata)], {
      type: 'application/json'
    });
    const metadataUrl = URL.createObjectURL(metadataBlob);
    const metadataLink = document.createElement('a');
    metadataLink.href = metadataUrl;
    metadataLink.download = `${baseFilename}-metadata.json`;
    metadataLink.style.display = 'none';
    document.body.appendChild(metadataLink);
    metadataLink.click();
    document.body.removeChild(metadataLink);
    
    // Limpiar URL temporal
    setTimeout(() => {
      URL.revokeObjectURL(metadataUrl);
    }, 100);
  } catch (error) {
    console.error('Error descargando imagen con metadata:', error);
    throw error;
  }
};
