// Opciones del cliente (src/services/imageOptions.ts) y prompts de recorte / plato sagrado.
import test from 'node:test';
import assert from 'node:assert/strict';

const core = await import('../src/services/openai-image-core.ts');
const opt = await import('../src/services/imageOptions.ts');
const { buildPrompt } = await import('../src/services/promptBuilder.ts');

const base = {
  intensidadGourmet: 9, estiloPlato: 'rustico', iluminacion: 'natural', fondo: 'madera', decoracionesExtra: [], anguloCamara: '45',
  tipoVajilla: 'redondo', colorVajilla: 'blanco', ambiente: 'restaurante', momentoDelDia: 'cena', profundidadCampo: 'moderado',
  aspectRatio: '1:1', efectoVapor: 'sin-vapor', efectoFrescura: 'sin-efecto', props: ['copa'], tableImage: 'x', restaurantImage: 'x', plateImage: 'x',
};

test('sin opciones: lo más económico (sunburst, low, 1K, jpeg, auto, 1) y costo 1', () => {
  const o = opt.imageRequestOptions({ ...base });
  assert.deepEqual([o.model, o.quality, o.imageSize, o.format, o.background, o.n], ['sunburst', 'low', '1K', 'jpeg', 'auto', 1]);
  assert.equal(opt.estimateImage(base, [], false).value.credits, 1);
  assert.ok(opt.isCheapest(base));
});

test('valores viejos o inexistentes (historial antiguo) se normalizan a los defaults', () => {
  const o = opt.imageRequestOptions({ ...base, quality: 'ultra', imageSize: '4K', model: 'constructor', format: '__proto__', background: 'x', numberOfImages: 9, aspectRatio: '5:7' });
  assert.deepEqual([o.model, o.quality, o.imageSize, o.format, o.background, o.n, o.aspectRatio], ['sunburst', 'low', '1K', 'jpeg', 'auto', 1, '1:1']);
});

test('el costo coincide con el núcleo y suma las fotos de entrada por píxeles', () => {
  const e = opt.estimateImage({ ...base, quality: 'high', numberOfImages: 2 }, [1280 * 960], false);
  assert.ok(e.ok);
  assert.equal(e.value.credits, core.resolveImageOptions({ quality: 'high', n: 2 }, { inputImagePixels: [1280 * 960] }).value.credits);
  assert.ok(e.value.credits > opt.estimateImage({ ...base, quality: 'high', numberOfImages: 2 }, [], false).value.credits);
});

test('tamaño personalizado se valida; moderación baja solo cuenta para admin', () => {
  assert.equal(opt.estimateImage({ ...base, imageSize: 'custom', customSize: '1000x1000' }, [], false).ok, false);
  assert.equal(opt.estimateImage({ ...base, imageSize: 'custom', customSize: '1280x720' }, [], false).ok, true);
  assert.equal(opt.estimateImage({ ...base, moderation: 'low' }, [], false).ok, false);
  assert.equal(opt.estimateImage({ ...base, moderation: 'low' }, [], true).ok, true);
});

test('extensión según el tipo devuelto', () => {
  assert.equal(opt.extensionOf('data:image/webp;base64,AA'), 'webp');
  assert.equal(opt.extensionOf('data:image/jpeg;base64,AA'), 'jpg');
});

test('el plato es sagrado: misma comida, mismas cantidades, misma disposición', () => {
  const p = buildPrompt(base, 'pasta', false);
  assert.match(p, /Do not change the food: same ingredients \(pasta\), same quantities, same arrangement/);
  assert.match(p, /plating style and setting, not the food itself/);
  assert.match(p, /Photorealistic editorial food photography/);
  assert.ok(!/8k|masterpiece|ultra detailed/i.test(p));
});

test('recorte (fondo transparente): aísla el plato, sin mesa ni ambiente ni props', () => {
  const p = buildPrompt({ ...base, background: 'transparent' }, 'pasta', false);
  assert.match(p, /fully transparent background, with clean alpha edges/);
  assert.match(p, /no shadow, no checkerboard/);
  assert.ok(!/Surface\/background|Atmosphere|Props:|TABLE reference|RESTAURANT reference/.test(p));
  assert.match(p, /PLATE reference/);
});

test('con foto de mesa, la superficie sale de la referencia y no de un material inventado', () => {
  const p = buildPrompt(base, 'pasta', false);
  assert.match(p, /Surface\/background: the table shown in the TABLE reference image/);
});
