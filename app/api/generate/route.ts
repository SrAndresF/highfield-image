import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeamAccess } from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  extractUserCredentials,
  handleHiggsfieldError,
  submitGenerationJob,
} from '@/lib/higgsfield-server';
import { getModelById, type ParameterValue } from '@/lib/models';
import { resolvePayloadMediaUrls } from '@/lib/media-utils';

const generateRequestSchema = z.object({
  modelId: z.string().min(1, 'Debes seleccionar un modelo.'),
  prompt: z
    .string()
    .trim()
    .max(2500, 'El prompt no puede superar los 2,500 caracteres.')
    .default(''),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

function sanitizeMediaUrlsForWorkers(
  data: Record<string, unknown>,
  baseUrl: string
): Record<string, unknown> {
  const isTargetUrl = (url: string) => {
    return (
      url.includes('catbox.moe') ||
      url.includes('litterbox') ||
      url.includes('tmpfiles.org')
    );
  };

  const transformUrl = (url: string): string => {
    if (typeof url === 'string' && isTargetUrl(url)) {
      if (url.includes('/api/media?url=')) return url;
      return `${baseUrl}/api/media?url=${encodeURIComponent(url.trim())}`;
    }
    return url;
  };

  const processVal = (val: unknown): unknown => {
    if (typeof val === 'string') {
      return transformUrl(val);
    }
    if (Array.isArray(val)) {
      return val.map((item) => processVal(item));
    }
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = processVal(v);
      }
      return out;
    }
    return val;
  };

  return processVal(data) as Record<string, unknown>;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const teamAuthError = requireTeamAccess(req);
  if (teamAuthError) return teamAuthError;

  const rateLimitError = checkRateLimit(req, {
    bucket: 'api_generate',
    maxRequests: 15,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const credsResult = extractUserCredentials(req);
  if (!credsResult.ok) {
    return credsResult.response;
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Formato JSON inválido en el cuerpo de la petición.', code: 'BAD_JSON' },
      { status: 400 }
    );
  }

  const parsed = generateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          'Datos de entrada inválidos para la generación.',
        code: 'INVALID_INPUT',
      },
      { status: 400 }
    );
  }

  const { modelId, prompt, params } = parsed.data;
  const model = getModelById(modelId);

  if (!model) {
    return NextResponse.json(
      {
        error: `El modelo seleccionado ("${modelId}") no está registrado en el catálogo.`,
        code: 'UNKNOWN_MODEL',
      },
      { status: 400 }
    );
  }

  const isGenjutsu = model.id.includes('genjutsu');
  if (!isGenjutsu && prompt.length < 3) {
    return NextResponse.json(
      {
        error: 'El prompt debe tener al menos 3 caracteres para este modelo.',
        code: 'PROMPT_TOO_SHORT',
      },
      { status: 400 }
    );
  }

  // Validación dinámica contra los parámetros definidos en lib/models.ts
  const validatedParams: Record<string, ParameterValue> = {};

  for (const paramDef of model.parameters) {
    const rawValue = params[paramDef.key] ?? paramDef.defaultValue;

    if (paramDef.type === 'url') {
      const strVal = String(rawValue ?? '').trim();
      if (paramDef.required && !strVal) {
        return NextResponse.json(
          {
            error: `El campo "${paramDef.label}" es obligatorio para el modelo ${model.name}.`,
            code: 'MISSING_REQUIRED_PARAM',
          },
          { status: 400 }
        );
      }
      if (strVal) {
        const urlList = strVal
          .split(',')
          .map((u) => u.trim())
          .filter((u) => u.length > 0);

        if (urlList.length > 8) {
          return NextResponse.json(
            {
              error: `El campo "${paramDef.label}" permite un máximo de 8 URLs de referencia.`,
              code: 'TOO_MANY_URLS',
            },
            { status: 400 }
          );
        }

        for (const singleUrl of urlList) {
          try {
            const parsedUrl = new URL(singleUrl);
            const isLocalhost =
              parsedUrl.hostname === 'localhost' ||
              parsedUrl.hostname === '127.0.0.1';
            if (parsedUrl.protocol !== 'https:' && !isLocalhost) {
              return NextResponse.json(
                {
                  error: `Todas las URLs en "${paramDef.label}" deben usar protocolo seguro HTTPS.`,
                  code: 'INVALID_URL_PROTOCOL',
                },
                { status: 400 }
              );
            }
          } catch {
            return NextResponse.json(
              {
                error: `El valor "${singleUrl}" en "${paramDef.label}" no es una URL válida.`,
                code: 'INVALID_URL',
              },
              { status: 400 }
            );
          }
        }
      }
      validatedParams[paramDef.key] = strVal;
    } else if (paramDef.type === 'select') {
      const allowedValues = paramDef.options.map((opt) => String(opt.value));
      if (!allowedValues.includes(String(rawValue))) {
        return NextResponse.json(
          {
            error: `Valor no permitido para "${paramDef.label}". Opciones válidas: ${allowedValues.join(', ')}.`,
            code: 'INVALID_SELECT_OPTION',
          },
          { status: 400 }
        );
      }
      const matchedOpt = paramDef.options.find(
        (opt) => String(opt.value) === String(rawValue)
      );
      validatedParams[paramDef.key] = matchedOpt ? matchedOpt.value : rawValue;
    } else if (paramDef.type === 'number') {
      const numVal = Number(rawValue);
      if (Number.isNaN(numVal) || numVal < paramDef.min || numVal > paramDef.max) {
        return NextResponse.json(
          {
            error: `El parámetro "${paramDef.label}" debe ser un número entre ${paramDef.min} y ${paramDef.max}.`,
            code: 'INVALID_NUMBER_RANGE',
          },
          { status: 400 }
        );
      }
      validatedParams[paramDef.key] = numVal;
    } else if (paramDef.type === 'boolean') {
      validatedParams[paramDef.key] = Boolean(rawValue);
    }
  }

  const finalPayload: Record<string, unknown> = model.transformPayload
    ? model.transformPayload(prompt, validatedParams)
    : {
        prompt,
        ...validatedParams,
      };

  // Re-escribir URLs alojadas en Catbox/Litterbox para que los workers Python de Higgsfield
  // puedan descargarlas a través de nuestro proxy seguro sin bloqueos de Cloudflare.
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    'localhost:3000';
  const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
  const baseUrl = `${proto}://${host}`;

  const directPayload = await resolvePayloadMediaUrls(finalPayload);
  const processedPayload = isLocal
    ? directPayload
    : sanitizeMediaUrlsForWorkers(directPayload, baseUrl);

  try {
    const v2Job = await submitGenerationJob(
      credsResult.credentials,
      model.id,
      processedPayload
    );

    const requestId =
      typeof v2Job.request_id === 'string' && v2Job.request_id.length > 0
        ? v2Job.request_id
        : typeof (v2Job as unknown as { id?: string }).id === 'string'
        ? (v2Job as unknown as { id: string }).id
        : '';

    if (!requestId) {
      return NextResponse.json(
        {
          error:
            'Higgsfield API aceptó la petición pero no devolvió un identificador de trabajo (request_id).',
          code: 'MISSING_REQUEST_ID',
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      requestId,
      status: v2Job.status ?? 'queued',
      modelId: model.id,
      modelType: model.type,
    });
  } catch (error) {
    return handleHiggsfieldError(error, credsResult.credentials);
  }
}
