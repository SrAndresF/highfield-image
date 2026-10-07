export type MediaType = 'image' | 'video';

export type GenerationCategory =
  | 'text-to-image'
  | 'text-to-video'
  | 'image-to-video'
  | 'motion-transfer';

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
  mediaKind?: 'image' | 'video';
  allowMultiple?: boolean;
  maxFiles?: number;
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
  category: GenerationCategory;
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
 * Clasificados por categoría:
 * - text-to-image: Texto a Imagen (+ soporte de imagen de referencia)
 * - image-to-video: Imagen a Video (Animar imagen inicial o fotograma de referencia)
 * - text-to-video: Texto a Video
 * - motion-transfer: Transferencia de movimiento (Genjutsu: video + referencia)
 */
export const MODELS: readonly ModelConfig[] = [
  // ============================================================================
  // 1. MODELOS DE IMAGEN A VIDEO (ANIMAR IMAGEN / REFERENCIA)
  // ============================================================================
  {
    id: 'bytedance/seedance-2.5/image-to-video',
    name: 'ByteDance Seedance 2.5 (Image-to-Video)',
    provider: 'ByteDance · Higgsfield V2',
    type: 'video',
    category: 'image-to-video',
    badge: 'Imagen a Video + Audio',
    description:
      'Convierte una imagen de referencia en un video cinematográfico de alta coherencia y fluidez con síntesis opcional de audio sincronizado.',
    parameters: [
      {
        key: 'image_url',
        label: 'Imagen Inicial de Referencia',
        description: 'Sube tu imagen (JPG, PNG, WebP) o pega un enlace para animarla con Seedance 2.5.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
        defaultValue: '',
        required: true,
        mediaKind: 'image',
      },
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
        defaultValue: 'original',
        options: [
          { label: 'Original (Mantener aspecto de la imagen)', value: 'original' },
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
        description: 'Sintetiza efectos de sonido y ambiente acordes al movimiento.',
        type: 'boolean',
        defaultValue: true,
      },
    ],
    economyPreset: {
      duration: 5,
      resolution: '720p',
      aspect_ratio: 'original',
      output_format: 'mp4',
      generate_audio: false,
    },
    estimatedCost: {
      standardLabel: '~$0.25 – $0.60 USD / video',
      economyLabel: '~$0.20 USD (5s · 720p · sin audio)',
      note: 'El modo económico reduce la duración a 5s y desactiva síntesis de audio para ahorrar créditos.',
    },
    transformPayload: (prompt, rawParams) => {
      const payload: Record<string, unknown> = {
        image_url: String(rawParams.image_url ?? '').trim(),
        prompt: prompt.trim(),
        duration: Number(rawParams.duration ?? 5),
        resolution: String(rawParams.resolution ?? '720p'),
        output_format: String(rawParams.output_format ?? 'mp4'),
        generate_audio: Boolean(rawParams.generate_audio ?? true),
      };

      const ar = String(rawParams.aspect_ratio ?? 'original');
      if (ar && ar !== 'original') {
        payload.aspect_ratio = ar;
      }

      return payload;
    },
  },
  {
    id: 'kling-video/v3.0/std/image-to-video',
    name: 'Kling 3.0 Standard (Image-to-Video)',
    provider: 'Kuaishou Kling · Higgsfield V2',
    type: 'video',
    category: 'image-to-video',
    badge: 'Imagen a Video',
    description:
      'Anima una imagen o fotografía fija inicial con el motor de Kling 3.0, generando un video cinematográfico coherente.',
    parameters: [
      {
        key: 'image_url',
        label: 'Imagen Inicial de Referencia',
        description: 'Sube tu imagen (JPG, PNG, WebP) o pega un enlace para usarla como primer fotograma.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
        defaultValue: '',
        required: true,
        mediaKind: 'image',
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
      note: 'Requiere imagen inicial (se sube automáticamente a Higgsfield CDN o por URL).',
    },
    transformPayload: (prompt, rawParams) => ({
      image_url: String(rawParams.image_url ?? '').trim(),
      prompt: prompt.trim(),
      duration: Number(rawParams.duration ?? 5),
    }),
  },
  {
    id: 'alibaba/wan-3.0-prime/image-to-video',
    name: 'Alibaba Wan 3.0 Prime (Image-to-Video)',
    provider: 'Alibaba Cloud · Higgsfield V2',
    type: 'video',
    category: 'image-to-video',
    badge: 'Imagen a Video Prime',
    description:
      'Modelo avanzado de Alibaba para convertir imágenes en videos fluidos con control de resolución (720p/1080p) y relación de aspecto.',
    parameters: [
      {
        key: 'image_url',
        label: 'Imagen Inicial de Referencia',
        description: 'Sube o ingresa la imagen que definirá el inicio del video.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
        defaultValue: '',
        required: true,
        mediaKind: 'image',
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
      {
        key: 'resolution',
        label: 'Resolución',
        type: 'select',
        defaultValue: '720p',
        options: [
          { label: '720p (HD Económico)', value: '720p' },
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
          { label: '9:16 (Vertical / Reels)', value: '9:16' },
          { label: '1:1 (Cuadrado)', value: '1:1' },
        ],
      },
    ],
    economyPreset: {
      duration: 5,
      resolution: '720p',
      aspect_ratio: '16:9',
    },
    estimatedCost: {
      standardLabel: '~$0.20 – $0.50 USD / video',
      economyLabel: '~$0.20 USD (5s · 720p)',
      note: 'El modo económico fija 720p y 5 segundos.',
    },
    transformPayload: (prompt, rawParams) => ({
      image_url: String(rawParams.image_url ?? '').trim(),
      prompt: prompt.trim(),
      duration: Number(rawParams.duration ?? 5),
      resolution: String(rawParams.resolution ?? '720p'),
      aspect_ratio: String(rawParams.aspect_ratio ?? '16:9'),
    }),
  },
  {
    id: '/v1/image2video/dop',
    name: 'Higgsfield DoP (Director of Photography)',
    provider: 'Higgsfield AI',
    type: 'video',
    category: 'image-to-video',
    badge: 'Imagen a Video DoP',
    description:
      'Anima una imagen con control cinematográfico de cámara (DoP Lite, Turbo o Standard).',
    parameters: [
      {
        key: 'image_url',
        label: 'Imagen Inicial de Referencia',
        description: 'Sube tu imagen o ingresa una URL pública HTTPS.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb',
        defaultValue: '',
        required: true,
        mediaKind: 'image',
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

  // ============================================================================
  // 2. MODELOS DE TRANSFERENCIA DE MOVIMIENTO (GENJUTSU)
  // ============================================================================
  {
    id: 'higgsfield/genjutsu/motion-transfer/v1.0',
    name: 'Higgsfield / Genjutsu (Motion Transfer v1.0)',
    provider: 'HiggsfieldVideo · Genjutsu',
    type: 'video',
    category: 'motion-transfer',
    badge: 'Motion Transfer · Video + Ref',
    description:
      'Transfiere el movimiento, cámara y actuación de un video origen (mín. 4s) hacia un nuevo personaje, objeto o estilo usando de 1 a 8 imágenes de referencia.',
    parameters: [
      {
        key: 'video_url',
        label: 'Video Origen (mín. 4s, máx. 30s)',
        description: 'Sube tu video o pega el enlace cuyo movimiento deseas transferir.',
        type: 'url',
        placeholder: 'https://download.samplelib.com/mp4/sample-5s.mp4',
        defaultValue: '',
        required: true,
        mediaKind: 'video',
      },
      {
        key: 'image_url',
        label: 'Imagen(es) de Referencia (1 a 8 imágenes)',
        description:
          'Sube de 1 a 8 imágenes de referencia (puedes seleccionar varias a la vez o agregarlas una a una) para definir el nuevo personaje o estilo.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        defaultValue: '',
        required: true,
        mediaKind: 'image',
        allowMultiple: true,
        maxFiles: 8,
      },
    ],
    economyPreset: {},
    estimatedCost: {
      standardLabel: '~$0.30 – $0.65 USD / transferencia',
      economyLabel: '~$0.30 USD (según duración del video origen)',
      note: 'La duración de salida depende del video origen (videos >30s se recortan a 30s).',
    },
    transformPayload: (prompt, rawParams) => {
      const videoUrl = String(rawParams.video_url ?? '').trim();
      const rawImageUrls = String(rawParams.image_url ?? '')
        .split(',')
        .map((u) => u.trim())
        .filter((u) => u.length > 0)
        .slice(0, 8);

      const payload: Record<string, unknown> = {
        video_url: videoUrl,
        image_urls: rawImageUrls,
      };

      const cleanPrompt = prompt.trim();
      if (cleanPrompt) {
        payload.prompt = cleanPrompt;
      }

      return payload;
    },
  },

  // ============================================================================
  // 3. MODELOS DE TEXTO A VIDEO
  // ============================================================================
  {
    id: 'bytedance/seedance-2.5/text-to-video',
    name: 'ByteDance Seedance 2.5',
    provider: 'ByteDance · Higgsfield V2',
    type: 'video',
    category: 'text-to-video',
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
    category: 'text-to-video',
    badge: 'Texto a Video Pro',
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
    category: 'text-to-video',
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

  // ============================================================================
  // 4. MODELOS DE TEXTO A IMAGEN (+ REFERENCIA)
  // ============================================================================
  {
    id: 'flux-pro/kontext/max/text-to-image',
    name: 'Flux Pro Kontext Max',
    provider: 'Black Forest Labs · Higgsfield V2',
    type: 'image',
    category: 'text-to-image',
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
    name: 'Higgsfield Soul (HD / Con Imagen de Referencia)',
    provider: 'Higgsfield AI',
    type: 'image',
    category: 'text-to-image',
    badge: 'Texto a Imagen + Referencia',
    description:
      'Modelo propietario de Higgsfield (Soul) con soporte para imágenes de referencia para transferir personajes o estilos, resoluciones nativas y generación por lotes.',
    parameters: [
      {
        key: 'image_reference',
        label: 'Imagen de Referencia de Estilo / Personaje (Opcional)',
        description: 'Sube una imagen o ingresa una URL para transferir el rostro, estilo o composición a la nueva imagen.',
        type: 'url',
        placeholder: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
        defaultValue: '',
        required: false,
        mediaKind: 'image',
      },
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

      const refUrl = String(rawParams.image_reference ?? '').trim();
      if (refUrl) {
        payload.image_reference = {
          type: 'image_url',
          image_url: refUrl,
        };
      }

      const seedVal = Number(rawParams.seed ?? 0);
      if (seedVal > 0) {
        payload.seed = seedVal;
      }
      return payload;
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
