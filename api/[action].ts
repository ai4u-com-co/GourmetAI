// /api/analyze-image · /api/generate-image · /api/generate-recipe — todo con la clave del servidor (OPENAI_API_KEY).
//
// El gasto de OpenAI es de Mariano, así que TODO el control está aquí, no en el navegador:
//   1. Valida la sesión de Google/Supabase (JWT en Authorization) y que la cuenta tenga acceso a la app `gourmetai`.
//   2. Valida y acota la solicitud (tamaños, calidad, imágenes, longitud del texto).
//   3. Cobra créditos con core.consume_credits ANTES de llamar a OpenAI (atómico; los admin no pagan).
//   4. Llama a OpenAI. Si falla, devuelve el cobro con core.refund_credits usando un token que SOLO ve este servidor.
// El refund_token jamás se incluye en la respuesta al navegador.
//
// Proyecto Supabase: `apps` (dmracybffqdvcltkarag), app `gourmetai`. La URL y la clave publishable son públicas por diseño;
// la protección real son las políticas RLS y las funciones security definer de la base. No se usa service_role.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dmracybffqdvcltkarag.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EP0yPI9NexntnxQ4_dG5jg_dH5z_zWU';
const APP_ID = 'gourmetai';

const OPENAI = 'https://api.openai.com/v1';
const IMAGE_MODEL = 'gpt-image-2.5-sunburst';
const IMAGE_FALLBACK_MODEL = 'gpt-image-2';
const TEXT_MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 280_000;

// Solo hasta 2K: las respuestas de una función de Vercel no pueden pasar de 4,5 MB (se pide JPEG para que quepan).
const SIZES: Record<string, Record<string, string>> = {
  '1K': { '1:1': '1024x1024', '3:4': '960x1280', '4:3': '1280x960', '9:16': '864x1536', '16:9': '1536x864' },
  '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048', '16:9': '2048x1152' },
};
// Créditos por imagen: calidad base × (2 en 2K). La receta y el análisis de ingredientes cuestan 1 cada uno: así
// ninguna llamada a OpenAI queda sin medir (el tope por persona lo impone el saldo, atómico en la base).
const BASE_CREDITS: Record<string, number> = { low: 1, medium: 4, high: 15 };
const RECIPE_CREDITS = 1;
const ANALYZE_CREDITS = 1;

const MAX_PROMPT = 8000;
const MAX_IMAGES = 5;
const MAX_IMAGE_CHARS = 1_000_000; // ~750 KB por imagen en base64; el cuerpo total no puede pasar de 4,5 MB
const MAX_BODY_BYTES = 4_200_000;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

// Papel de cada foto de referencia; el orden manda para que el modelo sepa cuál es cuál.
const ROLE_ORDER = ['dish', 'plate', 'table', 'restaurant', 'cutlery'] as const;
const ROLE_TEXT: Record<(typeof ROLE_ORDER)[number], string> = {
  dish: 'the ORIGINAL DISH photo to improve (keep the food itself)',
  plate: 'the physical PLATE to use',
  table: 'the TABLE surface to use',
  restaurant: 'the RESTAURANT / environment to place the scene in',
  cutlery: 'the CUTLERY to use',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [head, b64] = dataUrl.split(',');
  const mime = head.substring(head.indexOf(':') + 1, head.indexOf(';'));
  return new Blob([Buffer.from(b64, 'base64')], { type: mime });
};

type OpenAIImage = { ok: true; b64: string } | { ok: false; status: number; code?: string };

const errorCode = async (res: Response): Promise<string | undefined> => {
  try {
    const b = await res.json();
    return b?.error?.code || b?.error?.type;
  } catch {
    return undefined; // cuerpo no JSON
  }
};

const callImage = async (
  apiKey: string,
  model: string,
  p: { prompt: string; size: string; quality: string; images: string[] },
  signal: AbortSignal,
): Promise<OpenAIImage> => {
  let res: Response;
  if (p.images.length === 0) {
    res = await fetch(`${OPENAI}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: p.prompt, size: p.size, quality: p.quality, output_format: 'jpeg', output_compression: 90, n: 1 }),
      signal,
    });
  } else {
    const form = new FormData();
    form.append('model', model);
    form.append('prompt', p.prompt);
    form.append('size', p.size);
    form.append('quality', p.quality);
    form.append('output_format', 'jpeg');
    form.append('output_compression', '90');
    form.append('n', '1');
    p.images.forEach((img, i) => form.append('image[]', dataUrlToBlob(img), `input-${i + 1}`));
    res = await fetch(`${OPENAI}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal });
  }
  if (!res.ok) return { ok: false, status: res.status, code: await errorCode(res) };
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  return b64 ? { ok: true, b64 } : { ok: false, status: 502, code: 'empty_response' };
};

type OpenAIText = { ok: true; text: string } | { ok: false; status: number; code?: string };

const callText = async (
  apiKey: string,
  p: { system: string; user: string; image?: string; maxTokens: number },
  signal: AbortSignal,
): Promise<OpenAIText> => {
  const content: unknown = p.image
    ? [{ type: 'text', text: p.user }, { type: 'image_url', image_url: { url: p.image, detail: 'low' } }]
    : p.user;
  const res = await fetch(`${OPENAI}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: TEXT_MODEL,
      max_tokens: p.maxTokens,
      messages: [{ role: 'system', content: p.system }, { role: 'user', content }],
    }),
    signal,
  });
  if (!res.ok) return { ok: false, status: res.status, code: await errorCode(res) };
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim() ? { ok: true, text: text.trim() } : { ok: false, status: 502, code: 'empty_response' };
};

// Mensajes para el usuario: nunca se reenvía el cuerpo de error de OpenAI.
const userError = (r: { status: number; code?: string }) => {
  if (r.code === 'moderation_blocked')
    return { http: 422, error: 'moderation_blocked', message: 'Los filtros de seguridad bloquearon la solicitud; ajusta la descripción o las fotos.' };
  if (r.status === 429) return { http: 503, error: 'busy', message: 'El servicio está saturado en este momento.' };
  return { http: 502, error: 'generation_failed', message: 'No se pudo completar la solicitud.' };
};

interface Session {
  sb: SupabaseClient;
}

/** Valida el JWT y devuelve el cliente de Supabase que actúa COMO el usuario (sin service_role). */
const authenticate = async (request: Request): Promise<Session | Response> => {
  const authz = request.headers.get('authorization') ?? '';
  const jwt = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!jwt) return json(401, { error: 'unauthenticated', message: 'Inicia sesión para continuar.' });
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: who, error } = await sb.auth.getUser(jwt);
  if (error || !who?.user) return json(401, { error: 'unauthenticated', message: 'Tu sesión venció. Vuelve a entrar.' });
  return { sb };
};

const readBody = async (request: Request): Promise<Record<string, any> | Response> => {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return json(413, { error: 'too_large', message: 'Las fotos son demasiado pesadas.' });
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  } catch {
    return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  }
};

type Charge = { ok: boolean; remaining: number; log_id?: number; refund_token?: string | null };

/** Cobra ANTES de llamar a OpenAI. Devuelve el cobro, o la respuesta de error que corresponda. */
const chargeCredits = async (sb: SupabaseClient, amount: number, action: string, meta: Record<string, unknown>): Promise<Charge | Response> => {
  if (!Number.isInteger(amount) || amount < 1) return json(500, { error: 'billing_error', message: 'No se pudo calcular el costo.' });
  const { data, error } = await sb.schema('core').rpc('consume_credits', { p_app: APP_ID, p_amount: amount, p_action: action, p_meta: meta });
  if (error) {
    if (error.code === '42501') return json(403, { error: 'no_access', message: 'Tu cuenta no tiene acceso a esta app.' });
    if (error.code === '28000') return json(401, { error: 'unauthenticated', message: 'Tu sesión venció. Vuelve a entrar.' });
    return json(500, { error: 'billing_error', message: 'No se pudo verificar tu saldo. Inténtalo de nuevo.' });
  }
  if (!data?.ok) {
    return json(402, { error: 'insufficient_credits', message: 'No te quedan créditos suficientes para esto.', remaining: data?.remaining ?? 0, needed: amount });
  }
  return data as Charge;
};

/** Devuelve el cobro si lo hubo. `refunded` es false solo si había cobro y no se pudo devolver (caso raro). */
const settle = async (sb: SupabaseClient, charge: Charge): Promise<{ remaining: number; refunded: boolean }> => {
  if (!charge.refund_token) return { remaining: charge.remaining, refunded: true }; // admin: no hubo cobro
  try {
    const { data } = await sb.schema('core').rpc('refund_credits', { p_log_id: charge.log_id, p_token: charge.refund_token });
    if (data?.ok) return { remaining: data.remaining, refunded: true };
  } catch {
    /* se informa abajo */
  }
  return { remaining: charge.remaining, refunded: false };
};
const noCharge = (base: string, refunded: boolean) =>
  refunded ? `${base} No se te cobró; inténtalo de nuevo.` : `${base} No pudimos devolverte los créditos automáticamente: escríbenos y lo corregimos.`;

/** Corre `work` bajo cobro: si falla o expira, devuelve los créditos y responde sin exponer el error de OpenAI. */
const runCharged = async (
  sb: SupabaseClient,
  charge: Charge,
  work: (signal: AbortSignal) => Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; status: number; code?: string }>,
  amount: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await work(controller.signal);
    if (!result.ok) {
      const s = await settle(sb, charge);
      const e = userError(result);
      return json(e.http, { error: e.error, message: noCharge(e.message, s.refunded), remaining: s.remaining });
    }
    return json(200, { ...result.body, remaining: charge.remaining, charged: charge.refund_token ? amount : 0 });
  } catch (err: any) {
    const s = await settle(sb, charge);
    const aborted = err?.name === 'AbortError';
    return json(aborted ? 504 : 502, {
      error: aborted ? 'timeout' : 'generation_failed',
      message: noCharge(aborted ? 'La solicitud tardó demasiado; prueba una resolución menor.' : 'No se pudo completar la solicitud.', s.refunded),
      remaining: s.remaining,
    });
  } finally {
    clearTimeout(timer);
  }
};

// ---------------------------------------------------------------- rutas

const handleGenerateImage = async (request: Request, openaiKey: string): Promise<Response> => {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const body = await readBody(request);
  if (body instanceof Response) return body;

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const aspect = String(body.aspectRatio ?? '');
  const sizeKey = String(body.imageSize ?? '');
  const quality = String(body.quality ?? '');
  const rawImages: unknown = body.images ?? [];
  // Solo propiedades PROPIAS: con `in` o `obj[k]` entrarían claves heredadas ('constructor', '__proto__', 'toString'…).
  const sizeTable = Object.hasOwn(SIZES, sizeKey) ? SIZES[sizeKey] : undefined;
  const size = sizeTable && Object.hasOwn(sizeTable, aspect) ? sizeTable[aspect] : undefined;
  if (!prompt || prompt.length > MAX_PROMPT || typeof size !== 'string' || !Object.hasOwn(BASE_CREDITS, quality) || !Array.isArray(rawImages) || rawImages.length > MAX_IMAGES) {
    return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  }
  // Cada imagen: { role, data }. Un rol solo puede aparecer una vez.
  const seen = new Set<string>();
  const byRole = new Map<string, string>();
  for (const it of rawImages) {
    const role = typeof it?.role === 'string' ? it.role : '';
    const data = typeof it?.data === 'string' ? it.data : '';
    if (!(ROLE_ORDER as readonly string[]).includes(role) || seen.has(role) || data.length > MAX_IMAGE_CHARS || !DATA_URL.test(data)) {
      return json(400, { error: 'bad_images', message: 'Las fotos no son válidas o pesan demasiado.' });
    }
    seen.add(role);
    byRole.set(role, data);
  }
  const ordered = ROLE_ORDER.filter((r) => byRole.has(r));
  const images = ordered.map((r) => byRole.get(r) as string);
  const preface = ordered.length
    ? `Reference images, in order: ${ordered.map((r, i) => `image ${i + 1} is ${ROLE_TEXT[r]}`).join('; ')}.\n\n`
    : '';

  const amount = BASE_CREDITS[quality] * (sizeKey === '2K' ? 2 : 1);
  const charge = await chargeCredits(auth.sb, amount, 'image', { quality, size: sizeKey, aspect, inputs: images.length });
  if (charge instanceof Response) return charge;

  return runCharged(
    auth.sb,
    charge,
    async (signal) => {
      const args = { prompt: preface + prompt, size, quality, images };
      let model = IMAGE_MODEL;
      let result = await callImage(openaiKey, model, args, signal);
      if (!result.ok && (result.status === 404 || result.code === 'model_not_found')) {
        model = IMAGE_FALLBACK_MODEL;
        result = await callImage(openaiKey, model, args, signal);
      }
      return result.ok ? { ok: true, body: { image: `data:image/jpeg;base64,${result.b64}`, model } } : result;
    },
    amount,
  );
};

const handleGenerateRecipe = async (request: Request, openaiKey: string): Promise<Response> => {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT) return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });

  const charge = await chargeCredits(auth.sb, RECIPE_CREDITS, 'recipe', {});
  if (charge instanceof Response) return charge;
  return runCharged(
    auth.sb,
    charge,
    async (signal) => {
      const r = await callText(openaiKey, { system: 'Eres un chef profesional. Responde siempre en español y en Markdown.', user: prompt, maxTokens: 1800 }, signal);
      return r.ok ? { ok: true, body: { recipe: r.text } } : r;
    },
    RECIPE_CREDITS,
  );
};

const handleAnalyzeImage = async (request: Request, openaiKey: string): Promise<Response> => {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  const body = await readBody(request);
  if (body instanceof Response) return body;
  const image = typeof body.image === 'string' ? body.image : '';
  if (image.length > MAX_IMAGE_CHARS || !DATA_URL.test(image)) return json(400, { error: 'bad_images', message: 'La foto no es válida o pesa demasiado.' });

  const charge = await chargeCredits(auth.sb, ANALYZE_CREDITS, 'analyze', {});
  if (charge instanceof Response) return charge;
  return runCharged(
    auth.sb,
    charge,
    async (signal) => {
      const r = await callText(
        openaiKey,
        {
          system: 'Identificas ingredientes en fotos de comida.',
          user: 'Lista todos los ingredientes que identificas en esta imagen de comida. Responde solo con ingredientes separados por comas, sin explicaciones.',
          image,
          maxTokens: 200,
        },
        signal,
      );
      return r.ok ? { ok: true, body: { ingredients: r.text } } : r;
    },
    ANALYZE_CREDITS,
  );
};

export async function POST(request: Request): Promise<Response> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return json(500, { error: 'server_misconfigured', message: 'El servicio no está configurado todavía.' });
  const action = new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop();
  switch (action) {
    case 'generate-image':
      return handleGenerateImage(request, openaiKey);
    case 'generate-recipe':
      return handleGenerateRecipe(request, openaiKey);
    case 'analyze-image':
      return handleAnalyzeImage(request, openaiKey);
    default:
      return json(404, { error: 'not_found', message: 'Ruta desconocida.' });
  }
}
