// Constantes para los parámetros de generación

export interface Option {
  value: string;
  label: string;
}

export const ESTILOS_PLATO: Option[] = [
  { value: 'rustico', label: 'Rústico' },
  { value: 'minimalista', label: 'Minimalista' },
  { value: 'clasico-elegante', label: 'Clásico Elegante' },
  { value: 'moderno', label: 'Moderno' }
];

export const ILUMINACIONES: Option[] = [
  { value: 'natural', label: 'Natural' },
  { value: 'calida', label: 'Cálida' },
  { value: 'estudio', label: 'Estudio' },
  { value: 'dramatica', label: 'Dramática' },
  { value: 'suave', label: 'Suave/Difusa' }
];

export const FONDOS: Option[] = [
  { value: 'madera', label: 'Madera' },
  { value: 'marmol', label: 'Mármol' },
  { value: 'negro', label: 'Negro' },
  { value: 'blanco', label: 'Blanco' },
  { value: 'granito', label: 'Granito' },
  { value: 'concreto', label: 'Concreto' },
  { value: 'tela', label: 'Tela/Lino' },
  { value: 'original', label: 'Elegante (auto)' }
];

export const DECORACIONES_EXTRA: Option[] = [
  { value: 'microgreens', label: 'Microgreens' },
  { value: 'salsas-decorativas', label: 'Salsas Decorativas' },
  { value: 'flores-comestibles', label: 'Flores Comestibles' },
  { value: 'especias', label: 'Especias Esparcidas' },
  { value: 'drizzle', label: 'Drizzle de Aceite' },
  { value: 'citricos', label: 'Ralladura de Cítricos' }
];

export const ANGULOS_CAMARA: Option[] = [
  { value: 'cenital', label: 'Cenital (90°)' },
  { value: '75', label: '75° (Casi cenital)' },
  { value: '45', label: '45° (Clásico)' },
  { value: '30', label: '30° (Bajo)' },
  { value: 'lateral', label: 'Lateral (0°)' },
  { value: 'hero', label: 'Hero Shot (Frontal destacado)' },
  { value: 'diagonal', label: 'Diagonal (Esquina)' },
  { value: 'picado', label: 'Picado (Desde arriba inclinado)' }
];

export const INTENSIDAD_GOURMET_MIN = 1;
export const INTENSIDAD_GOURMET_MAX = 10;
export const INTENSIDAD_GOURMET_DEFAULT = 5;

export const TIPOS_VAJILLA: Option[] = [
  { value: 'original', label: 'Elegante (auto)' },
  { value: 'redondo', label: 'Plato Redondo' },
  { value: 'cuadrado', label: 'Plato Cuadrado' },
  { value: 'rectangular', label: 'Plato Rectangular' },
  { value: 'bowl', label: 'Bowl' },
  { value: 'pizarra', label: 'Pizarra' },
  { value: 'tabla-madera', label: 'Tabla de Madera' }
];

export const COLORES_VAJILLA: Option[] = [
  { value: 'original', label: 'Neutro (auto)' },
  { value: 'blanco', label: 'Blanco Clásico' },
  { value: 'negro', label: 'Negro Mate' },
  { value: 'terracota', label: 'Terracota' },
  { value: 'crema', label: 'Crema' }
];

export const AMBIENTES: Option[] = [
  { value: 'sin-preferencia', label: 'Sin Preferencia' },
  { value: 'restaurante', label: 'Restaurante Elegante' },
  { value: 'cocina-casera', label: 'Cocina Casera' },
  { value: 'terraza', label: 'Terraza Exterior' },
  { value: 'buffet', label: 'Buffet' },
  { value: 'estudio', label: 'Estudio Fotográfico' }
];

export const MOMENTOS_DIA: Option[] = [
  { value: 'sin-preferencia', label: 'Sin Preferencia' },
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'almuerzo', label: 'Almuerzo' },
  { value: 'cena', label: 'Cena Romántica' }
];

export const PROFUNDIDADES_CAMPO: Option[] = [
  { value: 'moderado', label: 'Moderado' },
  { value: 'bokeh-fuerte', label: 'Bokeh Fuerte (Fondo Difuso)' },
  { value: 'todo-foco', label: 'Todo en Foco' }
];

export const ASPECT_RATIOS: Option[] = [
  { value: '1:1', label: '1:1 (Cuadrado)' },
  { value: '3:4', label: '3:4 (Retrato)' },
  { value: '4:3', label: '4:3 (Estándar)' },
  { value: '9:16', label: '9:16 (Vertical)' },
  { value: '16:9', label: '16:9 (Panorámico)' }
];

export const IMAGE_SIZES: Option[] = [
  { value: '1K', label: '1K (Estándar)' },
  { value: '2K', label: '2K (Alta resolución, el doble de créditos)' }
];

export const NUMBER_OF_IMAGES = [
  { value: 1, label: '1 Imagen' },
  { value: 2, label: '2 Imágenes' },
  { value: 3, label: '3 Imágenes' },
  { value: 4, label: '4 Imágenes' }
];

export const DIRECCIONES_LUZ: Option[] = [
  { value: 'natural', label: 'Natural (ventana)' },
  { value: 'frontal', label: 'Frontal' },
  { value: 'lateral', label: 'Lateral (resalta texturas)' },
  { value: 'backlight', label: 'Retroiluminación' },
  { value: 'cenital', label: 'Cenital (desde arriba)' }
];

export const EFECTOS_VAPOR: Option[] = [
  { value: 'sin-vapor', label: 'Sin Vapor' },
  { value: 'sutil', label: 'Vapor Sutil' },
  { value: 'intenso', label: 'Vapor Intenso' }
];

export const EFECTOS_FRESCURA: Option[] = [
  { value: 'sin-efecto', label: 'Sin Efecto' },
  { value: 'gotas', label: 'Gotas de Agua' },
  { value: 'escarcha', label: 'Escarcha (Postres Fríos)' }
];

export const SATURACIONES: Option[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'bajo', label: 'Desaturado (suave)' },
  { value: 'vibrante', label: 'Vibrante (vivo)' }
];

export const PROPS: Option[] = [
  { value: 'ninguno', label: 'Sin props' },
  { value: 'cubiertos', label: 'Cubiertos elegantes' },
  { value: 'servilleta', label: 'Servilleta de tela' },
  { value: 'copa', label: 'Copa de vino' },
  { value: 'ingredientes', label: 'Ingredientes crudos de fondo' },
  { value: 'hierbas', label: 'Hierbas frescas' }
];

export const TEXTURAS_FONDO: Option[] = [
  { value: 'lisa', label: 'Lisa' },
  { value: 'rustica', label: 'Rústica' },
  { value: 'desgastada', label: 'Vintage/Desgastada' },
  { value: 'pulida', label: 'Pulida/Brillante' }
];

export const TIPOS_COCINA: Option[] = [
  { value: 'sin-preferencia', label: 'Sin Preferencia' },
  { value: 'italiana', label: 'Italiana' },
  { value: 'francesa', label: 'Francesa' },
  { value: 'mexicana', label: 'Mexicana' },
  { value: 'japonesa', label: 'Japonesa' },
  { value: 'china', label: 'China' },
  { value: 'española', label: 'Española' },
  { value: 'peruana', label: 'Peruana' },
  { value: 'india', label: 'India' },
  { value: 'mediterranea', label: 'Mediterránea' },
  { value: 'fusion', label: 'Fusión' },
  { value: 'americana', label: 'Americana' },
  { value: 'arabe', label: 'Árabe' },
  { value: 'tailandesa', label: 'Tailandesa' }
];

export const CATEGORIAS_PLATO: Option[] = [
  { value: 'sin-preferencia', label: 'Sin Preferencia' },
  { value: 'entrada', label: 'Entrada / Aperitivo' },
  { value: 'plato-fuerte', label: 'Plato Fuerte' },
  { value: 'postre', label: 'Postre' },
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'bebida', label: 'Bebida / Coctel' },
  { value: 'ensalada', label: 'Ensalada' },
  { value: 'sopa', label: 'Sopa / Crema' },
  { value: 'sandwich', label: 'Sándwich / Burger' },
  { value: 'pasta', label: 'Pasta' },
  { value: 'pizza', label: 'Pizza' }
];

export const TECNICAS_COCCION: Option[] = [
  { value: 'sin-preferencia', label: 'Sin Preferencia' },
  { value: 'parrilla', label: 'A la Parrilla / Grill' },
  { value: 'horno', label: 'Al Horno' },
  { value: 'sarten', label: 'Salteado / Sartén' },
  { value: 'frito', label: 'Frito' },
  { value: 'crudo', label: 'Crudo / Fresco' },
  { value: 'vapor', label: 'Al Vapor' },
  { value: 'sous-vide', label: 'Sous-vide' },
  { value: 'ahumado', label: 'Ahumado' },
  { value: 'estofado', label: 'Estofado' }
];

export const TAGS_CULINARIOS: Option[] = [
  { value: 'picante', label: 'Picante' },
  { value: 'vegano', label: 'Vegano' },
  { value: 'vegetariano', label: 'Vegetariano' },
  { value: 'sin-gluten', label: 'Sin Gluten' },
  { value: 'gourmet', label: 'Gourmet' },
  { value: 'callejero', label: 'Street Food' },
  { value: 'saludable', label: 'Saludable' },
  { value: 'dulce', label: 'Dulce' },
  { value: 'salado', label: 'Salado' },
  { value: 'agridulce', label: 'Agridulce' },
  { value: 'crujiente', label: 'Crujiente' },
  { value: 'cremoso', label: 'Cremoso' }
];
