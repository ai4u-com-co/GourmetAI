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
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { FALLBACK_MODEL, dataUrlDimensions, mimeFor, resolveImageOptions, usageForLog, wantsAdmin, type ResolvedImageOptions } from './_lib/openai-image-core.ts';
import { openaiImageFields } from './_lib/openai-image-server.ts';

const SUPABASE_URL = 'https://dmracybffqdvcltkarag.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EP0yPI9NexntnxQ4_dG5jg_dH5z_zWU';
const APP_ID = 'gourmetai';

const OPENAI = 'https://api.openai.com/v1';
const TEXT_MODEL = 'gpt-4o-mini';
const TIMEOUT_MS = 280_000;

// Las opciones de imagen (modelo, calidad, tamaño, formato, fondo, variantes, moderación) y su costo en créditos salen del
// núcleo compartido (api/_lib/openai-image-core.ts), la misma fuente que usa el navegador. Por defecto, lo más económico:
// Sunburst · low · 1K · JPEG · fondo auto · 1 variante. La receta y el análisis de ingredientes cuestan 1 crédito cada uno:
// así ninguna llamada a OpenAI queda sin medir (el tope por persona lo impone el saldo, atómico en la base).
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
  dish: 'the ORIGINAL DISH photo (the food to re-style)',
  plate: 'the PLATE reference',
  table: 'the TABLE reference',
  restaurant: 'the RESTAURANT reference',
  cutlery: 'the CUTLERY reference',
};


// ---------------------------------------------------------------- registro
// Una línea JSON por evento, con el id de la solicitud (rid) para cruzar lo que ve la persona («ref. abc12345») con los logs
// de Vercel. NUNCA se registran claves, JWT, tokens de devolución, prompts, imágenes ni el cuerpo de error de OpenAI:
// solo códigos, estados, montos, tiempos y el id de OpenAI de la solicitud.
interface Ctx {
  rid: string;
  action: string;
  userId?: string;
  t0: number;
}
const als = new AsyncLocalStorage<Ctx>();
const log = (level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) => {
  const c = als.getStore();
  const line = JSON.stringify({ app: 'gourmetai', level, event, rid: c?.rid, action: c?.action, user: c?.userId, ms: c ? Date.now() - c.t0 : undefined, ...data });
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
};

// ---------------------------------------------------------------- prompts de texto
const RECIPE_SYSTEM =
  'Eres un chef profesional que enseña a cocineros caseros. Respondes siempre en español, en Markdown y siguiendo exactamente el formato pedido. ' +
  'Eres preciso con cantidades y tiempos, no inventas marcas, datos nutricionales ni técnicas imposibles, no cambias el plato que te piden, ' +
  'y no escribes introducciones ni comentarios fuera del formato.';
const ANALYZE_PROMPT =
  'Identifica los ingredientes que se ven en esta foto de un plato. Reglas: responde en español; solo los ingredientes, separados por comas; ' +
  'solo lo que se ve o es evidente (no inventes salsas, especias ni rellenos que no se distingan); sin cantidades, sin repetidos y máximo 15; ' +
  'si la imagen no es comida, responde exactamente: ninguno.';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [head, b64] = dataUrl.split(',');
  const mime = head.substring(head.indexOf(':') + 1, head.indexOf(';'));
  return new Blob([Buffer.from(b64, 'base64')], { type: mime });
};

type Failure = { ok: false; status: number; code?: string; oaiRequestId?: string };
type OpenAIImage = { ok: true; b64s: string[]; usage: unknown; oaiRequestId?: string } | Failure;

const errorCode = async (res: Response): Promise<string | undefined> => {
  try {
    const b = await res.json();
    return b?.error?.code || b?.error?.type;
  } catch {
    return undefined; // cuerpo no JSON
  }
};

/** Una llamada a OpenAI con TODAS las opciones resueltas (openaiImageFields las nombra como la API: nunca input_fidelity). */
const callImage = async (
  apiKey: string,
  modelId: string,
  p: { prompt: string; v: ResolvedImageOptions; userId: string; images: string[] },
  signal: AbortSignal,
): Promise<OpenAIImage> => {
  const fields = openaiImageFields(p.v, { appId: APP_ID, userId: p.userId }, modelId);
  let res: Response;
  if (p.images.length === 0) {
    res = await fetch(`${OPENAI}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: p.prompt, ...fields }),
      signal,
    });
  } else {
    const form = new FormData();
    form.append('prompt', p.prompt);
    for (const [k, val] of Object.entries(fields)) form.append(k, String(val));
    p.images.forEach((img, i) => form.append('image[]', dataUrlToBlob(img), `input-${i + 1}`));
    res = await fetch(`${OPENAI}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal });
  }
  const oaiRequestId = res.headers.get('x-request-id') ?? undefined;
  if (!res.ok) return { ok: false, status: res.status, code: await errorCode(res), oaiRequestId };
  const data = await res.json();
  const b64s: string[] = Array.isArray(data?.data)
    ? data.data.map((d: any) => d?.b64_json).filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
    : [];
  return b64s.length ? { ok: true, b64s, usage: data?.usage, oaiRequestId } : { ok: false, status: 502, code: 'empty_response', oaiRequestId };
};

type OpenAIText = { ok: true; text: string; usage: unknown; oaiRequestId?: string } | Failure;

const callText = async (
  apiKey: string,
  p: { system: string; user: string; image?: string; maxTokens: number; temperature: number },
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
      temperature: p.temperature, // bajo: la receta y el análisis deben ser precisos, no creativos
      messages: [{ role: 'system', content: p.system }, { role: 'user', content }],
    }),
    signal,
  });
  const oaiRequestId = res.headers.get('x-request-id') ?? undefined;
  if (!res.ok) return { ok: false, status: res.status, code: await errorCode(res), oaiRequestId };
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === 'string' && text.trim()
    ? { ok: true, text: text.trim(), usage: { input_tokens: data?.usage?.prompt_tokens, output_tokens: data?.usage?.completion_tokens }, oaiRequestId }
    : { ok: false, status: 502, code: 'empty_response', oaiRequestId };
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
  userId: string;
}

/** Valida el JWT y devuelve el cliente de Supabase que actúa COMO el usuario (sin service_role). */
const authenticate = async (request: Request): Promise<Session | Response> => {
  const authz = request.headers.get('authorization') ?? '';
  const jwt = authz.startsWith('Bearer ') ? authz.slice(7).trim() : '';
  if (!jwt) {
    log('warn', 'auth_missing');
    return json(401, { error: 'unauthenticated', message: 'Inicia sesión para continuar.' });
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: who, error } = await sb.auth.getUser(jwt);
  if (error || !who?.user) {
    log('warn', 'auth_invalid', { code: error?.status });
    return json(401, { error: 'unauthenticated', message: 'Tu sesión venció. Vuelve a entrar.' });
  }
  const c = als.getStore();
  if (c) c.userId = who.user.id;
  return { sb, userId: who.user.id };
};

/** ¿La cuenta es admin de esta app? Se lee con el JWT de la propia persona (RLS: solo ve su membresía). null = no se pudo saber. */
const isAppAdmin = async (sb: SupabaseClient, userId: string): Promise<boolean | null> => {
  try {
    const { data, error } = await sb.schema('core').from('app_memberships').select('role,is_active').eq('app_id', APP_ID).eq('user_id', userId).maybeSingle();
    if (error) {
      log('error', 'role_lookup_failed', { code: error.code });
      return null;
    }
    return data?.is_active === true && data?.role === 'admin';
  } catch (e: any) {
    log('error', 'role_lookup_failed', { err: String(e?.message ?? e).slice(0, 120) });
    return null;
  }
};

const readBody = async (request: Request): Promise<Record<string, any> | Response> => {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) {
    log('warn', 'body_too_large', { bytes: declared });
    return json(413, { error: 'too_large', message: 'Las fotos son demasiado pesadas.' });
  }
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  } catch {
    log('warn', 'body_invalid_json');
    return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  }
};

type Charge = { ok: boolean; remaining: number; log_id?: number; refund_token?: string | null };

/** Cobra ANTES de llamar a OpenAI. Devuelve el cobro, o la respuesta de error que corresponda. */
const chargeCredits = async (sb: SupabaseClient, amount: number, action: string, meta: Record<string, unknown>): Promise<Charge | Response> => {
  if (!Number.isInteger(amount) || amount < 1) return json(500, { error: 'billing_error', message: 'No se pudo calcular el costo.' });
  const { data, error } = await sb.schema('core').rpc('consume_credits', { p_app: APP_ID, p_amount: amount, p_action: action, p_meta: meta });
  if (error) {
    log(error.code === '42501' || error.code === '28000' ? 'warn' : 'error', 'charge_error', { code: error.code, amount, what: action });
    if (error.code === '42501') return json(403, { error: 'no_access', message: 'Tu cuenta no tiene acceso a esta app.' });
    if (error.code === '28000') return json(401, { error: 'unauthenticated', message: 'Tu sesión venció. Vuelve a entrar.' });
    return json(500, { error: 'billing_error', message: 'No se pudo verificar tu saldo. Inténtalo de nuevo.' });
  }
  if (!data?.ok) {
    log('info', 'charge_insufficient', { amount, remaining: data?.remaining ?? 0, what: action });
    return json(402, { error: 'insufficient_credits', message: 'No te quedan créditos suficientes para esto.', remaining: data?.remaining ?? 0, needed: amount });
  }
  log('info', 'charged', { amount, what: action, remaining: data.remaining, admin: !data.refund_token });
  return data as Charge;
};

/** Devuelve el cobro si lo hubo. `refunded` es false solo si había cobro y no se pudo devolver (caso raro). */
const settle = async (sb: SupabaseClient, charge: Charge): Promise<{ remaining: number; refunded: boolean }> => {
  if (!charge.refund_token) return { remaining: charge.remaining, refunded: true }; // admin: no hubo cobro
  try {
    const { data } = await sb.schema('core').rpc('refund_credits', { p_log_id: charge.log_id, p_token: charge.refund_token });
    if (data?.ok) {
      log('info', 'refunded', { remaining: data.remaining });
      return { remaining: data.remaining, refunded: true };
    }
    log('error', 'refund_failed', { log_id: charge.log_id });
  } catch (e: any) {
    log('error', 'refund_failed', { log_id: charge.log_id, err: String(e?.message ?? e).slice(0, 120) });
  }
  return { remaining: charge.remaining, refunded: false };
};
const noCharge = (base: string, refunded: boolean) =>
  refunded ? `${base} No se te cobró; inténtalo de nuevo.` : `${base} No pudimos devolverte los créditos automáticamente: escríbenos y lo corregimos.`;

/** Anota el uso real (tokens) del cobro. NUNCA puede romper la generación: cualquier fallo se ignora (solo se avisa en el log). */
const recordUsage = async (sb: SupabaseClient, charge: Charge, usage: Record<string, number | string>): Promise<void> => {
  if (charge.log_id === undefined || charge.log_id === null) return;
  try {
    const { error } = await sb.schema('core').rpc('record_usage', {
      p_log_id: charge.log_id,
      p_token: charge.refund_token ?? null, // el mismo token que solo ve el servidor; para admin es null (la base lo autoriza por rol)
      p_usage: usage,
    });
    if (error) log('warn', 'record_usage_failed', { code: error.code });
  } catch (e: any) {
    log('warn', 'record_usage_failed', { err: String(e?.message ?? e).slice(0, 120) });
  }
};

type WorkOk = {
  ok: true;
  body: Record<string, unknown>;
  /** Uso para core.record_usage (solo números y etiquetas cortas). */
  usage: Record<string, number | string>;
  /** Campos extra para el log de éxito (nunca prompts ni imágenes). */
  logExtra?: Record<string, unknown>;
};

/** Corre `work` bajo cobro: si falla o expira, devuelve los créditos y responde sin exponer el error de OpenAI. */
const runCharged = async (
  sb: SupabaseClient,
  charge: Charge,
  work: (signal: AbortSignal) => Promise<WorkOk | Failure>,
  amount: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const result = await work(controller.signal);
    if (!result.ok) {
      log('error', 'openai_failed', { status: result.status, code: result.code, oai_rid: result.oaiRequestId });
      const s = await settle(sb, charge);
      const e = userError(result);
      return json(e.http, { error: e.error, message: noCharge(e.message, s.refunded), remaining: s.remaining });
    }
    await recordUsage(sb, charge, result.usage);
    log('info', 'ok', { what: charge.refund_token ? 'paid' : 'admin', model: result.body.model, credits: amount, tokens_in: result.usage.in, tokens_out: result.usage.out, ...result.logExtra });
    return json(200, { ...result.body, remaining: charge.remaining, charged: charge.refund_token ? amount : 0 });
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    log('error', aborted ? 'openai_timeout' : 'work_threw', { err: String(err?.message ?? err).slice(0, 160) });
    const s = await settle(sb, charge);
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
  const rawImages: unknown = body.images ?? [];
  if (!prompt || prompt.length > MAX_PROMPT || !Array.isArray(rawImages) || rawImages.length > MAX_IMAGES) {
    log('warn', 'bad_request', { promptLen: prompt.length, images: Array.isArray(rawImages) ? rawImages.length : -1 });
    return json(400, { error: 'bad_request', message: 'Solicitud inválida.' });
  }
  // Cada imagen: { role, data }. Un rol solo puede aparecer una vez.
  const seen = new Set<string>();
  const byRole = new Map<string, string>();
  for (const it of rawImages) {
    const role = typeof it?.role === 'string' ? it.role : '';
    const data = typeof it?.data === 'string' ? it.data : '';
    if (!(ROLE_ORDER as readonly string[]).includes(role) || seen.has(role) || data.length > MAX_IMAGE_CHARS || !DATA_URL.test(data)) {
      log('warn', 'bad_images', { role });
      return json(400, { error: 'bad_images', message: 'Las fotos no son válidas o pesan demasiado.' });
    }
    seen.add(role);
    byRole.set(role, data);
  }
  const ordered = ROLE_ORDER.filter((r) => byRole.has(r));
  const images = ordered.map((r) => byRole.get(r) as string);
  const preface = ordered.length
    ? `Input images, in order: ${ordered.map((r, i) => `image ${i + 1} is ${ROLE_TEXT[r]}`).join('; ')}. Use each reference only for what the task states; never copy food from a reference image.\n\n`
    : '';

  // Modelo, calidad, tamaño, formato, fondo, variantes y moderación: todo pasa por el núcleo. Sin valor → lo más económico.
  // Cualquier opción inválida (incluidas claves heredadas como 'constructor') se rechaza AQUÍ, antes de cobrar.
  // El costo de las fotos de entrada se mide por sus píxeles REALES (se leen de la cabecera, no se confía en el navegador).
  const inputImagePixels: number[] = [];
  for (const img of images) {
    const dim = dataUrlDimensions(img);
    if (!dim) {
      log('warn', 'bad_images', { reason: 'dimensions' });
      return json(400, { error: 'bad_images', message: 'Las fotos no son válidas o pesan demasiado.' });
    }
    inputImagePixels.push(dim.width * dim.height);
  }
  // El rol se lee SOLO si la solicitud pide algo reservado a admin; falla cerrado (sin rol verificado no hay moderación baja).
  let isAdmin = false;
  if (wantsAdmin(body)) {
    const role = await isAppAdmin(auth.sb, auth.userId);
    if (role === null) return json(500, { error: 'billing_error', message: 'No se pudo verificar tu rol. Inténtalo de nuevo.' });
    isAdmin = role;
  }
  const resolved = resolveImageOptions(body, { inputImagePixels, isAdmin });
  if (!resolved.ok) {
    log('warn', 'bad_options', { code: resolved.code });
    if (resolved.code === 'forbidden_moderation') return json(403, { error: 'admin_only', message: resolved.message });
    return json(400, { error: resolved.code, message: resolved.message });
  }
  const v = resolved.value;

  const amount = v.credits;
  const charge = await chargeCredits(auth.sb, amount, 'image', {
    model: v.model,
    quality: v.quality,
    size: v.size,
    n: v.n,
    format: v.format,
    background: v.background,
    inputs: images.length,
  });
  if (charge instanceof Response) return charge;

  return runCharged(
    auth.sb,
    charge,
    async (signal) => {
      const args = { prompt: preface + prompt, v, userId: auth.userId, images };
      let model = v.modelId;
      let result = await callImage(openaiKey, model, args, signal);
      // Respaldo SOLO si el modelo no existe en la cuenta; el cobro ya hecho no se repite.
      if (!result.ok && (result.status === 404 || result.code === 'model_not_found')) {
        log('warn', 'model_fallback', { from: model, to: FALLBACK_MODEL });
        model = FALLBACK_MODEL;
        result = await callImage(openaiKey, model, args, signal);
      }
      if (!result.ok) return result;
      const mime = mimeFor(v.format);
      const out = result.b64s.map((b) => `data:${mime};base64,${b}`);
      const usage = usageForLog(result.usage);
      return {
        ok: true,
        body: {
          image: out[0],
          images: out,
          model,
          options: { model: v.model, quality: v.quality, size: v.size, format: v.format, background: v.background, n: v.n },
          usage,
        },
        usage: usageForLog(result.usage, { model, quality: v.quality, size: v.size, n: v.n }),
        logExtra: { quality: v.quality, size: v.size, n: v.n, returned: out.length, format: v.format, background: v.background, inputs: images.length, oai_rid: result.oaiRequestId },
      };
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
      const r = await callText(openaiKey, { system: RECIPE_SYSTEM, user: prompt, maxTokens: 1800, temperature: 0.4 }, signal);
      if (!r.ok) return r;
      const usage = usageForLog(r.usage, { model: TEXT_MODEL });
      return { ok: true, body: { recipe: r.text, model: TEXT_MODEL }, usage, logExtra: { oai_rid: r.oaiRequestId } };
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
          system: 'Eres un asistente de cocina que identifica ingredientes en fotos de platos de comida.',
          user: ANALYZE_PROMPT,
          image,
          maxTokens: 200,
          temperature: 0,
        },
        signal,
      );
      if (!r.ok) return r;
      // «ninguno» = la foto no es comida: se devuelve vacío para no contaminar el prompt de imagen.
      const usage = usageForLog(r.usage, { model: TEXT_MODEL });
      return { ok: true, body: { ingredients: /^ninguno\.?$/i.test(r.text.trim()) ? '' : r.text, model: TEXT_MODEL }, usage, logExtra: { oai_rid: r.oaiRequestId } };
    },
    ANALYZE_CREDITS,
  );
};

const route = async (request: Request, action: string | undefined, openaiKey: string): Promise<Response> => {
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
};

/** Añade el id de la solicitud a la respuesta (cabecera y cuerpo JSON) para que la persona pueda citarlo. */
const withRid = async (res: Response, rid: string): Promise<Response> => {
  const headers = new Headers(res.headers);
  headers.set('x-request-id', rid);
  let text = await res.text();
  try {
    text = JSON.stringify({ ...JSON.parse(text), requestId: rid });
  } catch {
    /* no era JSON: se deja igual */
  }
  return new Response(text, { status: res.status, headers });
};

export async function POST(request: Request): Promise<Response> {
  const action = new URL(request.url).pathname.replace(/\/+$/, '').split('/').pop();
  const ctx: Ctx = { rid: randomUUID().slice(0, 8), action: action ?? '?', t0: Date.now() };
  return als.run(ctx, async () => {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      log('error', 'server_misconfigured', { missing: 'OPENAI_API_KEY' });
      return withRid(json(500, { error: 'server_misconfigured', message: 'El servicio no está configurado todavía.' }), ctx.rid);
    }
    try {
      return await withRid(await route(request, action, openaiKey), ctx.rid);
    } catch (err: any) {
      // Red de seguridad: un fallo inesperado nunca llega como un crash sin formato.
      log('error', 'unhandled', { err: String(err?.message ?? err).slice(0, 200), name: err?.name });
      return withRid(json(500, { error: 'internal_error', message: 'Ocurrió un error inesperado en el servidor.' }), ctx.rid);
    }
  });
}
