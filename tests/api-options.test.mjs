// Opciones de GPT Image 2.5 en api/[action].ts: parámetros, variantes, transparencia, moderación (solo admin), fotos de entrada,
// record_usage y registro. Supabase y OpenAI simulados a nivel de fetch (sin red ni secretos). Ejecutar: npm test
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'sk-prueba-no-real';
const { POST } = await import('../api/[action].ts');
const core = await import('../api/_lib/openai-image-core.ts');

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TOKEN_SECRETO = 'token-secreto-de-devolucion-que-no-debe-salir';

let world;
const reset = (over = {}) => {
  world = {
    calls: [],
    consume: { ok: true, remaining: 9, log_id: 42, refund_token: TOKEN_SECRETO },
    refund: { ok: true, remaining: 10 },
    membership: { is_active: true, role: 'user' },
    recordFail: false,
    openai: [{ status: 200, body: { data: [{ b64_json: 'QUJD' }] } }],
    chat: { status: 200, body: { choices: [{ message: { content: 'harina, huevos' } }] } },
    ...over,
  };
};
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-request-id': 'req_oai_123' } });

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const body = typeof init.body === 'string' ? init.body : init.body instanceof FormData ? init.body : null;
  world.calls.push({ url, init, body });
  if (url.includes('/auth/v1/user')) return j(200, { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'a@b.co' });
  if (url.includes('/rest/v1/rpc/consume_credits')) return j(200, world.consume);
  if (url.includes('/rest/v1/rpc/refund_credits')) return j(200, world.refund);
  if (url.includes('/rest/v1/rpc/record_usage')) return world.recordFail ? j(500, { code: 'XX000', message: 'boom' }) : j(200, null);
  if (url.includes('/rest/v1/app_memberships')) return j(200, world.membership ? [world.membership] : []);
  if (url.includes('api.openai.com/v1/chat/completions')) return j(world.chat.status, world.chat.body);
  if (url.includes('api.openai.com')) {
    const next = world.openai.length > 1 ? world.openai.shift() : world.openai[0];
    return j(next.status, next.body);
  }
  throw new Error(`fetch no simulado: ${url}`);
};

const req = (action, body) =>
  new Request(`https://x.test/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer jwt-ok' }, body: JSON.stringify(body) });
const called = (frag) => world.calls.filter((c) => c.url.includes(frag));
const rpcBody = (name) => JSON.parse(called(`/rpc/${name}`)[0].init.body);
const sentGen = () => JSON.parse(called('/images/generations')[0].init.body);
const pngOf = (w, h) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return 'data:image/png;base64,' + b.toString('base64');
};
const captureLogs = async (fn) => {
  const lines = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  for (const k of ['log', 'warn', 'error']) console[k] = (...a) => lines.push(a.join(' '));
  try {
    return { result: await fn(), lines };
  } finally {
    Object.assign(console, orig);
  }
};
const appLogs = (lines) => lines.filter((l) => l.startsWith('{"app":"gourmetai"')).map((l) => JSON.parse(l));

test('defaults baratos: sunburst, low, 1024x1024, jpeg q90, n=1, safety_identifier de 64 hex y NUNCA input_fidelity', async () => {
  reset();
  await POST(req('generate-image', { prompt: 'x' }));
  const s = sentGen();
  assert.deepEqual([s.model, s.quality, s.size, s.output_format, s.output_compression, s.n], ['gpt-image-2.5-sunburst', 'low', '1024x1024', 'jpeg', 90, 1]);
  assert.match(s.safety_identifier, /^[0-9a-f]{64}$/);
  assert.ok(!('input_fidelity' in s) && !('background' in s) && !('moderation' in s));
});

test('cada opción llega a OpenAI con su nombre: flare, high, 4:5 2K, webp, n=3', async () => {
  reset();
  await POST(req('generate-image', { prompt: 'x', model: 'flare', quality: 'high', aspectRatio: '4:5', imageSize: '1K', format: 'webp', n: 3 }));
  const s = sentGen();
  assert.equal(s.model, 'gpt-image-2.5-flare');
  assert.equal(s.quality, 'high');
  assert.equal(s.output_format, 'webp');
  assert.equal(s.output_compression, 85);
  assert.equal(s.n, 3);
  assert.match(s.size, /^\d+x\d+$/);
  const meta = rpcBody('consume_credits').p_meta;
  assert.deepEqual([meta.model, meta.quality, meta.n, meta.format, meta.background, meta.inputs], ['flare', 'high', 3, 'webp', 'auto', 0]);
});

test('el precio cobrado es exactamente el del núcleo (v.credits)', async () => {
  for (const o of [{ quality: 'xhigh' }, { n: 4 }, { quality: 'max', aspectRatio: '16:9' }, { imageSize: '2K', n: 1 }, { n: 2, format: 'webp' }]) {
    reset();
    await POST(req('generate-image', { prompt: 'x', ...o }));
    assert.equal(rpcBody('consume_credits').p_amount, core.resolveImageOptions(o).value.credits, JSON.stringify(o));
  }
});

test('n>1: la respuesta trae images[] (MIME correcto) e image (la primera), options y usage normalizado', async () => {
  reset({ openai: [{ status: 200, body: { data: [{ b64_json: 'QUJD' }, { b64_json: 'REVG' }], usage: { input_tokens: 10, input_tokens_details: { image_tokens: 4, text_tokens: 6 }, output_tokens: 200 } } }] });
  const out = await (await POST(req('generate-image', { prompt: 'x', n: 2, format: 'webp' }))).json();
  assert.deepEqual(out.images, ['data:image/webp;base64,QUJD', 'data:image/webp;base64,REVG']);
  assert.equal(out.image, out.images[0]);
  assert.deepEqual([out.options.n, out.options.format, out.options.quality, out.options.model], [2, 'webp', 'low', 'sunburst']);
  assert.deepEqual(out.usage, { in: 10, in_img: 4, in_txt: 6, out: 200 });
});

test('fondo transparente: fuerza webp y envía background=transparent (también con fotos de entrada)', async () => {
  reset();
  await POST(req('generate-image', { prompt: 'x', background: 'transparent', format: 'jpeg' }));
  assert.equal(sentGen().output_format, 'webp');
  assert.equal(sentGen().background, 'transparent');
  reset();
  await POST(req('generate-image', { prompt: 'x', background: 'transparent', images: [{ role: 'dish', data: PNG_1PX }] }));
  const form = called('/images/edits')[0].body;
  assert.equal(form.get('background'), 'transparent');
  assert.equal(form.get('output_format'), 'webp');
  assert.equal(form.get('n'), '1');
  assert.match(form.get('safety_identifier'), /^[0-9a-f]{64}$/);
  assert.equal(form.get('input_fidelity'), null);
});

test('opciones inválidas → 400 sin cobrar (incluye claves de prototipo)', async () => {
  for (const bad of [
    { model: '__proto__' }, { model: 'constructor' }, { quality: 'toString' }, { background: 'constructor' }, { format: '__proto__' },
    { aspectRatio: 'toString' }, { imageSize: '4K' }, { imageSize: 'custom', size: '100x100' }, { imageSize: 'custom', size: '5000x1000' },
    { n: 5 }, { n: 0 }, { n: '2' }, { compression: 10 }, { moderation: 'toString' }, { imageSize: '2K', n: 4, format: 'png' },
  ]) {
    reset();
    const r = await POST(req('generate-image', { prompt: 'x', ...bad }));
    assert.equal(r.status, 400, JSON.stringify(bad));
    assert.equal(called('rpc').length, 0, JSON.stringify(bad));
    assert.equal(called('api.openai.com').length, 0);
  }
});

test('moderation low: sin ser admin → 403 admin_only SIN cobrar; admin pasa y llega a OpenAI', async () => {
  reset();
  const r = await POST(req('generate-image', { prompt: 'x', moderation: 'low' }));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'admin_only');
  assert.equal(called('consume_credits').length, 0);
  assert.equal(called('api.openai.com').length, 0);

  reset({ membership: { is_active: true, role: 'admin' } });
  assert.equal((await POST(req('generate-image', { prompt: 'x', moderation: 'low' }))).status, 200);
  assert.equal(sentGen().moderation, 'low');
});

test('membresía INACTIVA con rol admin pidiendo moderation low → 403 admin_only sin cobrar; la consulta filtra por user_id', async () => {
  reset({ membership: { is_active: false, role: 'admin' } });
  const r = await POST(req('generate-image', { prompt: 'x', moderation: 'low' }));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'admin_only');
  assert.equal(called('consume_credits').length, 0);
  const q = called('app_memberships')[0].url;
  assert.match(q, /user_id=eq\.u1/);
  assert.match(q, /select=role%2Cis_active|select=role,is_active/);
});

test('rol ilegible: moderation low falla cerrado sin cobrar; sin moderation no se consulta el rol', async () => {
  reset({ membership: null });
  const r = await POST(req('generate-image', { prompt: 'x', moderation: 'low' }));
  assert.ok(r.status === 403 || r.status === 500);
  assert.equal(called('consume_credits').length, 0);
  reset();
  await POST(req('generate-image', { prompt: 'x' }));
  assert.equal(called('app_memberships').length, 0);
});

test('foto de entrada enorme (> 4.194.304 px) → 400 sin cobrar; sin dimensiones legibles → 400', async () => {
  reset();
  const r = await POST(req('generate-image', { prompt: 'x', images: [{ role: 'dish', data: pngOf(3000, 3000) }] }));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'bad_input_image');
  assert.equal(called('rpc').length, 0);
  reset();
  assert.equal((await POST(req('generate-image', { prompt: 'x', images: [{ role: 'dish', data: 'data:image/png;base64,QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=' }] }))).status, 400);
  assert.equal(called('rpc').length, 0);
});

test('las fotos de entrada se cobran por sus píxeles reales', async () => {
  reset();
  await POST(req('generate-image', { prompt: 'x', images: [{ role: 'dish', data: pngOf(1280, 960) }, { role: 'plate', data: pngOf(1280, 960) }] }));
  assert.equal(rpcBody('consume_credits').p_amount, core.resolveImageOptions({}, { inputImagePixels: [1280 * 960, 1280 * 960] }).value.credits);
  assert.equal(rpcBody('consume_credits').p_meta.inputs, 2);
});

test('record_usage: lleva el token de devolución, el uso normalizado y solo claves permitidas; el token no sale al navegador', async () => {
  reset({ openai: [{ status: 200, body: { data: [{ b64_json: 'QUJD' }], usage: { input_tokens: 5, output_tokens: 107 } } }] });
  const r = await POST(req('generate-image', { prompt: 'x' }));
  assert.ok(!(await r.text()).includes(TOKEN_SECRETO));
  const u = rpcBody('record_usage');
  assert.equal(u.p_log_id, 42);
  assert.equal(u.p_token, TOKEN_SECRETO);
  assert.deepEqual(u.p_usage, { in: 5, in_img: 0, in_txt: 0, out: 107, model: 'gpt-image-2.5-sunburst', quality: 'low', size: '1024x1024', n: 1 });
});

test('record_usage: admin envía p_token null; texto registra in/out/model con claves permitidas', async () => {
  reset({ consume: { ok: true, remaining: 0, log_id: 7, refund_token: null } });
  await POST(req('generate-image', { prompt: 'x' }));
  assert.equal(rpcBody('record_usage').p_token, null);
  reset({ chat: { status: 200, body: { choices: [{ message: { content: '### Pasta' } }], usage: { prompt_tokens: 30, completion_tokens: 80 } } } });
  await POST(req('generate-recipe', { prompt: 'x' }));
  const u = rpcBody('record_usage').p_usage;
  assert.deepEqual([u.in, u.out, u.model], [30, 80, 'gpt-4o-mini']);
  const allowed = new Set(['in', 'in_img', 'in_txt', 'out', 'n', 'model', 'quality', 'size']);
  assert.ok(Object.keys(u).every((k) => allowed.has(k)));
});

test('un fallo de record_usage NO rompe la generación ni devuelve el cobro; el log no trae el token', async () => {
  reset({ recordFail: true });
  const { result: r, lines } = await captureLogs(() => POST(req('generate-image', { prompt: 'x' })));
  assert.equal(r.status, 200);
  assert.equal(called('refund_credits').length, 0);
  assert.ok(appLogs(lines).some((l) => l.event === 'record_usage_failed'));
  assert.ok(!lines.join('\n').includes(TOKEN_SECRETO));
});

test('el log de éxito trae tokens, calidad, tamaño y el id de OpenAI, sin la imagen', async () => {
  reset({ openai: [{ status: 200, body: { data: [{ b64_json: 'QUJD' }], usage: { input_tokens: 1, output_tokens: 9 } } }] });
  const { lines } = await captureLogs(() => POST(req('generate-image', { prompt: 'x' })));
  const ok = appLogs(lines).find((l) => l.event === 'ok');
  assert.ok(ok && ok.tokens_out === 9 && ok.quality === 'low' && ok.size === '1024x1024' && ok.credits === 1 && ok.oai_rid === 'req_oai_123');
  assert.ok(!lines.join('\n').includes('QUJD'));
});

test('respuesta vacía de OpenAI → devolución del cobro y sin record_usage', async () => {
  reset({ openai: [{ status: 200, body: { data: [] } }] });
  const r = await POST(req('generate-image', { prompt: 'x' }));
  assert.equal(r.status, 502);
  assert.equal(called('refund_credits').length, 1);
  assert.equal(called('record_usage').length, 0);
});

test('devolución con el token cuando OpenAI falla (opciones avanzadas)', async () => {
  reset({ openai: [{ status: 500, body: {} }] });
  const r = await POST(req('generate-image', { prompt: 'x', quality: 'high', n: 2 }));
  assert.equal(r.status, 502);
  assert.equal(rpcBody('refund_credits').p_token, TOKEN_SECRETO);
  assert.ok(!(await r.text()).includes(TOKEN_SECRETO));
});
