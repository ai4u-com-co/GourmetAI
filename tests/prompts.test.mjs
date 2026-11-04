// Pruebas de src/services/promptBuilder.ts: estructura según la guía de OpenAI, sin ruido y dentro del límite del servidor (8000).
import test from 'node:test';
import assert from 'node:assert/strict';

const { buildPrompt, buildRecipePrompt } = await import('../src/services/promptBuilder.ts');

const base = {
  intensidadGourmet: 5, estiloPlato: 'rustico', iluminacion: 'natural', fondo: 'madera', decoracionesExtra: [],
  anguloCamara: '45', tipoVajilla: 'redondo', colorVajilla: 'blanco', ambiente: 'sin-preferencia', momentoDelDia: 'sin-preferencia',
  profundidadCampo: 'moderado', aspectRatio: '1:1', efectoVapor: 'sin-vapor', efectoFrescura: 'sin-efecto',
};
const full = {
  ...base, intensidadGourmet: 9, decoracionesExtra: ['microgreens', 'flores-comestibles', 'drizzle', 'citricos', 'especias', 'salsas-decorativas'],
  props: ['cubiertos', 'servilleta', 'copa', 'hierbas', 'ingredientes'], saturacion: 'vibrante', texturaFondo: 'rustica', direccionLuz: 'lateral',
  efectoVapor: 'intenso', efectoFrescura: 'gotas', ambiente: 'restaurante', momentoDelDia: 'cena',
  cuisineType: ['italiana', 'mediterránea'], dishCategory: ['plato fuerte'], cookingTechnique: ['horno'], culinaryTags: ['vegano', 'sin gluten'],
  plateImage: 'x', tableImage: 'x', restaurantImage: 'x', cutleryImage: 'x',
};
const ING = 'pasta, tomate, albahaca';

test('edición: separa CAMBIA de CONSERVA, trae realismo y exclusiones, y conserva los ingredientes', () => {
  const p = buildPrompt(base, ING, false);
  for (const h of ['TASK:', 'CHANGE (only this):', 'PRESERVE (must stay the same', 'SPECIFICATIONS:', 'REALISM:', 'EXCLUDE:']) assert.ok(p.includes(h), h);
  assert.match(p, /pasta, tomate, albahaca/);
  assert.match(p, /Do not add, remove, replace or invent any food/);
  assert.match(p, /No text, letters, logos, watermarks/);
  assert.ok(p.indexOf('CHANGE') < p.indexOf('PRESERVE') && p.indexOf('PRESERVE') < p.indexOf('SPECIFICATIONS'));
});

test('sin ruido: ninguna línea vacía con solo guion, sin sangrías raras ni marcas de marca ni línea de formato', () => {
  for (const [params, scratch] of [[base, false], [base, true], [full, false], [full, true]]) {
    const p = buildPrompt(params, ING, scratch);
    assert.ok(!/^\s*-\s*$/m.test(p), 'bullet vacío');
    assert.ok(!/^[ \t]+\S/m.test(p), 'línea con sangría');
    assert.ok(!/\n{3,}/.test(p), 'más de una línea en blanco seguida');
    assert.ok(!/Michelin|Bon App/i.test(p), 'referencia de marca');
    assert.ok(!/Format:/i.test(p), 'el formato lo fija la API (size), no el texto');
    assert.ok(!/undefined|null|\[object/.test(p), 'valor sin resolver');
  }
});

test('las referencias solo aparecen si hay foto, y nunca se copia comida de ellas', () => {
  const sin = buildPrompt(base, ING, false);
  assert.ok(!/REFERENCES/.test(sin) && !/PLATE reference/.test(sin));
  const con = buildPrompt(full, ING, false);
  for (const r of ['PLATE reference', 'TABLE reference', 'RESTAURANT reference', 'CUTLERY reference']) assert.ok(con.includes(r), r);
  assert.match(con, /never copy food from them/);
});

test('el nivel de transformación cambia con la intensidad', () => {
  assert.match(buildPrompt({ ...base, intensidadGourmet: 2 }, ING), /subtle/);
  assert.match(buildPrompt({ ...base, intensidadGourmet: 5 }, ING), /moderate/);
  assert.match(buildPrompt({ ...base, intensidadGourmet: 9 }, ING), /haute-cuisine/);
});

test('desde cero: tarea, detalles culinarios, realismo y exclusiones; sin CAMBIA/CONSERVA', () => {
  const p = buildPrompt(full, 'Concepto: lasaña. Ingredientes: pasta', true);
  assert.match(p, /TASK: Photorealistic professional food photograph of this dish: "Concepto: lasaña/);
  assert.match(p, /Cuisine: italiana, mediterránea/);
  assert.match(p, /Technique: horno/);
  assert.ok(!/PRESERVE|CHANGE \(only/.test(p));
  assert.match(p, /EXCLUDE:/);
});

test('el caso más cargado cabe en el límite del servidor (8000) con margen', () => {
  const largo = 'ingrediente '.repeat(120);
  for (const scratch of [false, true]) assert.ok(buildPrompt(full, largo, scratch).length < 6000);
  assert.ok(buildRecipePrompt(largo, full, largo).length < 6000);
});

test('receta: contexto, formato fijo en español y sin pedir "coincidir con la foto"', () => {
  const p = buildRecipePrompt('Lasaña de verduras', { ...full, ingredients: '' }, ING);
  assert.match(p, /Plato: "Lasaña de verduras"/);
  assert.match(p, /Ingredientes base: pasta, tomate, albahaca/);
  assert.match(p, /Tipo de cocina: italiana, mediterránea/);
  for (const h of ['**Porciones:**', '**Descripción:**', '**Ingredientes:**', '**Preparación:**', '**Consejo del chef:**']) assert.ok(p.includes(h), h);
  assert.match(p, /\(opcional\)/);
  assert.match(p, /unidades métricas/);
  assert.ok(!/EXACTAMENTE con el plato que se muestra|fotografía generada/i.test(p));
  assert.ok(!/undefined|null|\[object/.test(p));
});

test('receta sin parámetros opcionales no deja líneas vacías', () => {
  const p = buildRecipePrompt('Arepa', base, '');
  assert.ok(!/^- [A-Za-zÁ-ú ]+: *$/m.test(p));
  assert.ok(!/Ingredientes base/.test(p));
});

test('constantes por defecto: calidad Borrador y tamaño 1K', async () => {
  const c = await import('../src/constants/parameters.ts');
  assert.equal(c.DEFAULT_QUALITY, 'low');
  assert.equal(c.DEFAULT_IMAGE_SIZE, '1K');
});
