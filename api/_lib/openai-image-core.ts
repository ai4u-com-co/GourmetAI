// NÚCLEO COMPARTIDO de GPT Image 2.5 para todas las apps de `apps` (designAgent, DreamHouse, FlyerStudio, GourmetAI).
// FUENTE ÚNICA: ~/apps-platform/packages/openai-image/openai-image-core.ts. Cada repo lleva una copia idéntica
// (junto con `openai-image-server.ts`); `node packages/openai-image/check-sync.mjs <archivo…>` avisa si una copia se desalineó.
// Este archivo es PURO (sin dependencias): sirve en el navegador (estimar costo) y en el servidor. Lo que usa `node:crypto`
// vive en `openai-image-server.ts` (solo servidor).
//
// Todo lo de aquí se VERIFICÓ contra la API real el 4-nov-2026 (clave del proyecto, calidad mínima y 1024x640):
//   · aceptados: model sunburst|flare, quality low|medium|high|xhigh|max|auto, output_format jpeg|webp|png,
//     output_compression, background transparent (webp/png), n, moderation low, safety_identifier, size 1920x1920.
//   · rechazados: input_fidelity (unknown_parameter), ratio > 3:1 (invalid_value).
//   · tokens de salida (low): 107 a 1024x640 · 110 a 1360x768 · 158 a 1536x1024 · 205 a 2560x1440 · y CUADRADOS más caros: 196 a 1024², 364 a 1920².
//     medium ×2,25 · high ×8,95 · xhigh ×15,9 · max ×35,7 (iguales en todos los tamaños). Sunburst y Flare consumen LOS MISMOS tokens; Flare es más rápido.
//   · tokens de ENTRADA: imagen ≈ píxeles/1024 entre 640 y 1536 (4000x3000 → 1452); el texto del prompt cuenta (US$5/M).

export const IMAGE_MODELS = { sunburst: 'gpt-image-2.5-sunburst', flare: 'gpt-image-2.5-flare' } as const;
export type ImageModelKey = keyof typeof IMAGE_MODELS;
/** Respaldo si la cuenta no tuviera aún 2.5 (404/model_not_found). */
export const FALLBACK_MODEL = 'gpt-image-2';

export const QUALITIES = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ImageQualityKey = (typeof QUALITIES)[number];
export const FORMATS = ['jpeg', 'webp', 'png'] as const;
export type ImageFormat = (typeof FORMATS)[number];
export const BACKGROUNDS = ['auto', 'opaque', 'transparent'] as const;
export type ImageBackground = (typeof BACKGROUNDS)[number];
export const MODERATIONS = ['auto', 'low'] as const;
export const TIERS = ['1K', '2K'] as const;
export type SizeTier = (typeof TIERS)[number];
export const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'] as const;

/** Valores por defecto de TODAS las apps: lo más económico. Subir es decisión explícita de quien usa la app. */
export const DEFAULTS = { model: 'sunburst', quality: 'low', tier: '1K', format: 'jpeg', background: 'auto', moderation: 'auto', n: 1 } as const;

export const MIN_PIXELS = 655_360;
/** 2560x1440: por encima OpenAI marca la salida como experimental. */
export const MAX_PIXELS = 3_686_400;
export const MAX_EDGE = 3840;
export const MAX_RATIO = 3;
export const MAX_N = 4;

// ── Calibración MEDIDA con la API real (4-nov-2026; sunburst y flare idénticos; cada punto es una llamada real) ──
// Tokens de SALIDA a calidad low: DEPENDEN DEL TAMAÑO Y DE LA FORMA (los cuadrados cuestan más que los apaisados de igual área).
const LOW_SQUARE: [number, number][] = [[1_048_576, 196], [1_327_104, 213], [2_359_296, 279], [2_768_896, 306], [3_686_400, 364]]; // 1024²…1920²
const LOW_WIDE: [number, number][] = [[655_360, 107], [921_600, 106], [1_044_480, 110], [1_572_864, 158], [2_359_296, 157], [3_686_400, 205]]; // 1024x640…2560x1440
/** Multiplicador sobre low (idéntico en todos los tamaños probados: medium 439/196 y 256/110; high 1756/196 y 987/110; xhigh y max a 1024x640). */
const QUALITY_MULT: Record<ImageQualityKey, number> = { low: 1, medium: 2.25, high: 8.95, xhigh: 15.9, max: 35.7 };
/** Precios por millón de tokens (US$): salida de imagen 30, entrada de imagen 8, entrada de texto 5. */
export const USD_PER_TOKEN = { imageOut: 30 / 1e6, imageIn: 8 / 1e6, textIn: 5 / 1e6 } as const;
/** 1 crédito = US$0,0045 (150 tokens de salida de imagen). */
export const USD_PER_CREDIT = 0.0045;
/** Imágenes de ENTRADA: ≈ píxeles/1024 tokens entre 640 y 1536; OpenAI las escala (4000x3000 → 1452; 512² → 1024; 1024x640 → 640). */
export const MAX_INPUT_IMAGE_TOKENS = 1536;
export function inputImageTokens(pixels: number): number {
  if (pixels < 655_360) return 1024;
  return Math.min(MAX_INPUT_IMAGE_TOKENS, Math.ceil(pixels / 1024));
}
/**
 * Tokens de texto de un prompt: 1 por cada 3 BYTES UTF-8 (cota conservadora: el inglés ronda 4 bytes/token, el español ~3 y los
 * alfabetos no latinos o los emojis usan varios bytes por carácter). El servidor pasa `Buffer.byteLength(prompt)`.
 */
export const textTokens = (bytes: number): number => Math.ceil(Math.max(0, bytes) / 3);
/** Tamaño de prompt (bytes) que se asume SOLO al ESTIMAR en el navegador (`estimate: true`) antes de que exista el prompt final. */
export const DEFAULT_PROMPT_CHARS = 1000;
/** Tope de bytes de prompt que acepta el núcleo (los servidores ya acotan el suyo bastante por debajo). */
export const MAX_PROMPT_BYTES = 200_000;
/** Tope por imagen de entrada (2048x2048). El servidor lee las dimensiones REALES: no confía en que el navegador las reduzca. */
export const MAX_INPUT_IMAGE_PIXELS = 4_194_304;

/** Margen de la respuesta de una función de Vercel (4,5 MB): bytes por píxel típicos y base64 = ×4/3. */
const BYTES_PER_PIXEL: Record<string, number> = { jpeg: 0.5, webp: 0.35, 'webp-alpha': 0.75, png: 1.6, 'png-alpha': 1.6 };
export const MAX_RESPONSE_BASE64_BYTES = 3_900_000;

export interface ResolvedImageOptions {
  model: ImageModelKey;
  modelId: string;
  quality: ImageQualityKey;
  width: number;
  height: number;
  size: string;
  pixels: number;
  format: ImageFormat;
  /** undefined para png */
  compression: number | undefined;
  background: ImageBackground;
  moderation: 'auto' | 'low';
  n: number;
  /** Créditos que se cobran ANTES de llamar a OpenAI (salida × n + imágenes de entrada). */
  credits: number;
  estimatedOutputTokens: number;
  /** true si la solicitud usa algo reservado a admin (moderation: low); el núcleo ya exigió `ctx.isAdmin`. */
  adminOnly: boolean;
}

export type Resolved = { ok: true; value: ResolvedImageOptions } | { ok: false; code: string; message: string };

const fail = (code: string, message: string): Resolved => ({ ok: false, code, message });
const has = (o: object, k: unknown): k is string => typeof k === 'string' && Object.hasOwn(o, k);
const round16 = (x: number) => Math.max(16, Math.round(x / 16) * 16);
const floor16 = (x: number) => Math.max(16, Math.floor(x / 16) * 16);

/** Tamaño de un formato (relación) y una resolución (1K ≈ 1 MP, 2K = lado largo 2048 sin pasar de 3,69 MP). */
export function sizeForPreset(aspect: string, tier: SizeTier): { width: number; height: number } | null {
  if (!(ASPECTS as readonly string[]).includes(aspect)) return null;
  const [a, b] = aspect.split(':').map(Number);
  const r = a / b;
  if (tier === '1K') {
    // Tamaños recomendados por OpenAI para los tres formatos básicos
    if (aspect === '1:1') return { width: 1024, height: 1024 };
    if (aspect === '3:2') return { width: 1536, height: 1024 };
    if (aspect === '2:3') return { width: 1024, height: 1536 };
    const h = Math.sqrt(1_048_576 / r);
    return { width: round16(h * r), height: round16(h) };
  }
  let w = r >= 1 ? 2048 : 2048 * r;
  let h = r >= 1 ? 2048 / r : 2048;
  if (w * h > MAX_PIXELS) {
    const k = Math.sqrt(MAX_PIXELS / (w * h));
    w *= k;
    h *= k;
    return { width: floor16(w), height: floor16(h) };
  }
  return { width: round16(w), height: round16(h) };
}

export function validateCustomSize(width: number, height: number): string | null {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return 'El tamaño debe ser en píxeles enteros.';
  if (width % 16 !== 0 || height % 16 !== 0) return 'Cada lado debe ser múltiplo de 16.';
  if (width > MAX_EDGE || height > MAX_EDGE) return `El lado máximo es ${MAX_EDGE}px.`;
  if (Math.max(width, height) / Math.min(width, height) > MAX_RATIO) return 'La relación máxima es 3:1.';
  const px = width * height;
  if (px < MIN_PIXELS) return `Mínimo ${MIN_PIXELS.toLocaleString('es-CO')} píxeles (por ejemplo 1024x640).`;
  if (px > MAX_PIXELS) return `Máximo ${MAX_PIXELS.toLocaleString('es-CO')} píxeles (2560x1440); por encima la salida es experimental.`;
  return null;
}

function interpolate(table: [number, number][], px: number, belowScale: number): number {
  if (px <= table[0][0]) return table[0][1] * Math.pow(px / table[0][0], belowScale);
  for (let i = 1; i < table.length; i++) {
    if (px <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (px - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/** Tokens de salida de UNA imagen: curva de low según la forma (ratio < 1,4 → cuadrada, más cara) × multiplicador de calidad. */
export function estimateOutputTokens(quality: ImageQualityKey, width: number, height: number): number {
  const px = width * height;
  const squareish = Math.max(width, height) / Math.min(width, height) < 1.4;
  const low = squareish ? interpolate(LOW_SQUARE, px, 0.5) : interpolate(LOW_WIDE, px, 0);
  return Math.round(low * QUALITY_MULT[quality]);
}

export interface CostInput {
  quality: ImageQualityKey;
  width: number;
  height: number;
  n: number;
  /** píxeles REALES de cada imagen de entrada (incluida la máscara) */
  inputPixels?: number[];
  /** largo del prompt de texto que viaja a OpenAI (las imágenes y el texto de entrada se cobran por cada variante) */
  promptChars?: number;
}

/** Costo en US$ de una generación, con los precios por token de OpenAI (todo ×n: la API cobra la entrada por cada variante). */
export function estimateUsd(c: CostInput): number {
  const out = estimateOutputTokens(c.quality, c.width, c.height) * USD_PER_TOKEN.imageOut;
  const inImg = (c.inputPixels ?? []).reduce((sum, px) => sum + inputImageTokens(px), 0) * USD_PER_TOKEN.imageIn;
  const inTxt = textTokens(c.promptChars ?? DEFAULT_PROMPT_CHARS) * USD_PER_TOKEN.textIn;
  return (out + inImg + inTxt) * c.n;
}

/** Créditos de una generación: US$ / US$0,0045, redondeado hacia arriba con 0,1 de tolerancia (mínimo 1). */
export function creditsFor(c: CostInput): number {
  return Math.max(1, Math.ceil(estimateUsd(c) / USD_PER_CREDIT - 0.1));
}

/** Una imagen de entrada no puede pasar de ~1,5 MB (2.000.000 caracteres base64); el servidor ya lo impone, el lector también. */
export const MAX_DIMENSION_SCAN_CHARS = 2_000_000;

/**
 * Dimensiones de una imagen PNG, JPEG o WebP a partir de su data URL (o base64), SIN decodificarla y sin dependencias:
 * solo lee la cabecera. Devuelve null si no se reconoce el formato. Sirve en el navegador y en el servidor.
 */
export function dataUrlDimensions(input: string): { width: number; height: number } | null {
  const b64 = input.startsWith('data:') ? input.slice(input.indexOf(',') + 1) : input;
  let bytes: Uint8Array;
  try {
    // Se lee TODA la imagen (el servidor ya limita cada una a ~1 MB de base64): un decodificador distinto no debe poder ver
    // algo que este lector no vio (segundo SOF, otra imagen incrustada, lienzo ≠ cuadro…).
    if (b64.length > MAX_DIMENSION_SCAN_CHARS) return null; // no se analiza a medias: o se ve entera o se rechaza
    const bin = atob(b64);
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  const u32 = (o: number) => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  const u32le = (o: number) => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
  const ascii = (o: number, n: number) => String.fromCharCode(...bytes.slice(o, o + n));
  const ok = (width: number, height: number) => (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width < 2 ** 31 && height < 2 ** 31 ? { width, height } : null);

  // PNG: firma COMPLETA de 8 bytes + primer fragmento IHDR de longitud 13
  if (bytes.length >= 24 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => bytes[i] === x)) {
    if (u32(8) !== 13 || ascii(12, 4) !== 'IHDR') return null;
    return ok(u32(16), u32(20));
  }

  // WebP: RIFF....WEBP. Simple (VP8 / VP8L) o extendido (VP8X). En VP8X el lienzo DEBE coincidir con el cuadro del primer
  // fragmento de imagen y no se aceptan animaciones (sumarían más píxeles de los que declara el lienzo).
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const riffEnd = u32le(4) + 8;
    if (riffEnd > bytes.length || riffEnd < 20) return null; // tamaño del contenedor incoherente con los bytes recibidos
    const frameDims = (o: number): { width: number; height: number } | null => {
      const kind = ascii(o, 4);
      if (kind === 'VP8L' && bytes[o + 8] === 0x2f) {
        const bits = u32le(o + 9);
        return ok(1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff));
      }
      if (kind === 'VP8 ' && bytes[o + 11] === 0x9d && bytes[o + 12] === 0x01 && bytes[o + 13] === 0x2a) {
        return ok((bytes[o + 14] | (bytes[o + 15] << 8)) & 0x3fff, (bytes[o + 16] | (bytes[o + 17] << 8)) & 0x3fff);
      }
      return null;
    };
    const first = ascii(12, 4);
    if (first !== 'VP8X') return frameDims(12);
    if (u32le(16) !== 10) return null; // el fragmento VP8X mide siempre 10 bytes
    if (bytes[20] & 0x02) return null; // bandera de animación
    const canvas = ok(1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)));
    if (!canvas) return null;
    let o = 12 + 8 + 10; // después del fragmento VP8X
    while (o + 8 <= riffEnd) {
      const kind = ascii(o, 4);
      if (kind === 'ANMF' || kind === 'ANIM') return null;
      if (kind === 'VP8 ' || kind === 'VP8L') {
        const f = frameDims(o);
        return f && f.width === canvas.width && f.height === canvas.height ? canvas : null;
      }
      const size = u32le(o + 4);
      if (o + 8 + size > riffEnd) return null; // fragmento que se sale del contenedor
      o += 8 + size + (size & 1);
    }
    return null;
  }

  // JPEG: recorrido ESTRICTO. Debe haber EXACTAMENTE un SOF antes del SOS; después del SOS (datos comprimidos) no puede
  // aparecer otro SOF ni otro SOI (otra imagen incrustada), ni antes ni después del EOI. Con eso, cualquier decodificador
  // ve la misma imagen que este lector.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const isSof = (m: number) => m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
    let o = 2;
    let found: { width: number; height: number } | null = null;
    let sos = -1;
    while (o + 4 <= bytes.length) {
      if (bytes[o] !== 0xff) return null;
      while (bytes[o + 1] === 0xff) o++; // relleno 0xFF permitido por la especificación
      const marker = bytes[o + 1];
      if (marker === 0x00 || marker === 0xd8) return null; // SOI anidado
      if (marker === 0xd9) return null; // EOI antes del primer SOS: no hay imagen
      if (marker === 0xda) {
        const len = (bytes[o + 2] << 8) | bytes[o + 3];
        const ns = bytes[o + 4];
        if (!found || !(ns >= 1 && ns <= 4) || len !== 6 + 2 * ns) return null; // la cabecera del SOS debe ser coherente
        sos = o + 2 + len;
        break;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { o += 2; continue; }
      const len = (bytes[o + 2] << 8) | bytes[o + 3];
      if (len < 2) return null;
      if (isSof(marker)) {
        if (found || len < 8) return null; // segundo SOF o SOF truncado
        found = ok((bytes[o + 7] << 8) | bytes[o + 8], (bytes[o + 5] << 8) | bytes[o + 6]);
        if (!found) return null;
      }
      o += 2 + len;
    }
    if (sos < 0 || !found) return null;
    // Datos comprimidos y lo que sigue: solo marcadores legítimos de una imagen (RSTn, DHT, DRI, SOS de progresivos, EOI…)
    for (let i = sos; i + 1 < bytes.length; i++) {
      if (bytes[i] !== 0xff) continue;
      const m = bytes[i + 1];
      if (m === 0xd8 || isSof(m)) return null; // otra imagen o un segundo SOF escondido
      if (m !== 0x00 && m !== 0xff) i++; // salta el marcador (FF00 = byte relleno, FFFF = relleno)
    }
    return found;
  }
  return null;
}

/**
 * Valida y normaliza lo que manda el navegador. Todo es opcional y cae en DEFAULTS (lo más económico).
 * Forma aceptada (todas las claves opcionales):
 *   { model: 'sunburst'|'flare', quality, aspectRatio, imageSize: '1K'|'2K'|'custom', size: 'WxH' (con imageSize 'custom'),
 *     format, compression, background, n, moderation }
 * ctx: `promptChars` = BYTES UTF-8 del prompt que viaja a OpenAI (el servidor pasa el real y es OBLIGATORIO: sin él falla cerrado);
 * `estimate: true` = solo para el navegador: permite cotizar sin prompt final asumiendo ~1.000 bytes;
 * `inputImagePixels` = píxeles REALES (ancho×alto, leídos con `dataUrlDimensions`) de cada imagen de entrada; `isAdmin` = rol
 * verificado en el servidor (solo así se acepta moderation: 'low').
 * Nunca lanza: devuelve { ok:false, code, message } con un mensaje listo para mostrar.
 */
export function resolveImageOptions(raw: unknown, ctx: { inputImagePixels?: number[]; isAdmin?: boolean; promptChars?: number; estimate?: boolean } = {}): Resolved {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // Falla CERRADO: sin el tamaño real del prompt no se cobra (solo el navegador puede estimar, con `estimate: true`).
  if (ctx.promptChars === undefined) {
    if (ctx.estimate !== true) return fail('missing_prompt_length', 'Falta el tamaño del prompt para calcular el costo.');
  } else if (typeof ctx.promptChars !== 'number' || !Number.isFinite(ctx.promptChars) || ctx.promptChars < 0 || ctx.promptChars > MAX_PROMPT_BYTES) {
    return fail('bad_prompt_length', 'El tamaño del prompt no es válido.');
  }
  const inputPixels = ctx.inputImagePixels ?? [];
  if (!Array.isArray(inputPixels) || inputPixels.some((p) => typeof p !== 'number' || !Number.isFinite(p) || p < 1 || p > MAX_INPUT_IMAGE_PIXELS)) {
    return fail('bad_input_image', `Cada imagen de referencia debe medir hasta ${MAX_INPUT_IMAGE_PIXELS.toLocaleString('es-CO')} píxeles (2048x2048).`);
  }

  const model = o.model === undefined ? DEFAULTS.model : o.model;
  if (!has(IMAGE_MODELS, model)) return fail('bad_model', 'Modelo no válido.');
  const quality = o.quality === undefined ? DEFAULTS.quality : o.quality;
  if (!(QUALITIES as readonly unknown[]).includes(quality)) return fail('bad_quality', 'Calidad no válida.');
  const background = o.background === undefined ? DEFAULTS.background : o.background;
  if (!(BACKGROUNDS as readonly unknown[]).includes(background)) return fail('bad_background', 'Fondo no válido.');
  const moderation = o.moderation === undefined ? DEFAULTS.moderation : o.moderation;
  if (!(MODERATIONS as readonly unknown[]).includes(moderation)) return fail('bad_moderation', 'Moderación no válida.');
  // Falla CERRADO: sin `ctx.isAdmin === true` (rol leído en el servidor, nunca de la solicitud) no hay moderación baja.
  if (moderation === 'low' && ctx.isAdmin !== true) return fail('forbidden_moderation', 'Esa opción es solo para administradores.');
  let format = (o.format === undefined ? DEFAULTS.format : o.format) as ImageFormat;
  if (!(FORMATS as readonly unknown[]).includes(format)) return fail('bad_format', 'Formato no válido.');
  const n = o.n === undefined ? DEFAULTS.n : o.n;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_N) return fail('bad_n', `Variantes: de 1 a ${MAX_N}.`);

  // Tamaño: formato + resolución, o personalizado
  const tierRaw = o.imageSize === undefined ? DEFAULTS.tier : o.imageSize;
  let width: number, height: number;
  if (tierRaw === 'custom') {
    const m = typeof o.size === 'string' ? /^(\d{3,4})x(\d{3,4})$/.exec(o.size) : null;
    if (!m) return fail('bad_size', 'Tamaño personalizado inválido (ejemplo: 1280x720).');
    width = Number(m[1]);
    height = Number(m[2]);
    const err = validateCustomSize(width, height);
    if (err) return fail('bad_size', err);
  } else {
    if (!(TIERS as readonly unknown[]).includes(tierRaw)) return fail('bad_size', 'Resolución no válida.');
    const aspect = o.aspectRatio === undefined ? '1:1' : o.aspectRatio;
    const s = typeof aspect === 'string' ? sizeForPreset(aspect, tierRaw as SizeTier) : null;
    if (!s) return fail('bad_aspect', 'Formato no válido.');
    width = s.width;
    height = s.height;
  }
  const pixels = width * height;

  // Transparencia: solo con webp o png (jpeg no la admite). Se pasa a webp, que pesa menos.
  if (background === 'transparent' && format === 'jpeg') format = 'webp';
  let compression: number | undefined;
  if (format !== 'png') {
    const c = o.compression === undefined ? (format === 'webp' ? 85 : 90) : o.compression;
    if (typeof c !== 'number' || !Number.isInteger(c) || c < 50 || c > 100) return fail('bad_compression', 'Compresión: de 50 a 100.');
    compression = c;
  }

  // La respuesta de una función de Vercel no puede pasar de 4,5 MB
  const bppKey = format === 'jpeg' ? 'jpeg' : format === 'webp' ? (background === 'transparent' ? 'webp-alpha' : 'webp') : background === 'transparent' ? 'png-alpha' : 'png';
  const estBase64 = pixels * n * BYTES_PER_PIXEL[bppKey] * (4 / 3);
  if (estBase64 > MAX_RESPONSE_BASE64_BYTES) {
    return fail('too_heavy', 'Esa combinación de tamaño, variantes y formato pesa demasiado para una respuesta. Baja el tamaño o las variantes, o usa webp.');
  }

  const q = quality as ImageQualityKey;
  const credits = creditsFor({ quality: q, width, height, n, inputPixels, promptChars: ctx.promptChars });
  if (!Number.isInteger(credits) || credits < 1) return fail('bad_cost', 'No se pudo calcular el costo.'); // nunca un cobro NaN/negativo
  return {
    ok: true,
    value: {
      model: model as ImageModelKey,
      modelId: IMAGE_MODELS[model as ImageModelKey],
      quality: q,
      width,
      height,
      size: `${width}x${height}`,
      pixels,
      format,
      compression,
      background: background as ImageBackground,
      moderation: moderation as 'auto' | 'low',
      n,
      credits,
      estimatedOutputTokens: estimateOutputTokens(q, width, height) * n,
      adminOnly: moderation === 'low',
    },
  };
}

/** ¿La solicitud pide algo reservado a admin? El servidor lo usa para leer el rol SOLO cuando hace falta. */
export const wantsAdmin = (raw: unknown): boolean => !!raw && typeof raw === 'object' && (raw as Record<string, unknown>).moderation === 'low';

export const mimeFor = (f: ImageFormat) => (f === 'jpeg' ? 'image/jpeg' : f === 'webp' ? 'image/webp' : 'image/png');

/** Uso real de la respuesta de OpenAI, listo para `core.record_usage` (solo números; ≤ 2 KB). */
export function usageForLog(usage: any, extra: Record<string, number | string> = {}): Record<string, number | string> {
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
  return {
    in: num(usage?.input_tokens),
    in_img: num(usage?.input_tokens_details?.image_tokens),
    in_txt: num(usage?.input_tokens_details?.text_tokens),
    out: num(usage?.output_tokens),
    ...extra,
  };
}
