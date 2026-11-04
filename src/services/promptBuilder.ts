import { DishParameters } from '../types';

// Prompts de imagen y de receta (tal como estaban en el servicio anterior). Las fotos de referencia viajan aparte:
// el servidor las rotula por rol; aquí solo va el texto.

/** Construye el prompt dinámico de imagen según los parámetros */
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
    aspectRatio,
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

  const aspectRatioMap: Record<string, string> = {
    'original': '',
    '1:1': 'square format',
    '4:3': '4:3 format',
    '16:9': '16:9 panoramic format',
    '4:5': '4:5 vertical format'
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
    ? 'subtle improvement maintaining natural look' 
    : intensidadGourmet <= 7 
    ? 'moderate transformation with gourmet presentation' 
    : 'complete transformation with professional haute cuisine presentation';

  let decoracionesText = '';
  if (decoracionesExtra && decoracionesExtra.length > 0) {
    decoracionesText = decoracionesExtra.map(d => (d && decoracionesMap[d]) || d).join(', ');
  }

  const vajillaText = `${(tipoVajilla ? tipoVajillaMap[tipoVajilla] : '') || 'elegant plate'} color ${(colorVajilla ? colorVajillaMap[colorVajilla] : '') || 'neutral'}`;
  const fondoCompleto = `${(fondo ? fondoMap[fondo] : '') || 'elegant background'}${texturaFondo && texturaFondoMap[texturaFondo] ? ` with ${texturaFondoMap[texturaFondo]}` : ''}`;
  const iluminacionCompleta = `${(iluminacion ? iluminacionMap[iluminacion] : '') || 'professional lighting'}${direccionLuz && direccionLuzMap[direccionLuz] ? `, ${direccionLuzMap[direccionLuz]}` : ''}`;
  const ambienteText = (ambiente ? ambienteMap[ambiente] : '') || '';
  const momentoText = (momentoDelDia ? momentoDelDiaMap[momentoDelDia] : '') || '';
  
  let propsText = '';
  if (props && Array.isArray(props) && props.length > 0) {
    propsText = props.filter(p => p !== 'ninguno').map(p => (p && propsMap[p]) || p).filter(Boolean).join(', ');
  }
  
  const saturacionText = saturacion ? (saturacionMap[saturacion] || '') : '';
  const efectosText = [
    efectoVapor ? efectoVaporMap[efectoVapor] : '', 
    efectoFrescura ? efectoFrescuraMap[efectoFrescura] : ''
  ].filter(Boolean).join(', ');

  let prompt = '';
  if (isFromScratch) {
    prompt = `Generate a high-resolution professional food photograph based on the following description: "${input}".
    
    ADDITIONAL CULINARY INFORMATION:
    ${Array.isArray(cuisineType) && cuisineType.length ? `- Cuisine type: ${cuisineType.join(', ')}` : ''}
    ${Array.isArray(dishCategory) && dishCategory.length ? `- Category: ${dishCategory.join(', ')}` : ''}
    ${Array.isArray(cookingTechnique) && cookingTechnique.length ? `- Technique: ${cookingTechnique.join(', ')}` : ''}
    ${Array.isArray(culinaryTags) && culinaryTags.length ? `- Features: ${culinaryTags.join(', ')}` : ''}

IMAGE SPECIFICATIONS:
- Style: ${(estiloPlato ? estiloMap[estiloPlato] : '') || 'elegant'}
- Tableware: ${vajillaText}
- Background: ${fondoCompleto}
- Lighting: ${iluminacionCompleta}
- Angle: ${(anguloCamara ? anguloMap[anguloCamara] : '') || 'professional angle'}
- Focus: ${(profundidadCampo ? profundidadCampoMap[profundidadCampo] : '') || 'moderate depth'}${ambienteText ? `\n- Atmosphere: ${ambienteText}` : ''}${momentoText ? `\n- Moment: ${momentoText}` : ''}${saturacionText ? `\n- Colors: ${saturacionText}` : ''}${propsText ? `\n- Props: ${propsText}` : ''}${decoracionesText ? `\n- Decoration: ${decoracionesText}` : ''}${efectosText ? `\n- Effects: ${efectosText}` : ''}${aspectRatio && aspectRatioMap[aspectRatio] ? `\n- Format: ${aspectRatioMap[aspectRatio]}` : ''}

RESULT: A photorealistic image of culinary magazine quality. The food must look delicious, fresh, and perfectly lit.`;
  } else {
    const usePhysicalPlate = parameters.plateImage ? '\n- PHYSICAL PLATE: A photo of the physical plate has been provided. Use EXACTLY this plate for the final presentation.' : '';
    const useTableRef = parameters.tableImage ? '\n- TABLE REFERENCE: A photo of a table has been provided. Use its surface, material, and texture as the background for the dish.' : '';
    const useRestaurantRef = parameters.restaurantImage ? '\n- RESTAURANT REFERENCE: A photo of a restaurant has been provided. Use its atmosphere, lighting style, and background decor as inspiration for the environment.' : '';
    const useCutleryRef = parameters.cutleryImage ? '\n- CUTLERY REFERENCE: A photo of cutlery has been provided. Use similar style and design for any cutlery shown in the final image.' : '';
    
    prompt = `Generate a professional gourmet food photograph based on this food image.

ABSOLUTE INTEGRITY RULE:
- The FOOD and INGREDIENTS must be EXACTLY the same as in the original image: ${input}.
- Do not add, remove, or modify the main components of the food.
- The goal is a professional PHOTOGRAPHIC RE-STYLING, maintaining the ESSENCE and APPEARANCE of the original food as faithfully as possible.
- Maintain the arrangement, portions, and natural textures of the original ingredients.

PHOTOGRAPHIC AND PRESENTATION IMPROVEMENT:
- Transform the lighting to professional studio quality (soft side light, texture enhancement).
- Improve sharpness and technical detail of the capture.
- White balance and colorimetry must be perfect, highlighting natural freshness.
- You can improve the plating and environment (plate, background, side decoration) to look like editorial or Michelin-star level photography.${usePhysicalPlate}${useTableRef}${useRestaurantRef}${useCutleryRef}

IMAGE SPECIFICATIONS:
- Style: ${(estiloPlato ? estiloMap[estiloPlato] : '') || 'elegant'}, ${intensidadText}
- Tableware: ${parameters.plateImage ? 'Use the plate provided in the second image' : vajillaText}
- Background: ${fondoCompleto}
- Lighting: ${iluminacionCompleta}
- Angle: ${(anguloCamara ? anguloMap[anguloCamara] : '') || 'professional angle'}
- Focus: ${(profundidadCampo ? profundidadCampoMap[profundidadCampo] : '') || 'moderate depth'}${ambienteText ? `\n- Atmosphere: ${ambienteText}` : ''}${momentoText ? `\n- Moment: ${momentoText}` : ''}${saturacionText ? `\n- Colors: ${saturacionText}` : ''}${propsText ? `\n- Props: ${propsText}` : ''}${decoracionesText ? `\n- Decoration: ${decoracionesText}` : ''}${efectosText ? `\n- Effects: ${efectosText}` : ''}${aspectRatio && aspectRatioMap[aspectRatio] ? `\n- Format: ${aspectRatioMap[aspectRatio]}` : ''}

RESULT: International magazine level food photography (like Michelin Guide or Bon Appétit), keeping the original food but with perfect technical photographic execution and gourmet presentation.`;
  }

  return prompt;
};

/** Prompt de la receta que coincide con el plato generado */
export const buildRecipePrompt = (input: string, parameters: DishParameters, ingredientsString: string = ''): string => {
        const {
            cuisineType,
            dishCategory,
            cookingTechnique,
            culinaryTags,
            estiloPlato,
            ambiente,
            momentoDelDia,
            intensidadGourmet
        } = parameters;

        const getParamValue = (param: string | string[] | undefined): string => {
          if (!param) return '';
          return Array.isArray(param) ? param.join(', ') : param;
        };

        const cuisine = getParamValue(cuisineType);
        const category = getParamValue(dishCategory);
        const technique = getParamValue(cookingTechnique);
        const tags = getParamValue(culinaryTags);
        
        const finalIngredients = ingredientsString || getParamValue(parameters.ingredients) || '';
        
        const ambienteMap: Record<string, string> = {
          'sin-preferencia': '',
          'restaurante': 'restaurante elegante',
          'cocina-casera': 'cocina casera acogedora',
          'terraza': 'terraza exterior',
          'buffet': 'buffet profesional',
          'estudio': 'estudio fotográfico'
        };

        const momentoDelDiaMap: Record<string, string> = {
          'sin-preferencia': '',
          'desayuno': 'desayuno matutino',
          'brunch': 'brunch de media mañana',
          'almuerzo': 'almuerzo de mediodía',
          'cena': 'cena romántica nocturna'
        };

        const estiloMap: Record<string, string> = {
          'rustico': 'rústico y casero',
          'minimalista': 'minimalista y limpio',
          'clasico-elegante': 'clásico y elegante',
          'moderno': 'moderno y vanguardista'
        };
        
        const estilo = estiloPlato ? estiloMap[estiloPlato] || estiloPlato : '';
        const ambienteText = ambiente && ambiente !== 'sin-preferencia' ? ambienteMap[ambiente] || ambiente : '';
        const momentoText = momentoDelDia && momentoDelDia !== 'sin-preferencia' ? momentoDelDiaMap[momentoDelDia] || momentoDelDia : '';
        
        const nivelGourmet = intensidadGourmet <= 3 
          ? 'presentación casera y natural' 
          : intensidadGourmet <= 7 
          ? 'presentación gourmet moderada' 
          : 'presentación de alta cocina profesional';

        const prompt = `Eres un chef profesional experto. Tu tarea es crear una receta detallada pero fácil de seguir que coincida EXACTAMENTE con el plato que se muestra en la fotografía generada.

**INFORMACIÓN DEL PLATO GENERADO:**

**Descripción / Idea Principal:**
"${input}"

**CONTEXTO CULINARIO (Estos parámetros definen el plato):**
${cuisine ? `- Tipo de Cocina: ${cuisine}` : ''}
${category ? `- Categoría del Plato: ${category}` : ''}
${technique ? `- Técnica de Cocción Principal: ${technique}` : ''}
${tags ? `- Características / Etiquetas Culinarias: ${tags}` : ''}
${finalIngredients ? `- Ingredientes Clave: ${finalIngredients}` : ''}

**CONTEXTO VISUAL Y PRESENTACIÓN (Estos parámetros afectan cómo se ve el plato):**
${estilo ? `- Estilo de Presentación: ${estilo}` : ''}
${ambienteText ? `- Ambiente: ${ambienteText}` : ''}
${momentoText ? `- Momento del Día: ${momentoText}` : ''}
${intensidadGourmet ? `- Nivel de Presentación: ${nivelGourmet}` : ''}

**INSTRUCCIONES CRÍTICAS:**

1. La receta DEBE coincidir exactamente con lo que se ve en la fotografía generada
2. Usa los ingredientes especificados y las técnicas de cocción mencionadas
3. El estilo de presentación debe reflejar el contexto visual (${estilo || 'elegante'})
4. La receta debe ser apropiada para el momento del día (${momentoText || 'cualquier momento'})
5. Si hay múltiples tipos de cocina o categorías, integra sus características de manera coherente
6. La receta debe ser práctica, clara y deliciosa

**FORMATO REQUERIDO (Markdown):**

### [Nombre Creativo y Apetitoso del Plato que Refleje los Parámetros]

**Descripción:**
Una breve descripción (2-3 frases) que evoque el estilo culinario, los ingredientes principales y el contexto del plato. Debe sonar apetitoso y profesional.

**Ingredientes:**
- [Lista completa de ingredientes con cantidades específicas]
- [Incluir todos los ingredientes mencionados y los necesarios para la técnica de cocción]
- [Cantidades deben ser precisas y prácticas]

**Instrucciones Paso a Paso:**
1. [Paso detallado que refleje la técnica de cocción especificada]
2. [Continuar con pasos claros y secuenciales]
3. [Incluir detalles sobre presentación si es relevante]
...

**Consejo del Chef:**
Un tip práctico y breve relacionado con la técnica de cocción, los ingredientes o la presentación del plato.

**Notas:**
- Asegúrate de que la receta sea coherente con el tipo de cocina y categoría especificados
- La presentación debe reflejar el estilo visual elegido
- Los ingredientes deben coincidir con los especificados

Mantén un tono profesional, inspirador pero accesible. La receta debe ser clara y fácil de seguir para cualquier cocinero casero.`;
  return prompt;
};
