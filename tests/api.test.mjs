// Pruebas de api/[action].ts con Supabase y OpenAI simulados a nivel de fetch (sin red, sin secretos).
// Ejecutar: npm test   (Node >= 22.18 entiende TypeScript sin compilar)
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = 'sk-prueba-no-real';
const { POST } = await import('../api/[action].ts');

const PNG_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TOKEN_SECRETO = 'token-secreto-de-devolucion-que-no-debe-salir';

let world;
const reset = (over = {}) => {
  world = {
    calls: [],
    userOk: true,
    consume: { ok: true, remaining: 9, log_id: 42, refund_token: TOKEN_SECRETO },
    consumeError: null,
    refund: { ok: true, remaining: 10 },
    membership: { is_active: true },
    openai: [{ status: 200, body: { data: [{ b64_json: 'QUJD' }] } }],
    chat: { status: 200, body: { choices: [{ message: { content: 'harina, huevos' } }] } },
    ...over,
  };
};
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const body = typeof init.body === 'string' ? init.body : init.body instanceof FormData ? init.body : null;
  world.calls.push({ url, init, body });
  if (url.includes('/auth/v1/user')) return world.userOk ? j(200, { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'a@b.co' }) : j(401, { msg: 'bad jwt' });
  if (url.includes('/rest/v1/rpc/consume_credits')) return world.consumeError ? j(world.consumeError.http, world.consumeError.body) : j(200, world.consume);
  if (url.includes('/rest/v1/rpc/refund_credits')) return j(200, world.refund);
  if (url.includes('/rest/v1/app_memberships')) return j(200, world.membership ? [world.membership] : []);
  if (url.includes('api.openai.com/v1/chat/completions')) return j(world.chat.status, world.chat.body);
  if (url.includes('api.openai.com')) {
    const next = world.openai.length > 1 ? world.openai.shift() : world.openai[0];
    return j(next.status, next.body);
  }
  throw new Error(`fetch no simulado: ${url}`);
};

const req = (action, body, headers = { authorization: 'Bearer jwt-ok' }) =>
  new Request(`https://x.test/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const good = { prompt: 'un plato', aspectRatio: '1:1', imageSize: '1K', quality: 'low', images: [] };
const called = (frag) => world.calls.filter((c) => c.url.includes(frag));
const rpcBody = (name) => JSON.parse(called(`/rpc/${name}`)[0].init.body);

test('ruta desconocida responde 404', async () => {
  reset();
  assert.equal((await POST(req('otra-cosa', good))).status, 404);
});

test('sin OPENAI_API_KEY responde 500 sin tocar nada', async () => {
  reset();
  const k = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const r = await POST(req('generate-image', good));
  process.env.OPENAI_API_KEY = k;
  assert.equal(r.status, 500);
  assert.equal(world.calls.length, 0);
});

for (const action of ['generate-image', 'generate-recipe', 'analyze-image']) {
  test(`${action}: sin Authorization responde 401 y no cobra ni llama a OpenAI`, async () => {
    reset();
    const r = await POST(req(action, { ...good, image: PNG_1PX }, {}));
    assert.equal(r.status, 401);
    assert.equal(called('rpc').length, 0);
    assert.equal(called('openai').length, 0);
  });
  test(`${action}: JWT inválido responde 401 y no cobra`, async () => {
    reset({ userOk: false });
    const r = await POST(req(action, { ...good, image: PNG_1PX }));
    assert.equal(r.status, 401);
    assert.equal(called('rpc').length, 0);
    assert.equal(called('openai').length, 0);
  });
}

test('generate-image: solicitud inválida responde 400 sin cobrar', async () => {
  for (const bad of [
    { ...good, quality: 'ultra' },
    { ...good, quality: 'constructor' },
    { ...good, quality: '__proto__' },
    { ...good, imageSize: 'constructor', aspectRatio: 'name' },
    { ...good, imageSize: '4K' },
    { ...good, aspectRatio: '5:7' },
    { ...good, prompt: '' },
    { ...good, prompt: 'x'.repeat(8001) },
    { ...good, images: ['no-es-objeto'] },
    { ...good, images: [{ role: 'dish', data: 'http://malo.test/a.png' }] },
    { ...good, images: [{ role: 'constructor', data: PNG_1PX }] },
    { ...good, images: [{ role: 'dish', data: PNG_1PX }, { role: 'dish', data: PNG_1PX }] }, // rol repetido
    { ...good, images: ['plate', 'table', 'restaurant', 'cutlery', 'dish', 'dish'].map((role) => ({ role, data: PNG_1PX })) },
    { ...good, images: [{ role: 'dish', data: 'data:image/png;base64,' + 'A'.repeat(1_100_000) }] },
  ]) {
    reset();
    const r = await POST(req('generate-image', bad));
    assert.equal(r.status, 400, JSON.stringify(bad).slice(0, 80));
    assert.equal(called('rpc').length, 0);
    assert.equal(called('openai').length, 0);
  }
});

test('generate-image: cobra ANTES de llamar a OpenAI, con el monto correcto, y no filtra el token', async () => {
  reset();
  const r = await POST(req('generate-image', good));
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.match(out.image, /^data:image\/jpeg;base64,QUJD$/);
  assert.equal(out.charged, 1);
  assert.equal(out.remaining, 9);
  assert.ok(!JSON.stringify(out).includes(TOKEN_SECRETO));
  const iConsume = world.calls.findIndex((c) => c.url.includes('consume_credits'));
  const iOpenai = world.calls.findIndex((c) => c.url.includes('api.openai.com'));
  assert.ok(iConsume > -1 && iConsume < iOpenai, 'el cobro debe ir antes de OpenAI');
  assert.equal(rpcBody('consume_credits').p_app, 'gourmetai');
  assert.equal(rpcBody('consume_credits').p_amount, 1);
  assert.equal(called('refund_credits').length, 0);
});

test('generate-image: el costo depende de la calidad y del tamaño (medium 2K = 8, high 1K = 15)', async () => {
  for (const [quality, imageSize, amount] of [['medium', '2K', 8], ['high', '1K', 15], ['low', '2K', 2]]) {
    reset();
    await POST(req('generate-image', { ...good, quality, imageSize }));
    assert.equal(rpcBody('consume_credits').p_amount, amount);
  }
});

test('generate-image: sin fotos usa /images/generations; con fotos usa /images/edits en el orden de los roles', async () => {
  reset();
  await POST(req('generate-image', good));
  assert.ok(called('/images/generations').length === 1 && called('/images/edits').length === 0);

  reset();
  // el cliente las manda desordenadas: el servidor las ordena y rotula
  await POST(req('generate-image', { ...good, images: [{ role: 'table', data: PNG_1PX }, { role: 'dish', data: PNG_1PX }] }));
  const edit = called('/images/edits')[0];
  assert.ok(edit, 'debe usar edits');
  assert.equal(edit.body.getAll('image[]').length, 2);
  assert.match(edit.body.get('prompt'), /image 1 is the ORIGINAL DISH.*image 2 is the TABLE/s);
  assert.equal(edit.body.get('output_format'), 'jpeg');
});

test('generate-image: si OpenAI falla devuelve el cobro y dice que no se cobró (sin filtrar el error ni el token)', async () => {
  reset({ openai: [{ status: 500, body: { error: { message: 'detalle interno sk-secreto' } } }] });
  const r = await POST(req('generate-image', good));
  assert.equal(r.status, 502);
  const text = await r.text();
  assert.ok(!text.includes('sk-secreto') && !text.includes(TOKEN_SECRETO));
  assert.match(text, /No se te cobró/);
  assert.equal(called('refund_credits').length, 1);
  assert.equal(rpcBody('refund_credits').p_token, TOKEN_SECRETO);
});

test('generate-image: moderación → 422 con devolución; saturación (429) → 503', async () => {
  reset({ openai: [{ status: 400, body: { error: { code: 'moderation_blocked' } } }] });
  assert.equal((await POST(req('generate-image', good))).status, 422);
  assert.equal(called('refund_credits').length, 1);
  reset({ openai: [{ status: 429, body: {} }] });
  assert.equal((await POST(req('generate-image', good))).status, 503);
});

test('generate-image: si el modelo 2.5 no existe cae al gpt-image-2 una sola vez', async () => {
  reset({ openai: [{ status: 404, body: { error: { code: 'model_not_found' } } }, { status: 200, body: { data: [{ b64_json: 'QUJD' }] } }] });
  const r = await POST(req('generate-image', good));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).model, 'gpt-image-2');
  assert.equal(called('api.openai.com').length, 2);
  assert.equal(called('consume_credits').length, 1);
});

test('generate-image: saldo insuficiente → 402 y no llama a OpenAI', async () => {
  reset({ consume: { ok: false, remaining: 0 } });
  const r = await POST(req('generate-image', good));
  assert.equal(r.status, 402);
  assert.equal(called('api.openai.com').length, 0);
});

test('generate-image: cuenta sin acceso (42501) → 403', async () => {
  reset({ consumeError: { http: 403, body: { code: '42501', message: 'no access' } } });
  const r = await POST(req('generate-image', good));
  assert.equal(r.status, 403);
  assert.equal(called('api.openai.com').length, 0);
});

test('generate-image: admin no paga (sin refund_token) y una falla no intenta devolver nada', async () => {
  reset({ consume: { ok: true, remaining: 0, log_id: 7, refund_token: null }, openai: [{ status: 500, body: {} }] });
  const r = await POST(req('generate-image', good));
  assert.equal(r.status, 502);
  assert.equal(called('refund_credits').length, 0);
  reset({ consume: { ok: true, remaining: 0, log_id: 7, refund_token: null } });
  assert.equal((await (await POST(req('generate-image', good))).json()).charged, 0);
});

test('generate-recipe: cobra 1 crédito antes de pedir el texto y devuelve la receta', async () => {
  reset({ chat: { status: 200, body: { choices: [{ message: { content: '### Pasta' } }] } } });
  const r = await POST(req('generate-recipe', { prompt: 'una receta' }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).recipe, '### Pasta');
  assert.equal(rpcBody('consume_credits').p_amount, 1);
  assert.equal(rpcBody('consume_credits').p_action, 'recipe');
});

test('generate-recipe: prompt vacío o gigante → 400; fallo de OpenAI → devuelve el cobro', async () => {
  for (const prompt of ['', 'x'.repeat(8001), 5]) {
    reset();
    assert.equal((await POST(req('generate-recipe', { prompt }))).status, 400);
    assert.equal(called('rpc').length, 0);
  }
  reset({ chat: { status: 500, body: { error: { message: 'interno' } } } });
  const r = await POST(req('generate-recipe', { prompt: 'x' }));
  assert.equal(r.status, 502);
  assert.equal(called('refund_credits').length, 1);
});

test('analyze-image: cobra 1 crédito ANTES de pedir el texto y devuelve los ingredientes', async () => {
  reset();
  const r = await POST(req('analyze-image', { image: PNG_1PX }));
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.ingredients, 'harina, huevos');
  assert.equal(out.charged, 1);
  assert.ok(!JSON.stringify(out).includes(TOKEN_SECRETO));
  assert.equal(rpcBody('consume_credits').p_amount, 1);
  assert.equal(rpcBody('consume_credits').p_action, 'analyze');
  const iConsume = world.calls.findIndex((c) => c.url.includes('consume_credits'));
  const iOpenai = world.calls.findIndex((c) => c.url.includes('api.openai.com'));
  assert.ok(iConsume > -1 && iConsume < iOpenai, 'el cobro debe ir antes de OpenAI');
});

test('analyze-image: sin saldo → 402; sin acceso → 403; ninguno llama a OpenAI', async () => {
  reset({ consume: { ok: false, remaining: 0 } });
  assert.equal((await POST(req('analyze-image', { image: PNG_1PX }))).status, 402);
  reset({ consumeError: { http: 403, body: { code: '42501', message: 'no access' } } });
  assert.equal((await POST(req('analyze-image', { image: PNG_1PX }))).status, 403);
  assert.equal(called('api.openai.com').length, 0);
});

test('analyze-image: si OpenAI falla devuelve el cobro', async () => {
  reset({ chat: { status: 500, body: { error: { message: 'interno' } } } });
  const r = await POST(req('analyze-image', { image: PNG_1PX }));
  assert.equal(r.status, 502);
  assert.equal(called('refund_credits').length, 1);
  assert.match(await r.text(), /No se te cobró/);
});

test('analyze-image: imagen inválida → 400', async () => {
  for (const image of ['', 'http://x.test/a.png', 'data:image/gif;base64,AAAA', 5]) {
    reset();
    assert.equal((await POST(req('analyze-image', { image }))).status, 400);
    assert.equal(called('api.openai.com').length, 0);
  }
});

// ---------------------------------------------------------------- registro y referencia de error
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

test('toda respuesta lleva requestId (cuerpo y cabecera x-request-id), también los errores', async () => {
  for (const [action, body, headers] of [
    ['generate-image', good, { authorization: 'Bearer jwt-ok' }],
    ['generate-image', good, {}],
    ['otra-cosa', good, {}],
    ['generate-image', { ...good, quality: 'ultra' }, { authorization: 'Bearer jwt-ok' }],
  ]) {
    reset();
    const r = await POST(req(action, body, headers));
    const out = await r.json();
    assert.match(out.requestId, /^[0-9a-f]{8}$/);
    assert.equal(r.headers.get('x-request-id'), out.requestId);
  }
});

test('sin OPENAI_API_KEY responde JSON claro con requestId y lo registra como error', async () => {
  reset();
  const k = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const { result: r, lines } = await captureLogs(() => POST(req('generate-image', good)));
  process.env.OPENAI_API_KEY = k;
  assert.equal(r.status, 500);
  const out = await r.json();
  assert.equal(out.error, 'server_misconfigured');
  assert.ok(appLogs(lines).some((l) => l.level === 'error' && l.event === 'server_misconfigured' && l.rid === out.requestId));
});

test('fallo de OpenAI: el log trae estado, código, id de OpenAI y rid, y NO trae secretos, prompts ni tokens', async () => {
  reset({ openai: [{ status: 500, body: { error: { message: 'detalle interno sk-secreto-del-cuerpo', code: 'server_error' } } }] });
  const { result: r, lines } = await captureLogs(() => POST(req('generate-image', { ...good, prompt: 'PROMPT-PRIVADO-123' })));
  assert.equal(r.status, 502);
  const out = await r.json();
  const logs = appLogs(lines);
  const failed = logs.find((l) => l.event === 'openai_failed');
  assert.ok(failed, 'debe registrar openai_failed');
  assert.equal(failed.status, 500);
  assert.equal(failed.code, 'server_error');
  assert.equal(failed.rid, out.requestId);
  assert.equal(failed.action, 'generate-image');
  assert.equal(failed.user, 'u1');
  assert.ok(logs.some((l) => l.event === 'charged' && l.amount === 1));
  assert.ok(logs.some((l) => l.event === 'refunded'));
  const all = lines.join('\n');
  for (const secreto of ['sk-prueba-no-real', 'sk-secreto-del-cuerpo', TOKEN_SECRETO, 'jwt-ok', 'PROMPT-PRIVADO-123', 'a@b.co']) {
    assert.ok(!all.includes(secreto), `el log no debe contener: ${secreto}`);
  }
});

test('si no se pudo devolver el cobro se registra como error (para atenderlo a mano)', async () => {
  reset({ openai: [{ status: 500, body: {} }], refund: { ok: false } });
  const { result: r, lines } = await captureLogs(() => POST(req('generate-image', good)));
  assert.equal(r.status, 502);
  assert.match((await r.json()).message, /escríbenos/);
  assert.ok(appLogs(lines).some((l) => l.level === 'error' && l.event === 'refund_failed'));
});

test('éxito: se registra ok con duración y sin la imagen', async () => {
  reset();
  const { lines } = await captureLogs(() => POST(req('generate-image', good)));
  const ok = appLogs(lines).find((l) => l.event === 'ok');
  assert.ok(ok && typeof ok.ms === 'number');
  assert.ok(!lines.join('\n').includes('QUJD'));
});

test('analyze-image: pide español, solo lo visible y sin inventar; «ninguno» (no es comida) vuelve vacío', async () => {
  reset({ chat: { status: 200, body: { choices: [{ message: { content: 'Ninguno' } }] } } });
  const r = await POST(req('analyze-image', { image: PNG_1PX }));
  assert.equal((await r.json()).ingredients, '');
  const sent = JSON.parse(called('chat/completions')[0].init.body);
  const userText = sent.messages[1].content[0].text;
  assert.match(userText, /en español/);
  assert.match(userText, /no inventes/);
  assert.match(userText, /máximo 15/);
  assert.equal(sent.messages[1].content[1].image_url.detail, 'low');
});

test('generate-recipe: el mensaje de sistema fija rol, idioma y formato', async () => {
  reset();
  await POST(req('generate-recipe', { prompt: 'x' }));
  const sent = JSON.parse(called('chat/completions')[0].init.body);
  assert.match(sent.messages[0].content, /chef profesional/);
  assert.match(sent.messages[0].content, /español/);
  assert.match(sent.messages[0].content, /Markdown/);
});

test('generate-image: la numeración de imágenes explica el rol y prohíbe copiar comida de las referencias', async () => {
  reset();
  await POST(req('generate-image', { ...good, images: [{ role: 'plate', data: PNG_1PX }, { role: 'dish', data: PNG_1PX }] }));
  const p = called('/images/edits')[0].body.get('prompt');
  assert.match(p, /image 1 is the ORIGINAL DISH photo.*image 2 is the PLATE reference/s);
  assert.match(p, /never copy food from a reference image/);
});

// ---------------------------------------------------------------- valores por defecto: GPT Image 2.5 y la opción más económica
test('sin calidad ni tamaño: usa Borrador y 1K (1 crédito) con gpt-image-2.5-sunburst', async () => {
  reset();
  const { prompt, aspectRatio } = good;
  const r = await POST(req('generate-image', { prompt, aspectRatio, images: [] }));
  assert.equal(r.status, 200);
  const out = await r.json();
  assert.equal(out.model, 'gpt-image-2.5-sunburst');
  assert.equal(rpcBody('consume_credits').p_amount, 1);
  const sent = JSON.parse(called('/images/generations')[0].init.body);
  assert.equal(sent.model, 'gpt-image-2.5-sunburst');
  assert.equal(sent.quality, 'low');
  assert.equal(sent.size, '1024x1024');
});

test('un valor inválido sigue rechazándose (no se «corrige» a otro más caro ni más barato)', async () => {
  reset();
  assert.equal((await POST(req('generate-image', { ...good, quality: 'ultra' }))).status, 400);
  assert.equal(called('rpc').length, 0);
});

test('el modelo usado queda en el log del éxito', async () => {
  reset();
  const { lines } = await captureLogs(() => POST(req('generate-image', good)));
  assert.equal(appLogs(lines).find((l) => l.event === 'ok').model, 'gpt-image-2.5-sunburst');
});
