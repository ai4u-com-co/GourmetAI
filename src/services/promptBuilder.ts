import type { DishParameters } from '../types';

// Prompts de la app, escritos según la guía oficial de OpenAI para GPT Image 2.5
// (https://developers.openai.com/api/docs/guides/image-prompting):
//   · el resultado primero y secciones etiquetadas (tarea · cambia · se conserva · especificaciones · realismo · exclusiones);
//   · en ediciones, separar con claridad lo que CAMBIA de lo que se CONSERVA, y excluir añadidos no pedidos;
//   · pedir realismo explícito (texturas e imperfecciones naturales), sin glamurizar ni retocar de más;
//   · nada de líneas vacías: cada parámetro sin valor simplemente no aparece.
// Las fotos de referencia viajan aparte: el servidor las numera y les asigna su rol ("image 1 is the ORIGINAL DISH…").
// El tamaño y la proporción los fija el parámetro `size` de la API, no el texto. El prompt completo debe caber en 8000 caracteres.

const list = (v: string | string[] | undefined): string => (Array.isArray(v) ? v.filter(Boolean).join(', ') : v || '');

const section = (title: string, lines: (string | false | undefined)[]): string => {
  const body = lines.filter((l): l is string => typeof l === 'string' && l.trim() !== '');
  return body.length ? `${title}\n${body.join('\n')}` : '';
};

const REALISM = [
  '- Natural, unretouched food photography: real textures (crumb, sheen, moisture, char), small natural imperfections, appetizing and fresh.',
  '- Not plastic, not over-smoothed, no heavy retouching or glamorization.',
];

const EXCLUDE = [
  '- No text, letters, logos, watermarks, borders or frames.',
  '- No people or hands, no extra dishes, foods or utensils beyond what is specified.',
  '- No distorted plates, melted geometry or duplicated elements.',
];

/** Prompt de imagen: mejora una foto existente (isFromScratch=false) o crea un plato desde una idea (true). */
export const buildPrompt = (parameters: DishParameters, input: string, isFromScratch: boolean = false): string => {
  const {
    intensidadGourmet,
    estiloPlato,
    iluminacion,
    fondo,
    decoracionesExtra,
    anguloCamara,
    tipoVajilla,
    colorVajilla,
    ambiente,
    momentoDelDia,
    profundidadCampo,
    efectoVapor,
    efectoFrescura,
    direccionLuz,
    props,
    saturacion,
    texturaFondo,
    cuisineType,
    dishCategory,
    cookingTechnique,
    culinaryTags
  } = parameters;

  const estiloMap: Record<string, string> = {
    'rustico': 'rustic and homemade style',
    'minimalista': 'minimalist and clean style',
    'clasico-elegante': 'classic and elegant style',
    'moderno': 'modern and avant-garde style'
  };

  const iluminacionMap: Record<string, string> = {
    'natural': 'soft natural lighting',
    'calida': 'warm and cozy lighting',
    'estudio': 'professional studio lighting',
    'dramatica': 'dramatic lighting with high contrast',
    'suave': 'soft and diffused lighting'
  };

  const fondoMap: Record<string, string> = {
    'madera': 'wooden surface',
    'marmol': 'marble surface',
    'negro': 'black background',
    'blanco': 'white background',
    'granito': 'granite surface',
    'concreto': 'polished concrete surface',
    'tela': 'linen cloth or tablecloth',
    'original': 'elegant neutral background'
  };

  const anguloMap: Record<string, string> = {
    'cenital': 'overhead zenith view (90 degrees)',
    '75': 'near-zenith view from 75 degrees',
    '45': 'classic 45-degree angle view',
    '30': 'low view from 30 degrees',
    'lateral': 'side view at plate level',
    'hero': 'dramatic frontal hero shot',
    'diagonal': 'diagonal view from a corner',
    'picado': 'tilted overhead view'
  };

  const tipoVajillaMap: Record<string, string> = {
    'original': 'appropriate elegant plate',
    'redondo': 'round porcelain plate',
    'cuadrado': 'minimalist square plate',
    'rectangular': 'elongated rectangular plate',
    'bowl': 'elegant deep bowl',
    'pizarra': 'natural black slate',
    'tabla-madera': 'rustic wooden board'
  };

  const colorVajillaMap: Record<string, string> = {
    'original': 'neutral elegant color',
    'blanco': 'classic white',
    'negro': 'matte black',
    'terracota': 'warm terracotta',
    'crema': 'soft cream'
  };

  const ambienteMap: Record<string, string> = {
    'sin-preferencia': '',
    'restaurante': 'elegant restaurant atmosphere',
    'cocina-casera': 'cozy home atmosphere',
    'terraza': 'outdoor terrace atmosphere with natural light',
    'buffet': 'professional buffet setting',
    'estudio': 'professional photo studio setting'
  };

  const momentoDelDiaMap: Record<string, string> = {
    'sin-preferencia': '',
    'desayuno': 'bright morning atmosphere',
    'brunch': 'warm mid-morning light',
    'almuerzo': 'midday natural light',
    'cena': 'intimate and warm night atmosphere'
  };

  const profundidadCampoMap: Record<string, string> = {
    'moderado': 'moderate depth of field',
    'bokeh-fuerte': 'pronounced bokeh with very blurred background',
    'todo-foco': 'everything in sharp focus'
  };

  const direccionLuzMap: Record<string, string> = {
    'natural': 'natural light from a window',
    'frontal': 'direct frontal light',
    'lateral': 'side light highlighting textures',
    'backlight': 'backlighting creating silhouettes and highlighting steam',
    'cenital': 'overhead top light'
  };

  const propsMap: Record<string, string> = {
    'ninguno': '',
    'cubiertos': 'elegant cutlery on the side',
    'servilleta': 'folded cloth napkin',
    'copa': 'wine glass on the side',
    'ingredientes': 'decorative raw ingredients in the background',
    'hierbas': 'fresh herb sprigs as decoration'
  };

  const saturacionMap: Record<string, string> = {
    'normal': 'natural and balanced colors',
    'bajo': 'soft and desaturated colors',
    'vibrante': 'vivid and saturated colors that stand out'
  };

  const texturaFondoMap: Record<string, string> = {
    'lisa': 'smooth and uniform texture',
    'rustica': 'rustic texture with natural grain',
    'desgastada': 'distressed vintage texture',
    'pulida': 'polished and shiny texture'
  };

  const efectoVaporMap: Record<string, string> = {
    'sin-vapor': '',
    'sutil': 'soft and delicate steam',
    'intenso': 'abundant visible steam'
  };

  const efectoFrescuraMap: Record<string, string> = {
    'sin-efecto': '',
    'gotas': 'fresh water droplets on the ingredients',
    'escarcha': 'delicate frost effect'
  };

  const decoracionesMap: Record<string, string> = {
    'microgreens': 'fresh microgreens',
    'salsas-decorativas': 'decorative artistic sauces',
    'flores-comestibles': 'edible flowers',
    'especias': 'artistically scattered spices',
    'drizzle': 'olive oil drizzle',
    'citricos': 'citrus zest'
  };

  const intensidadText = intensidadGourmet <= 3
    ? 'subtle improvement; keep the natural, home look'
    : intensidadGourmet <= 7
    ? 'moderate transformation toward a gourmet presentation'
    : 'strong transformation toward professional haute-cuisine presentation';

  const decoracionesText = (decoracionesExtra || []).map(d => (d && decoracionesMap[d]) || d).filter(Boolean).join(', ');
  const propsText = (props || []).filter(p => p !== 'ninguno').map(p => (p && propsMap[p]) || p).filter(Boolean).join(', ');
  const efectosText = [
    efectoVapor ? efectoVaporMap[efectoVapor] : '',
    efectoFrescura ? efectoFrescuraMap[efectoFrescura] : ''
  ].filter(Boolean).join(', ');

  const vajillaText = `${(tipoVajilla ? tipoVajillaMap[tipoVajilla] : '') || 'elegant plate'}, ${(colorVajilla ? colorVajillaMap[colorVajilla] : '') || 'neutral'} color`;
  const fondoCompleto = `${(fondo ? fondoMap[fondo] : '') || 'elegant neutral background'}${texturaFondo && texturaFondoMap[texturaFondo] ? `, ${texturaFondoMap[texturaFondo]}` : ''}`;
  const iluminacionCompleta = `${(iluminacion ? iluminacionMap[iluminacion] : '') || 'professional lighting'}${direccionLuz && direccionLuzMap[direccionLuz] ? `, ${direccionLuzMap[direccionLuz]}` : ''}`;
  const ambienteText = (ambiente ? ambienteMap[ambiente] : '') || '';
  const momentoText = (momentoDelDia ? momentoDelDiaMap[momentoDelDia] : '') || '';
  const saturacionText = saturacion ? (saturacionMap[saturacion] || '') : '';

  const spec = (plateLine: string) => section('SPECIFICATIONS:', [
    `- Style: ${(estiloPlato ? estiloMap[estiloPlato] : '') || 'elegant'}`,
    `- Tableware: ${plateLine}`,
    `- Surface/background: ${fondoCompleto}`,
    `- Lighting: ${iluminacionCompleta}`,
    `- Camera angle: ${(anguloCamara ? anguloMap[anguloCamara] : '') || 'professional food-photography angle'}`,
    `- Depth of field: ${(profundidadCampo ? profundidadCampoMap[profundidadCampo] : '') || 'moderate depth of field'}`,
    ambienteText && `- Atmosphere: ${ambienteText}`,
    momentoText && `- Time of day: ${momentoText}`,
    saturacionText && `- Colors: ${saturacionText}`,
    propsText && `- Props: ${propsText}`,
    decoracionesText && `- Garnish/decoration: ${decoracionesText}`,
    efectosText && `- Effects: ${efectosText}`,
  ]);

  if (isFromScratch) {
    const culinary = section('DISH DETAILS (use them to make the dish authentic):', [
      cuisineType?.length ? `- Cuisine: ${list(cuisineType)}` : '',
      dishCategory?.length ? `- Category: ${list(dishCategory)}` : '',
      cookingTechnique?.length ? `- Technique: ${list(cookingTechnique)}` : '',
      culinaryTags?.length ? `- Features: ${list(culinaryTags)}` : '',
    ]);
    return [
      `TASK: Photorealistic professional food photograph of this dish: "${input}".`,
      culinary,
      spec(parameters.plateImage ? 'the plate shown in the PLATE reference image' : vajillaText),
      section('REALISM:', REALISM),
      section('EXCLUDE:', EXCLUDE),
    ].filter(Boolean).join('\n\n');
  }

  const refs = section('REFERENCES (use them only for what is stated; never copy food from them):', [
    parameters.plateImage && '- PLATE reference: use exactly this plate (shape, material, color) for the final presentation.',
    parameters.tableImage && '- TABLE reference: use its surface material, color and texture as the table.',
    parameters.restaurantImage && '- RESTAURANT reference: take its atmosphere, light and decor as inspiration for the environment.',
    parameters.cutleryImage && '- CUTLERY reference: use the same style and design for any cutlery shown.',
  ]);

  return [
    'TASK: Professional food-photography re-styling of the provided dish photo (the ORIGINAL DISH image). Photorealistic result.',
    section('CHANGE (only this):', [
      '- Photographic execution: lighting, sharpness, white balance, depth of field and camera angle, as specified below.',
      '- Presentation: plate, surface, props and the garnish listed below — nothing else.',
      `- Degree of change: ${intensidadText}.`,
    ]),
    section('PRESERVE (must stay the same as the original photo):', [
      `- The food itself: the same dish and ingredients${input ? ` (${input})` : ''}, the same components, portions and arrangement, the same colors and natural textures.`,
      '- Do not add, remove, replace or invent any food or ingredient.',
    ]),
    refs,
    spec(parameters.plateImage ? 'the plate shown in the PLATE reference image' : vajillaText),
    section('REALISM:', REALISM),
    section('EXCLUDE:', EXCLUDE),
  ].filter(Boolean).join('\n\n');
};

/** Prompt (mensaje del usuario) de la receta. El modelo de texto NO ve la foto: trabaja con la descripción y los parámetros. */
export const buildRecipePrompt = (input: string, parameters: DishParameters, ingredientsString: string = ''): string => {
  const { estiloPlato, ambiente, momentoDelDia, intensidadGourmet } = parameters;
  const ingredients = ingredientsString || list(parameters.ingredients);

  const ambienteMap: Record<string, string> = {
    'restaurante': 'restaurante elegante',
    'cocina-casera': 'cocina casera acogedora',
    'terraza': 'terraza exterior',
    'buffet': 'buffet profesional',
    'estudio': 'estudio fotográfico'
  };
  const momentoMap: Record<string, string> = {
    'desayuno': 'desayuno',
    'brunch': 'brunch',
    'almuerzo': 'almuerzo',
    'cena': 'cena'
  };
  const estiloMap: Record<string, string> = {
    'rustico': 'rústico y casero',
    'minimalista': 'minimalista y limpio',
    'clasico-elegante': 'clásico y elegante',
    'moderno': 'moderno y vanguardista'
  };
  const nivel = intensidadGourmet <= 3
    ? 'casera y natural'
    : intensidadGourmet <= 7
    ? 'gourmet moderada'
    : 'de alta cocina profesional';

  const contexto = [
    `- Plato: "${input}"`,
    list(parameters.cuisineType) && `- Tipo de cocina: ${list(parameters.cuisineType)}`,
    list(parameters.dishCategory) && `- Categoría: ${list(parameters.dishCategory)}`,
    list(parameters.cookingTechnique) && `- Técnica principal: ${list(parameters.cookingTechnique)}`,
    list(parameters.culinaryTags) && `- Características: ${list(parameters.culinaryTags)}`,
    ingredients && `- Ingredientes base: ${ingredients}`,
    estiloPlato && estiloMap[estiloPlato] && `- Estilo de presentación: ${estiloMap[estiloPlato]}`,
    `- Nivel de presentación: ${nivel}`,
    ambiente && ambienteMap[ambiente] && `- Ambiente: ${ambienteMap[ambiente]}`,
    momentoDelDia && momentoMap[momentoDelDia] && `- Momento del día: ${momentoMap[momentoDelDia]}`,
  ].filter(Boolean).join('\n');

  return `Escribe una receta completa y fácil de seguir para este plato.

CONTEXTO:
${contexto}

CÓMO USAR EL CONTEXTO:
- Los ingredientes base pueden venir de una detección automática y estar incompletos o equivocados: úsalos como punto de partida, completa lo necesario para que el plato funcione y marca con "(opcional)" lo que no sea seguro.
- Respeta la cocina, la categoría y la técnica indicadas; si hay varias, intégralas con coherencia.
- Cantidades en unidades métricas (g, ml, cucharadas, tazas) y precisas; para cocineros caseros.

FORMATO (Markdown, exactamente estas secciones y en este orden):
### Nombre creativo y apetitoso del plato
**Porciones:** n · **Tiempo total:** x min · **Dificultad:** fácil | media | difícil

**Descripción:** 2 frases que evoquen el plato.

**Ingredientes:**
- cantidad + ingrediente (una línea cada uno)

**Preparación:**
1. un paso por número, una acción clara, con tiempos y señales de punto (color, textura, aroma)

**Consejo del chef:** una frase práctica.

No agregues introducciones, notas ni comentarios sobre estas instrucciones ni sobre fotos o imágenes.`;
};
