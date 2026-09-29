export type MediaType = 'image' | 'video';

export type ParameterValue = string | number | boolean;

export interface ParameterOption {
  label: string;
  value: string | number;
}

interface BaseParameter {
  key: string;
  label: string;
  description?: string;
  required?: boolean;
}

export interface SelectParameter extends BaseParameter {
  type: 'select';
  options: ParameterOption[];
  defaultValue: string | number;
}

export interface NumberParameter extends BaseParameter {
  type: 'number';
  min: number;
  max: number;
  step?: number;
  defaultValue: number;
  optionalRandom?: boolean;
}

export interface BooleanParameter extends BaseParameter {
  type: 'boolean';
  defaultValue: boolean;
}

export interface UrlParameter extends BaseParameter {
  type: 'url';
  placeholder: string;
  defaultValue: string;
}

export type ModelParameter =
  | SelectParameter
  | NumberParameter
  | BooleanParameter
  | UrlParameter;

export interface CostEstimation {
  standardLabel: string;
  economyLabel: string;
  note: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  type: MediaType;
  badge: string;
  description: string;
  parameters: ModelParameter[];
  economyPreset: Record<string, ParameterValue>;
  estimatedCost: CostEstimation;
  /**
   * Transforma los parámetros planos del formulario al payload exacto
   * que espera el endpoint de Higgsfield si requiere objetos anidados.
   */
  transformPayload?: (
    prompt: string,
    rawParams: Record<string, ParameterValue>
  ) => Record<string, unknown>;
}

/**
 * Registro central de modelos confirmados en el SDK @higgsfield/client v2 y docs.higgsfield.ai.
 * Para añadir un modelo nuevo, basta con agregar un objeto a este arreglo:
 * el formulario del frontend y la validación del backend se adaptan automáticamente.
 */
export const MODELS: readonly ModelConfig[] = [
  // ============================================================================
  // MODELOS DE IMAGEN
  // ============================================================================
  {
    id: 'flux-pro/kontext/max/text-to-image',
    name: 'Flux Pro Kontext Max',
    provider: 'Black Forest Labs · Higgsfield V2',
    type: 'image',
    badge: 'Texto a Imagen',
    description:
      'Generación de imágenes fotorrealistas y artísticas con alta adherencia al prompt y control de relación de aspecto.',
    parameters: [
      {
        key: 'aspect_ratio',
        label: 'Relación de aspecto',
        type: 'select',
        defaultValue: '16:9',
        options: [
          { label: '16:9 (Horizontal panorámico)', value: '16:9' },
          { label: '9:16 (Vertical / Reels)', value: '9:16' },
          { label: '1:1 (Cuadrado)', value: '1:1' },
          { label: '4:3 (Estándar)', value: '4:3' },
          { label: '3:4 (Retrato)', value: '3:4' },
        ],
      },
      {
        key: 'safety_tolerance',
        label: 'Tolerancia del filtro de seguridad (1-6)',
        description: '1 es el nivel más estricto; 6 es el más permisivo.',
        type: 'number',
        min: 1,
        max: 6,
        step: 1,
        defaultValue: 2,
      },
      {
        key: 'seed',
        label: 'Semilla (Seed)',
        description: 'Usa 0 para semilla aleatoria o un número fijo para resultados reproducibles.',
        type: 'number',
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        optionalRandom: true,
      },
    ],
    economyPreset: {
      aspect_ratio: '1:1',
      safety_tolerance: 2,
    },
    estimatedCost: {
      standardLabel: '~$0.05 – $0.08 USD / img',
      economyLabel: '~$0.05 USD / img',
      note: 'Tarifa referencial pay-as-you-go (la API no expone cotización dinámica previa al envío).',
    },
    transformPayload: (prompt, rawParams) => {
      const payload: Record<string, unknown> = {
        prompt,
        aspect_ratio: String(rawParams.aspect_ratio ?? '16:9'),
        safety_tolerance: Number(rawParams.safety_tolerance ?? 2),
      };
      const seedVal = Number(rawParams.seed ?? 0);
      if (seedVal > 0) {
        payload.seed = seedVal;
      }
      return payload;
    },
  },
  {
    id: '/v1/text2image/soul',
    name: 'Higgsfield Soul (HD / Estilizado)',
    provider: 'Higgsfield AI',
    type: 'image',
    badge: 'Texto a Imagen',
    description:
      'Modelo propietario de Higgsfield (Soul) con soporte para múltiples resoluciones nativas, mejora de prompt y generación por lotes.',
    parameters: [
      {
        key: 'width_and_height',
        label: 'Dimensiones (Ancho x Alto)',
        type: 'select',
        defaultValue: '1536x1536',
        options: [
          { label: '1536x1536 (Cuadrado estándar)', value: '1536x1536' },
          { label: '2048x1152 (Horizontal amplio 16:9)', value: '2048x1152' },
          { label: '1696x960 (Horizontal compacto)', value: '1696x960' },
          { label: '1632x1088 (Horizontal económico)', value: '1632x1088' },
          { label: '1152x2048 (Vertical alto 9:16)', value: '1152x2048' },
          { label: '1536x2048 (Retrato estándar)', value: '1536x2048' },
          { label: '1088x1632 (Retrato económico)', value: '1088x1632' },
        ],
      },
      {
        key: 'quality',
        label: 'Calidad de renderizado',
        type: 'select',
        defaultValue: '1080p',
        options: [
          { label: '1080p (Alta definición - HD)', value: '1080p' },
          { label: '720p (Definición estándar - Económico)', value: '720p' },
        ],
      },
      {
        key: 'batch_size',
        label: 'Cantidad de imágenes (Batch)',
        type: 'select',
        defaultValue: 1,
        options: [
          { label: '1 imagen (Individual)', value: 1 },
          { label: '4 imágenes (Cuádruple)', value: 4 },
        ],
      },
      {
        key: 'enhance_prompt',
        label: 'Mejorar prompt con IA (Enhance Prompt)',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'seed',
        label: 'Semilla (Seed)',
        description: 'Usa 0 para semilla aleatoria.',
        type: 'number',
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        optionalRandom: true,
      },
    ],
    economyPreset: {
      width_and_height: '1632x1088',
      quality: '720p',
      batch_size: 1,
      enhance_prompt: true,
    },
    estimatedCost: {
      standardLabel: '~$0.04 – $0.16 USD / lote',
      economyLabel: '~$0.03 USD (720p · 1 img)',
      note: 'El modo económico fija 720p y lote de 1 imagen para minimizar consumo de saldo.',
    },
    transformPayload: (prompt, rawParams) => {
      const payload: Record<string, unknown> = {
        prompt,
        width_and_height: String(rawParams.width_and_height ?? '1536x1536'),
        quality: String(rawParams.quality ?? '1080p'),
        batch_size: Number(rawParams.batch_size ?? 1),
        enhance_prompt: Boolean(rawParams.enhance_prompt ?? true),
      };
      const seedVal = Number(rawParams.seed ?? 0);
      if (seedVal > 0) {
        payload.seed = seedVal;
      }
      return payload;
    },
  },

  // ============================================================================
  // MODELOS DE VIDEO
  // ============================================================================
  {
    id: 'bytedance/seedance-2.5/text-to-video',
    name: 'ByteDance Seedance 2.5',
    provider: 'ByteDance · Higgsfield V2',
    type: 'video',
    badge: 'Texto a Video + Audio',
    description:
      'Generación cinematográfica de video a partir de texto con soporte nativo para síntesis de audio sincronizado.',
    parameters: [
      {
        key: 'duration',
        label: 'Duración (segundos)',
        type: 'select',
        defaultValue: 5,
        options: [
          { label: '5 segundos (Rápido / Económico)', value: 5 },
          { label: '10 segundos (Extendido)', value: 10 },
        ],
      },
      {
        key: 'resolution',
        label: 'Resolución',
        type: 'select',
        defaultValue: '720p',
        options: [
          { label: '720p (HD Estándar / Económico)', value: '720p' },
          { label: '1080p (Full HD)', value: '1080p' },
        ],
      },
      {
        key: 'aspect_ratio',
        label: 'Relación de aspecto',
        type: 'select',
        defaultValue: '16:9',
        options: [
          { label: '16:9 (Horizontal)', value: '16:9' },
          { label: '9:16 (Vertical / Móvil)', value: '9:16' },
          { label: '1:1 (Cuadrado)', value: '1:1' },
        ],
      },
      {
        key: 'output_format',
        label: 'Formato de salida',
        type: 'select',
        defaultValue: 'mp4',
        options: [{ label: 'MP4 (H.264)', value: 'mp4' }],
      },
      {
        key: 'generate_audio',
        label: 'Generar audio sincronizado',
        description: 'Sintetiza efectos de sonido y ambiente acordes a la escena.',
        type: 'boolean',
        defaultValue: true,
      },
    ],
    economyPreset: {
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
      output_format: 'mp4',
      generate_audio: false,
    },
    estimatedCost: {
      standardLabel: '~$0.25 – $0.60 USD / video',
      economyLabel: '~$0.20 USD (5s · 720p · sin audio)',
      note: 'El modo económico reduce la duración a 5s y resolución a 720p para probar prompts.',
    },
  },
  {
    id: 'kling-video/v2.6/pro/text-to-video',
    name: 'Kling 2.6 Pro (Text-to-Video)',
    provider: 'Kuaishou Kling · Higgsfield V2',
    type: 'video',
    badge: 'Texto a Video',
    description:
      'Modelo profesional de Kling 2.6 para secuencias de alto realismo físico, iluminación dinámica y opción de sonido.',
    parameters: [
      {
        key: 'duration',
        label: 'Duración (segundos)',
        type: 'select',
        defaultValue: 5,
        options: [
          { label: '5 segundos (Estándar / Económico)', value: 5 },
          { label: '10 segundos (Largo)', value: 10 },
        ],
      },
      {
        key: 'aspect_ratio',
        label: 'Relación de aspecto',
        type: 'select',
        defaultValue: '16:9',
        options: [
          { label: '16:9 (Horizontal)', value: '16:9' },
          { label: '9:16 (Vertical)', value: '9:16' },
          { label: '1:1 (Cuadrado)', value: '1:1' },
        ],
      },
      {
        key: 'sound',
        label: 'Incluir efecto de sonido (Sound)',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    economyPreset: {
      duration: 5,
      aspect_ratio: '16:9',
      sound: false,
    },
    estimatedCost: {
      standardLabel: '~$0.35 – $0.70 USD / video',
      economyLabel: '~$0.35 USD (5s · sin sonido)',
      note: 'Tarifa referencial según duración seleccionada en la consola de Higgsfield.',
    },
  },
  {
    id: 'alibaba/wan-3.0/text-to-video',
    name: 'Alibaba Wan 3.0 (Text-to-Video)',
    provider: 'Alibaba Cloud · Higgsfield V2',
    type: 'video',
    badge: 'Texto a Video',
    description:
      'Generador versátil de texto a video con excelente coherencia temporal y soporte de resoluciones 720p y 1080p.',
    parameters: [
      {
        key: 'duration',
        label: 'Duración (segundos)',
        type: 'select',
        defaultValue: 5,
        options: [
          { label: '5 segundos (Económico)', value: 5 },
          { label: '10 segundos', value: 10 },
          { label: '15 segundos', value: 15 },
        ],
      },
      {
        key: 'resolution',
        label: 'Resolución',
        type: 'select',
        defaultValue: '720p',
        options: [
          { label: '720p (Económico)', value: '720p' },
          { label: '1080p (Full HD)', value: '1080p' },
        ],
      },
      {
        key: 'aspect_ratio',
        label: 'Relación de aspecto',
        type: 'select',
        defaultValue: '16:9',
        options: [
          { label: '16:9 (Horizontal)', value: '16:9' },
          { label: '9:16 (Vertical)', value: '9:16' },
          { label: '1:1 (Cuadrado)', value: '1:1' },
        ],
      },
      {
        key: 'seed',
        label: 'Semilla (Seed)',
        description: 'Usa 0 para semilla aleatoria.',
        type: 'number',
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        optionalRandom: true,
      },
    ],
    economyPreset: {
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
    },
    estimatedCost: {
      standardLabel: '~$0.20 – $0.55 USD / video',
      economyLabel: '~$0.20 USD (5s · 720p)',
      note: 'Ideal para iterar ideas de movimiento antes de renderizar en 1080p.',
    },
    transformPayload: (prompt, rawParams) => {
      const payload: Record<string, unknown> = {
        prompt,
        duration: Number(rawParams.duration ?? 5),
        resolution: String(rawParams.resolution ?? '720p'),
        aspect_ratio: String(rawParams.aspect_ratio ?? '16:9'),
      };
      const seedVal = Number(rawParams.seed ?? 0);
      if (seedVal > 0) {
        payload.seed = seedVal;
      }
      return payload;
    },
  },
  {
    id: '/v1/image2video/dop',
    name: 'Higgsfield DoP (Director of Photography)',
    provider: 'Higgsfield AI',
    type: 'video',
    badge: 'Imagen a Video',
    description:
      'Anima una imagen inicial con control cinematográfico de cámara (DoP Lite, Turbo o Standard).',
    parameters: [
      {
        key: 'image_url',
        label: 'URL de la imagen inicial (HTTPS)',
        description: 'Enlace directo a una imagen pública (JPG, PNG o WebP) que servirá como primer fotograma.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
        defaultValue: '',
        required: true,
      },
      {
        key: 'model',
        label: 'Variante del motor DoP',
        type: 'select',
        defaultValue: 'dop-turbo',
        options: [
          { label: 'DoP Lite (Más rápido y económico)', value: 'dop-lite' },
          { label: 'DoP Turbo (Equilibrio velocidad/calidad)', value: 'dop-turbo' },
          { label: 'DoP Standard (Máxima calidad cinematográfica)', value: 'dop-standard' },
        ],
      },
      {
        key: 'enhance_prompt',
        label: 'Mejorar prompt cinematográfico',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'seed',
        label: 'Semilla (Seed)',
        description: 'Usa 0 para semilla aleatoria.',
        type: 'number',
        min: 0,
        max: 1000000,
        step: 1,
        defaultValue: 0,
        optionalRandom: true,
      },
    ],
    economyPreset: {
      model: 'dop-lite',
      enhance_prompt: true,
    },
    estimatedCost: {
      standardLabel: '~$0.20 – $0.45 USD / video',
      economyLabel: '~$0.15 USD (Variante DoP Lite)',
      note: 'El modo económico selecciona automáticamente el motor DoP Lite.',
    },
    transformPayload: (prompt, rawParams) => {
      const imageUrl = String(rawParams.image_url ?? '').trim();
      const payload: Record<string, unknown> = {
        model: String(rawParams.model ?? 'dop-turbo'),
        prompt,
        input_images: [
          {
            type: 'image_url',
            image_url: imageUrl,
          },
        ],
        enhance_prompt: Boolean(rawParams.enhance_prompt ?? true),
      };
      const seedVal = Number(rawParams.seed ?? 0);
      if (seedVal > 0) {
        payload.seed = seedVal;
      }
      return payload;
    },
  },
  {
    id: 'kling-video/v3.0/std/image-to-video',
    name: 'Kling 3.0 Standard (Image-to-Video)',
    provider: 'Kuaishou Kling · Higgsfield V2',
    type: 'video',
    badge: 'Imagen a Video',
    description:
      'Convierte una imagen estática en un video fluido utilizando la generación estándar de Kling 3.0.',
    parameters: [
      {
        key: 'image_url',
        label: 'URL de la imagen inicial (HTTPS)',
        description: 'URL pública HTTPS del primer fotograma.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
        defaultValue: '',
        required: true,
      },
      {
        key: 'duration',
        label: 'Duración (segundos)',
        type: 'select',
        defaultValue: 5,
        options: [
          { label: '5 segundos (Económico)', value: 5 },
          { label: '10 segundos', value: 10 },
        ],
      },
    ],
    economyPreset: {
      duration: 5,
    },
    estimatedCost: {
      standardLabel: '~$0.25 – $0.50 USD / video',
      economyLabel: '~$0.25 USD (5s)',
      note: 'Requiere URL de imagen accesible públicamente vía HTTPS.',
    },
  },
];

export function getModelById(id: string): ModelConfig | undefined {
  return MODELS.find((model) => model.id === id);
}

export function getDefaultParamsForModel(
  model: ModelConfig,
  economyMode = false
): Record<string, ParameterValue> {
  const defaults: Record<string, ParameterValue> = {};
  for (const param of model.parameters) {
    defaults[param.key] = param.defaultValue;
  }
  if (economyMode) {
    return {
      ...defaults,
      ...model.economyPreset,
    };
  }
  return defaults;
}
