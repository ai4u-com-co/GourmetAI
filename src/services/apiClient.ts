import { DishParameters } from '../types';
import { compressImage } from '../utils/imageUtils';
import { supabase } from './supabase';
import { publishCredits } from './credits';
import { logError } from '../utils/logger';
import { buildPrompt, buildRecipePrompt } from './promptBuilder';
import { imageRequestOptions } from './imageOptions.ts';

// Cliente de los endpoints del servidor (/api/*). La clave de OpenAI vive solo en Vercel: aquí solo viaja la sesión de Google.
// El costo en créditos que se muestra sale de `estimateImage` (imageOptions.ts), el mismo cálculo del servidor.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly requestId?: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Texto para mostrar a la persona: el mensaje y, si hay, la referencia que soporte puede buscar en los logs. */
export const describeError = (err: unknown, fallback: string): string => {
  const e = err as { message?: string; requestId?: string } | null;
  const msg = e?.message || fallback;
  return e?.requestId ? `${msg} (ref. ${e.requestId})` : msg;
};

const friendlyStatus = (status: number): string => {
  if (status === 401) return 'Tu sesión venció. Vuelve a entrar.';
  if (status === 404) return 'No se encontró el servicio. Recarga la página e inténtalo de nuevo.';
  if (status === 413) return 'Las fotos son demasiado pesadas.';
  if (status === 429) return 'Hay demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en un momento.';
  return 'No se pudo completar la solicitud.';
};

const post = async (path: string, body: Record<string, unknown>): Promise<Record<string, any>> => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const ownerId = data.session?.user.id;
  if (!token || !ownerId) {
    const e = new ApiError('Tu sesión venció. Vuelve a entrar.', 'unauthenticated');
    logError('api_no_session', e, { path });
    throw e;
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    const e = new ApiError('No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.', 'network');
    logError('api_network', cause, { path, code: 'network' });
    throw e;
  }
  let out: Record<string, any> = {};
  try {
    out = await res.json();
  } catch {
    /* respuesta sin JSON (p. ej. 413 de la plataforma) */
  }
  if (typeof out?.remaining === 'number') publishCredits(out.remaining, ownerId);
  if (!res.ok) {
    // Si la respuesta no es el JSON de nuestro servidor (por ejemplo, un fallo de la plataforma), se usa un mensaje claro por estado.
    const requestId = (typeof out?.requestId === 'string' ? out.requestId : undefined) ?? res.headers.get('x-request-id') ?? undefined;
    const e = new ApiError(typeof out?.message === 'string' ? out.message : friendlyStatus(res.status), typeof out?.error === 'string' ? out.error : undefined, requestId, res.status);
    logError('api_error', e, { path, code: e.code, status: res.status, requestId });
    throw e;
  }
  return out;
};

/** Reduce la foto antes de enviarla: el servidor acepta ≈750 KB por imagen y 4,5 MB por solicitud. */
const shrink = (img: string) => compressImage(img, 1280, 0.82);

/** Detecta los ingredientes de una foto de plato (cuesta 1 crédito). */
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
    // Modelo, calidad, formato, tamaño, formato de salida, fondo y variantes; un valor desconocido cae en lo más económico.
    ...imageRequestOptions(parameters),
  });
  // `images` trae todas las variantes; `image` (la primera) queda por compatibilidad con respuestas anteriores.
  const list: string[] = Array.isArray(out.images) ? out.images.filter((x: unknown): x is string => typeof x === 'string') : typeof out.image === 'string' ? [out.image] : [];
  if (list.length === 0) {
    const e = new ApiError('No se generó la imagen. Inténtalo de nuevo.', 'empty_image', typeof out.requestId === 'string' ? out.requestId : undefined);
    logError('api_empty_image', e);
    throw e;
  }
  return list;
};

/** Mejora la foto de un plato (con las referencias opcionales de plato, mesa, restaurante y cubiertos). */
export const generateGourmetVariants = (imageBase64: string, parameters: DishParameters, ingredients: string): Promise<string[]> =>
  imageRequest(buildPrompt(parameters, ingredients, false), parameters, [
    { role: 'dish', data: imageBase64 },
    { role: 'plate', data: parameters.plateImage },
    // En un recorte (fondo transparente) no hay mesa ni ambiente: esas fotos no se envían ni se cobran.
    { role: 'table', data: parameters.background === 'transparent' ? undefined : parameters.tableImage },
    { role: 'restaurant', data: parameters.background === 'transparent' ? undefined : parameters.restaurantImage },
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
