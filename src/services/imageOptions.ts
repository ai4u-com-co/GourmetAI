import type { DishParameters } from '../types';
import {
  ASPECTS,
  BACKGROUNDS,
  DEFAULTS,
  FORMATS,
  IMAGE_MODELS,
  MAX_N,
  QUALITIES,
  TIERS,
  dataUrlDimensions,
  resolveImageOptions,
  type Resolved,
} from './openai-image-core.ts';

// Opciones de GPT Image 2.5 que la persona puede elegir, con su texto en español. Todo arranca en lo más económico
// (DEFAULTS del núcleo compartido). El costo en créditos y la validación salen de `resolveImageOptions`, la MISMA función que usa el servidor.

export interface Choice<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

export const MODEL_CHOICES: Choice[] = [
  { value: 'sunburst', label: 'Sunburst · Preciso', hint: 'Para la entrega final y cuando hay fotos de referencia: respeta mejor tu plato.' },
  { value: 'flare', label: 'Flare · Rápido', hint: 'Para explorar ideas: cuesta lo mismo, pero responde más rápido.' },
];

export const QUALITY_CHOICES: Choice[] = [
  { value: 'low', label: 'Borrador', hint: 'Para probar encuadres, vajilla y luz. Lo más económico.' },
  { value: 'medium', label: 'Estándar', hint: 'Buen detalle para publicar: texturas de salsas, migas y brillos.' },
  { value: 'high', label: 'Alta', hint: 'Detalle fino. Súbela solo si el Estándar no resolvió algo concreto.' },
  { value: 'xhigh', label: 'Muy alta', hint: 'Entrega de impresión; tarda 30 s o más.' },
  { value: 'max', label: 'Máxima', hint: 'El máximo detalle; puede tardar más de 60 s y cuesta bastante.' },
];

export const TIER_CHOICES: Choice[] = [
  { value: '1K', label: '1K · Estándar' },
  { value: '2K', label: '2K · Alta resolución' },
  { value: 'custom', label: 'Personalizado' },
];

export const FORMAT_CHOICES: Choice[] = [
  { value: 'jpeg', label: 'JPEG', hint: 'Liviano, ideal para redes y web.' },
  { value: 'webp', label: 'WebP', hint: 'Más liviano aún; admite transparencia.' },
  { value: 'png', label: 'PNG', hint: 'Sin pérdida, pero pesa más (límite de tamaño más bajo).' },
];

export const BACKGROUND_CHOICES: Choice[] = [
  { value: 'auto', label: 'Automático', hint: 'El modelo decide según tu plato y tu mesa.' },
  { value: 'opaque', label: 'Opaco', hint: 'Siempre con fondo sólido.' },
  { value: 'transparent', label: 'Transparente (recorte)', hint: 'Solo el plato, sin mesa ni sombra: ideal para menús y pantallas. Se guarda en WebP o PNG.' },
];

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** Opciones del servidor a partir de los parámetros. Un valor inexistente (p. ej. de un historial viejo) cae en lo más económico. */
export const imageRequestOptions = (p: DishParameters): Record<string, unknown> => {
  const tier = pick(p.imageSize, [...TIERS, 'custom'] as const, DEFAULTS.tier);
  const n = Number(p.numberOfImages);
  const out: Record<string, unknown> = {
    model: pick(p.model, Object.keys(IMAGE_MODELS) as (keyof typeof IMAGE_MODELS)[], DEFAULTS.model),
    quality: pick(p.quality, QUALITIES, DEFAULTS.quality),
    aspectRatio: pick(p.aspectRatio, ASPECTS, '1:1'),
    imageSize: tier,
    format: pick(p.format, FORMATS, DEFAULTS.format),
    background: pick(p.background, BACKGROUNDS, DEFAULTS.background),
    n: Number.isInteger(n) && n >= 1 && n <= MAX_N ? n : DEFAULTS.n,
  };
  if (tier === 'custom') out.size = typeof p.customSize === 'string' ? p.customSize : '';
  if (p.moderation === 'low') out.moderation = 'low'; // solo la ofrece la interfaz a admins; el servidor lo vuelve a verificar
  return out;
};

/** Píxeles de una foto tal como saldrá del navegador (se reduce a 1280 px de ancho antes de enviarla; ver apiClient.shrink). */
export const inputPixelsOf = (dataUrl: string | null | undefined, maxWidth = 1280): number => {
  if (!dataUrl) return 0;
  const d = dataUrlDimensions(dataUrl);
  if (!d) return maxWidth * 960; // no se pudo leer la cabecera: estimación de una foto típica
  const w = Math.min(d.width, maxWidth);
  const h = d.width > maxWidth ? Math.floor((d.height * maxWidth) / d.width) : d.height;
  return Math.max(1, w) * Math.max(1, h);
};

/** Costo y validación de la solicitud, con el mismo cálculo del servidor. `inputPixels`: una entrada por foto que se enviará. */
export const estimateImage = (p: DishParameters, inputPixels: number[], isAdmin: boolean): Resolved =>
  resolveImageOptions(imageRequestOptions(p), { inputImagePixels: inputPixels.filter((x) => x > 0), isAdmin, estimate: true });

/** Un resumen corto de las opciones elegidas, para la cabecera del panel. */
export const summarize = (p: DishParameters): string => {
  const o = imageRequestOptions(p);
  const q = QUALITY_CHOICES.find((c) => c.value === o.quality)?.label ?? '';
  const m = o.model === 'flare' ? 'Flare' : 'Sunburst';
  const size = o.imageSize === 'custom' ? String(o.size || 'personalizado') : `${o.aspectRatio} · ${o.imageSize}`;
  const n = o.n as number;
  return [m, q, size, String(o.format).toUpperCase(), o.background === 'transparent' ? 'recorte' : '', n > 1 ? `${n} variantes` : '1 variante']
    .filter(Boolean)
    .join(' · ');
};

/** ¿Las opciones son las más económicas de siempre? */
export const isCheapest = (p: DishParameters): boolean => {
  const o = imageRequestOptions(p);
  return (
    o.model === DEFAULTS.model && o.quality === DEFAULTS.quality && o.imageSize === DEFAULTS.tier && o.format === DEFAULTS.format &&
    o.background === DEFAULTS.background && o.n === DEFAULTS.n && o.moderation === undefined
  );
};

/** Las opciones más económicas, listas para mezclar en los parámetros ("Volver a lo más económico"). Conserva el formato (destino). */
export const CHEAPEST: Pick<DishParameters, 'model' | 'quality' | 'imageSize' | 'customSize' | 'format' | 'background' | 'numberOfImages' | 'moderation'> = {
  model: DEFAULTS.model,
  quality: DEFAULTS.quality,
  imageSize: DEFAULTS.tier,
  customSize: '',
  format: DEFAULTS.format,
  background: DEFAULTS.background,
  numberOfImages: DEFAULTS.n,
  moderation: DEFAULTS.moderation,
};

/** Extensión de archivo según el tipo de la imagen (data URL). */
export const extensionOf = (dataUrl: string): string => {
  const m = /^data:image\/(png|jpeg|webp)/.exec(dataUrl);
  return m ? (m[1] === 'jpeg' ? 'jpg' : m[1]) : 'png';
};
