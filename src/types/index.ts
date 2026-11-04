export interface DishParameters {
  intensidadGourmet: number;
  estiloPlato: string;
  iluminacion: string;
  fondo: string;
  decoracionesExtra: string[];
  anguloCamara: string;
  tipoVajilla: string;
  colorVajilla: string;
  ambiente: string;
  momentoDelDia: string;
  profundidadCampo: string;
  aspectRatio: string;
  efectoVapor: string;
  efectoFrescura: string;
  direccionLuz?: string;
  props?: string[];
  saturacion?: string;
  texturaFondo?: string;
  imageSize?: string; // 1K | 2K | custom (con customSize)
  quality?: string; // low | medium | high | xhigh | max — define cuántos créditos cuesta la imagen
  numberOfImages?: number; // variantes del mismo plato (1–4)
  model?: string; // sunburst (preciso) | flare (rápido)
  format?: string; // jpeg | webp | png
  background?: string; // auto | opaque | transparent (recorte)
  moderation?: string; // auto | low (solo admin)
  customSize?: string; // "1280x720" cuando imageSize === custom
  cuisineType?: string[];
  dishCategory?: string[];
  cookingTechnique?: string[];
  culinaryTags?: string[];
  ingredients?: string;
  plateImage?: string;
  tableImage?: string;
  restaurantImage?: string;
  cutleryImage?: string;
}

export interface GenerationResult {
  generatedImages: string[];
  ingredients: string;
  recipe?: string | null;
  parameters: DishParameters;
  seed: number;
}

export interface HistoryItem extends GenerationResult {
  id: string;
  timestamp: string;
  type: 'improvement' | 'scratch';
  originalImage?: string;
  idea?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  ingredients?: string;
  image?: string;
  recipe?: string;
}
