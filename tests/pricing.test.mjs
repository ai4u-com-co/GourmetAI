// El cobro NUNCA puede quedar por debajo de lo que OpenAI cuenta de verdad (hallazgos de subcobro, 5-nov-2026).
// Dos capas: (1) la ESTIMACIÓN previa (estas pruebas) y (2) la LIQUIDACIÓN con el uso real (tests/generate.test.mjs), que corrige lo que la estimación no cubra.
// Los puntos viven en tests/fixtures/medido-2026-11-05.json: son llamadas reales a la API (calidad low).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { estimateOutputTokens, promptCostUnits, textTokens, creditsFor, creditsFromUsage, usdFromUsage } = await import('../api/_lib/openai-image-core.ts');
const medido = JSON.parse(readFileSync(new URL('./fixtures/medido-2026-11-05.json', import.meta.url), 'utf8'));

test('tokens de salida: ningún tamaño medido (31, incluidos verticales y ratio 1,5 grande) se estima por debajo de lo real', () => {
  for (const s of medido.sizes) {
    const est = estimateOutputTokens('low', s.width, s.height);
    assert.ok(est >= s.outputTokens, `${s.width}x${s.height}: se estima ${est} y la API contó ${s.outputTokens}`);
  }
});

test('celdas que señalaron las revisiones: 1792x1280, 2304x1536 (ratio 1,5, 3,5 Mpx), 2048x1360, 1600x1280', () => {
  assert.ok(estimateOutputTokens('low', 1792, 1280) >= 189);
  assert.ok(estimateOutputTokens('low', 2304, 1536) >= 244); // antes la curva apaisada daba <= 205
  assert.ok(estimateOutputTokens('low', 2048, 1360) >= 211);
  assert.ok(estimateOutputTokens('low', 1360, 2048) >= 211);
  assert.ok(estimateOutputTokens('low', 1600, 1280) >= 211);
});

test('la curva es monótona entre los puntos medidos de la banda 1,25–1,6 (sin escalones hacia abajo)', () => {
  let prev = 0;
  const px = (w, h) => w * h;
  const bandas = [[1024, 768], [1152, 864], [1152, 912], [1280, 960], [1280, 1024], [1408, 1024], [1456, 1120], [1536, 1152], [1600, 1120], [1664, 1152], [1600, 1280], [1792, 1280], [1920, 1280], [2048, 1408], [2304, 1536]];
  bandas.sort((a, b) => px(...a) - px(...b));
  for (const [w, h] of bandas) {
    const e = estimateOutputTokens('low', w, h);
    assert.ok(e >= prev, `${w}x${h}: ${e} < ${prev}`);
    prev = e;
  }
});

test('lo no medido cae a la curva cuadrada (la más cara), nunca a una más barata', () => {
  assert.ok(estimateOutputTokens('low', 1280, 1152) >= 196); // ratio 1,11
  assert.ok(estimateOutputTokens('low', 1536, 1280) >= 207); // ratio 1,2
  assert.ok(estimateOutputTokens('low', 2400, 1536) >= 244); // ratio 1,56 y 3,69 Mpx: por encima de lo medido en la banda, cuadrada
});

test('verticales cuestan igual que su apaisado', () => {
  assert.equal(estimateOutputTokens('low', 1024, 1536), estimateOutputTokens('low', 1536, 1024));
  assert.equal(estimateOutputTokens('low', 720, 1280), estimateOutputTokens('low', 1280, 720));
  assert.equal(estimateOutputTokens('low', 1360, 2048), estimateOutputTokens('low', 2048, 1360));
});

test('texto: ningún prompt de la familia NO ASCII (CJK, emoji, Latin Extendido, astral) se estima por debajo de lo real', () => {
  for (const p of medido.prompts.filter((x) => !x.settled)) {
    const est = textTokens(promptCostUnits(p.text));
    assert.ok(est >= p.textTokens, `${p.name}: se estima ${est} y la API contó ${p.textTokens}`);
  }
});

test('texto ASCII aleatorio SÍ puede costar más que la estimación: lo cubre la liquidación con el uso real', () => {
  for (const p of medido.prompts.filter((x) => x.settled)) {
    const real = { input_tokens_details: { text_tokens: p.textTokens }, output_tokens: 196 };
    const estimado = creditsFor({ quality: 'low', width: 1024, height: 1024, n: 1, promptChars: promptCostUnits(p.text) });
    assert.ok(creditsFromUsage(real) >= estimado - 1, p.name); // la liquidación nunca da menos que lo real; la diferencia se cobra al terminar
  }
});

test('creditsFromUsage / usdFromUsage', () => {
  const u = { input_tokens_details: { image_tokens: 0, text_tokens: 14 }, output_tokens: 196 };
  assert.ok(Math.abs(usdFromUsage(u) - (196 * 30 + 14 * 5) / 1e6) < 1e-12);
  assert.equal(creditsFromUsage(u), 2);
  assert.equal(creditsFromUsage({ output_tokens: 364 * 8.95 | 0 }), 22);
  assert.equal(creditsFromUsage(undefined), 0); // sin uso utilizable: se queda lo cobrado
  assert.equal(creditsFromUsage({ output_tokens: -5, input_tokens_details: { text_tokens: 'x' } }), 0);
});

test('un prompt natural de 1000 caracteres sigue costando 2 créditos a 1024² calidad low', () => {
  const natural = medido.prompts.find((p) => p.name === 'espanol_natural').text.slice(0, 1000);
  const c = creditsFor({ quality: 'low', width: 1024, height: 1024, n: 1, promptChars: promptCostUnits(natural) });
  assert.equal(c, 2);
});
