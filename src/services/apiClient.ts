import { DishParameters } from '../types';
import { compressImage } from '../utils/imageUtils';
import { supabase } from './supabase';
import { publishCredits } from './credits';
import { buildPrompt, buildRecipePrompt } from './promptBuilder';

// Cliente de los endpoints del servidor (/api/*). La clave de OpenAI vive solo en Vercel: aquí solo viaja la sesión de Google.

export const QUALITIES = [
  { value: 'low', label: 'Borrador (1 crédito)', credits: 1 },
  { value: 'medium', label: 'Buena (4 créditos)', credits: 4 },
  { value: 'high', label: 'Máxima (15 créditos)', credits: 15 },
] as const;

/** Créditos que costará una imagen con esta calidad y tamaño (el servidor es quien manda; esto es solo para mostrarlo). */
export const imageCost = (quality: string | undefined, imageSize: string | undefined): number => {
  const base = QUALITIES.find((q) => q.value === quality)?.credits ?? 1;
  return imageSize === '2K' ? base * 2 : base;
};

export class ApiError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

const post = async (path: string, body: Record<string, unknown>): Promise<Record<string, any>> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const ownerId = data.session?.user.id;
  if (!token || !ownerId) throw new ApiError('Tu sesión venció. Vuelve a entrar.', 'unauthenticated');

  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 'network');
  }
  let out: Record<string, any> = {};
  try {
    out = await res.json();
  } catch {
    /* respuesta sin JSON (p. ej. 413 de la plataforma) */
  }
  if (typeof out?.remaining === 'number') publishCredits(out.remaining, ownerId);
  if (!res.ok) {
    const fallback = res.status === 413 ? 'Las fotos son demasiado pesadas.' : 'No se pudo completar la solicitud.';
    throw new ApiError(typeof out?.message === 'string' ? out.message : fallback, out?.error);
  }
  return out;
};

/** Reduce la foto antes de enviarla: el servidor acepta ≈750 KB por imagen y 4,5 MB por solicitud. */
const shrink = (img: string) => compressImage(img, 1280, 0.82);

/** Detecta los ingredientes de una foto de plato (no cobra créditos). */
export const analyzeImage = async (imageBase64: string): Promise<string> => {
  const out = await post('/api/analyze-image', { image: await shrink(imageBase64) });
  return String(out.ingredients ?? '');
};

const imageRequest = async (prompt: string, parameters: DishParameters, refs: { role: string; data?: string }[]): Promise<string[]> => {
  const images: { role: string; data: string }[] = [];
  for (const r of refs) if (r.data) images.push({ role: r.role, data: await shrink(r.data) });
  const out = await post('/api/generate-image', {
    prompt,
    images,
    aspectRatio: parameters.aspectRatio,
    // El servidor solo llega hasta 2K (límite de 4,5 MB por respuesta).
    imageSize: parameters.imageSize === '2K' ? '2K' : '1K',
    quality: parameters.quality || 'low',
  });
  if (typeof out.image !== 'string') throw new ApiError('No se generó la imagen. Inténtalo de nuevo.');
  return [out.image];
};

/** Mejora la foto de un plato (con las referencias opcionales de plato, mesa, restaurante y cubiertos). */
export const generateGourmetVariants = (imageBase64: string, parameters: DishParameters, ingredients: string): Promise<string[]> =>
  imageRequest(buildPrompt(parameters, ingredients, false), parameters, [
    { role: 'dish', data: imageBase64 },
    { role: 'plate', data: parameters.plateImage },
    { role: 'table', data: parameters.tableImage },
    { role: 'restaurant', data: parameters.restaurantImage },
    { role: 'cutlery', data: parameters.cutleryImage },
  ]);

/** Crea un plato desde cero a partir de una idea. */
export const generateImageFromPrompt = (input: string, parameters: DishParameters): Promise<string[]> =>
  imageRequest(buildPrompt(parameters, input, true), parameters, []);

/** Genera la receta (Markdown) que coincide con el plato. Cuesta 1 crédito. */
export const generateRecipe = async (input: string, parameters: DishParameters, ingredientsString: string = ''): Promise<string> => {
  const out = await post('/api/generate-recipe', { prompt: buildRecipePrompt(input, parameters, ingredientsString) });
  return String(out.recipe ?? '');
};
