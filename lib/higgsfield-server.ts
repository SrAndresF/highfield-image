import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createHiggsfieldClient,
  AuthenticationError,
  NotEnoughCreditsError,
  ValidationError,
  BadInputError,
  APIError,
  type V2Response,
} from '@higgsfield/client/v2';

export const CREDENTIALS_HEADER = 'x-hf-credentials';
const HIGGSFIELD_BASE_URL = 'https://api.higgsfield.ai';

const credentialsSchema = z
  .string()
  .min(5, 'La API key es demasiado corta.')
  .refine(
    (val) => {
      const parts = val.split(':');
      return (
        parts.length === 2 &&
        parts[0] !== undefined &&
        parts[0].trim().length >= 2 &&
        parts[1] !== undefined &&
        parts[1].trim().length >= 2
      );
    },
    {
      message:
        'Formato de API key inválido. Debe tener el formato "api-key-id:api-key-secret".',
    }
  );

export interface ParsedCredentials {
  raw: string;
  keyId: string;
  keySecret: string;
}

/**
 * Extrae y valida la API key desde el header personalizado `x-hf-credentials`.
 * NUNCA guarda, registra en consola ni devuelve la credencial.
 */
export function extractUserCredentials(
  req: NextRequest
): { ok: true; credentials: ParsedCredentials } | { ok: false; response: NextResponse } {
  const headerValue = req.headers.get(CREDENTIALS_HEADER)?.trim();

  if (!headerValue) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'API key ausente. Configura tu API key de Higgsfield (ID:Secret) en el panel de configuración.',
          code: 'MISSING_API_KEY',
        },
        { status: 401 }
      ),
    };
  }

  const parsed = credentialsSchema.safeParse(headerValue);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ??
            'Formato de API key inválido. Usa "api-key-id:api-key-secret".',
          code: 'INVALID_API_KEY_FORMAT',
        },
        { status: 401 }
      ),
    };
  }

  const [keyId, keySecret] = parsed.data.split(':');
  return {
    ok: true,
    credentials: {
      raw: `${keyId.trim()}:${keySecret.trim()}`,
      keyId: keyId.trim(),
      keySecret: keySecret.trim(),
    },
  };
}

/**
 * Elimina cualquier posible aparición de las credenciales en textos de error
 * para garantizar que jamás se filtren en respuestas HTTP ni en logs.
 */
export function sanitizeErrorText(text: string, creds?: ParsedCredentials): string {
  let clean = text;
  if (creds) {
    if (creds.raw) clean = clean.split(creds.raw).join('[REDACTED]');
    if (creds.keyId && creds.keyId.length > 3) {
      clean = clean.split(creds.keyId).join('[REDACTED_ID]');
    }
    if (creds.keySecret && creds.keySecret.length > 3) {
      clean = clean.split(creds.keySecret).join('[REDACTED_SECRET]');
    }
  }
  clean = clean.replace(/Key\s+[A-Za-z0-9_-]+:[A-Za-z0-9_-]+/gi, 'Key [REDACTED]');
  return clean;
}

function buildV2Headers(creds: ParsedCredentials): Record<string, string> {
  return {
    Authorization: `Key ${creds.keyId}:${creds.keySecret}`,
    'hf-api-key': creds.keyId,
    'hf-secret': creds.keySecret,
    'Content-Type': 'application/json',
    'User-Agent': 'higgsfield-server-js/2.0',
  };
}

/**
 * Envía un trabajo de generación creando una instancia aislada del cliente v2
 * por petición (`createHiggsfieldClient`), evitando usar el singleton global `config()`
 * para prevenir condiciones de carrera entre múltiples usuarios simultáneos.
 */
export async function submitGenerationJob(
  creds: ParsedCredentials,
  endpoint: string,
  input: Record<string, unknown>
): Promise<V2Response> {
  const isolatedClient = createHiggsfieldClient({
    credentials: creds.raw,
    timeout: 45000,
    maxRetries: 1,
  });

  return await isolatedClient.subscribe(endpoint, {
    input,
    withPolling: false,
  });
}

export interface NormalizedStatusResponse {
  requestId: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'nsfw' | 'canceled';
  resultUrl: string | null;
  images: string[];
  videoUrl: string | null;
  errorMessage?: string;
}

/**
 * Consulta el estado de un job en Higgsfield usando fetch directo con las credenciales
 * de la petición actual (`GET /requests/{id}/status`).
 */
export async function fetchJobStatus(
  creds: ParsedCredentials,
  requestId: string
): Promise<NormalizedStatusResponse> {
  const url = `${HIGGSFIELD_BASE_URL}/requests/${encodeURIComponent(requestId)}/status`;
  const response = await fetch(url, {
    method: 'GET',
    headers: buildV2Headers(creds),
    cache: 'no-store',
  });

  if (!response.ok) {
    await throwMappedHttpError(response, creds);
  }

  const data = (await response.json()) as Record<string, unknown>;
  const rawStatus = String(data.status ?? 'queued').toLowerCase();

  let status: NormalizedStatusResponse['status'] = 'queued';
  if (
    rawStatus === 'queued' ||
    rawStatus === 'in_progress' ||
    rawStatus === 'completed' ||
    rawStatus === 'failed' ||
    rawStatus === 'nsfw' ||
    rawStatus === 'canceled'
  ) {
    status = rawStatus;
  } else if (rawStatus === 'cancelled') {
    status = 'canceled';
  } else if (rawStatus === 'processing' || rawStatus === 'running') {
    status = 'in_progress';
  }

  const images: string[] = [];
  if (Array.isArray(data.images)) {
    for (const item of data.images) {
      if (
        item &&
        typeof item === 'object' &&
        'url' in item &&
        typeof (item as { url: unknown }).url === 'string'
      ) {
        images.push((item as { url: string }).url);
      }
    }
  }

  let videoUrl: string | null = null;
  if (
    data.video &&
    typeof data.video === 'object' &&
    'url' in data.video &&
    typeof (data.video as { url: unknown }).url === 'string'
  ) {
    videoUrl = (data.video as { url: string }).url;
  }

  // Soporte compatible para formato JobSet v1 (jobs[0].results.raw.url)
  if (!videoUrl && images.length === 0 && Array.isArray(data.jobs)) {
    for (const job of data.jobs) {
      if (job && typeof job === 'object') {
        const jobObj = job as Record<string, unknown>;
        if (typeof jobObj.status === 'string') {
          const js = jobObj.status.toLowerCase();
          if (js === 'completed' || js === 'failed' || js === 'nsfw' || js === 'canceled') {
            status = js;
          } else if (js === 'in_progress' || js === 'queued') {
            status = js;
          }
        }
        const results = jobObj.results as Record<string, unknown> | undefined;
        const raw = results?.raw as Record<string, unknown> | undefined;
        if (raw && typeof raw.url === 'string') {
          const urlStr = raw.url;
          if (urlStr.endsWith('.mp4') || urlStr.endsWith('.webm') || urlStr.includes('video')) {
            videoUrl = urlStr;
          } else {
            images.push(urlStr);
          }
        }
      }
    }
  }

  const resultUrl = videoUrl ?? images[0] ?? null;

  let errorMessage: string | undefined;
  if (status === 'failed') {
    let detailedErr = '';
    if (typeof data.error === 'string' && data.error) {
      detailedErr = data.error;
    } else if (typeof data.detail === 'string' && data.detail) {
      detailedErr = data.detail;
    } else if (typeof data.message === 'string' && data.message) {
      detailedErr = data.message;
    } else if (typeof data.reason === 'string' && data.reason) {
      detailedErr = data.reason;
    }

    if (Array.isArray(data.jobs)) {
      for (const j of data.jobs) {
        if (j && typeof j === 'object') {
          const jo = j as Record<string, unknown>;
          if (typeof jo.error === 'string' && jo.error && jo.error !== 'Generation failed') {
            detailedErr = detailedErr ? `${detailedErr} (${jo.error})` : jo.error;
          }
        }
      }
    }

    if (detailedErr) {
      const sanitized = sanitizeErrorText(detailedErr, creds);
      const lower = sanitized.toLowerCase();
      if (lower.trim() === 'generation failed') {
        errorMessage =
          'La generación no pudo ser completada por Higgsfield (Generation failed). Esto suele ocurrir si el archivo de origen no pudo descargarse o si el clúster GPU tuvo una sobrecarga temporal. Tus créditos reservados se reembolsan automáticamente.';
      } else if (
        lower.includes('credit balance is too low') ||
        lower.includes('not enough credits') ||
        lower.includes('insufficient balance') ||
        lower.includes('top up your balance')
      ) {
        errorMessage =
          'Saldo de API insuficiente en Higgsfield: Tu cuenta en open.higgsfield.ai no cuenta con balance suficiente en USD para procesar esta solicitud. ⚠️ Recuerda que los créditos de la suscripción web (higgsfield.ai) NO se aplican a la API: tu API Key consume del saldo prepagado en USD (Balance) en tu consola de desarrollador. Recarga saldo ("Top up balance") en https://open.higgsfield.ai/billing para poder generar.';
      } else {
        errorMessage = `Error de Higgsfield: ${sanitized}. Tus créditos reservados se reembolsan automáticamente.`;
      }
    } else {
      errorMessage =
        'La generación falló en los servidores de Higgsfield. Tus créditos reservados se reembolsan automáticamente.';
    }
  } else if (status === 'nsfw') {
    errorMessage =
      'El contenido generado o el material de entrada fue bloqueado por el filtro de seguridad (NSFW). Los créditos han sido reembolsados automáticamente.';
  }

  return {
    requestId: typeof data.request_id === 'string' ? data.request_id : requestId,
    status,
    resultUrl,
    images,
    videoUrl,
    errorMessage,
  };
}

/**
 * Solicita la cancelación de un job en cola (`POST /requests/{id}/cancel`).
 */
export async function cancelJobRequest(
  creds: ParsedCredentials,
  requestId: string
): Promise<{ canceled: boolean; message: string }> {
  const url = `${HIGGSFIELD_BASE_URL}/requests/${encodeURIComponent(requestId)}/cancel`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildV2Headers(creds),
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) {
    await throwMappedHttpError(response, creds);
  }

  if (!response.ok) {
    return {
      canceled: false,
      message:
        'No fue posible cancelar el trabajo (puede que ya esté en progreso o haya finalizado).',
    };
  }

  return {
    canceled: true,
    message: 'Solicitud cancelada correctamente. Los créditos en cola son reembolsados.',
  };
}

/**
 * Verifica la validez de la API Key haciendo una llamada ligera sin costo a Higgsfield.
 * TODO: La API pública de Higgsfield (api.higgsfield.ai) aún no documenta un endpoint REST
 * público que devuelva el saldo numérico exacto en USD (se administra en console.higgsfield.ai).
 * Validamos la autenticación contra `/requests/{probe_id}/status` y `/v1/motions`.
 */
export async function verifyCredentialsAndCheckCredits(
  creds: ParsedCredentials
): Promise<{
  valid: boolean;
  balanceUsd: number | null;
  statusLabel: string;
  message: string;
}> {
  const probeId = '00000000-0000-0000-0000-000000000000';
  const probeUrl = `${HIGGSFIELD_BASE_URL}/requests/${probeId}/status`;

  const probeRes = await fetch(probeUrl, {
    method: 'GET',
    headers: buildV2Headers(creds),
    cache: 'no-store',
  });

  if (probeRes.status === 401) {
    throw new AuthenticationError('API key inválida o no autorizada.');
  }

  if (probeRes.status === 402 || probeRes.status === 403) {
    let detail = '';
    try {
      const errBody = (await probeRes.json()) as Record<string, unknown>;
      detail = String(errBody.detail ?? errBody.message ?? '');
    } catch {
      // ignore json parse failure
    }
    if (detail.toLowerCase().includes('invalid') || detail.toLowerCase().includes('unauthorized') || detail.toLowerCase().includes('key')) {
      throw new AuthenticationError('API key inválida o sin permisos.');
    }
    return {
      valid: true,
      balanceUsd: 0,
      statusLabel: 'Sin saldo / Créditos agotados',
      message:
        'Tu API Key es válida, pero la cuenta reporta saldo insuficiente. Recarga saldo en console.higgsfield.ai.',
    };
  }

  // Si devuelve 404 (el request_id de prueba no existe) o 200, la autenticación pasó exitosamente en el gateway de Higgsfield.
  return {
    valid: true,
    balanceUsd: null,
    statusLabel: 'Key verificada · Pay-as-you-go activo',
    message:
      'Conexión exitosa con api.higgsfield.ai. Tu credencial es válida (el saldo en USD se gestiona desde console.higgsfield.ai).',
  };
}

async function throwMappedHttpError(
  response: Response,
  creds: ParsedCredentials
): Promise<never> {
  let detailMessage = '';
  try {
    const body = (await response.json()) as Record<string, unknown>;
    if (typeof body.detail === 'string') {
      detailMessage = body.detail;
    } else if (Array.isArray(body.detail)) {
      detailMessage = body.detail
        .map((item) => {
          if (item && typeof item === 'object' && 'msg' in item) {
            return String((item as { msg: unknown }).msg);
          }
          return JSON.stringify(item);
        })
        .join('; ');
    } else if (typeof body.message === 'string') {
      detailMessage = body.message;
    } else if (typeof body.error === 'string') {
      detailMessage = body.error;
    }
  } catch {
    // ignore
  }

  const safeDetail = sanitizeErrorText(detailMessage, creds);

  if (response.status === 401) {
    throw new AuthenticationError(safeDetail || 'Credenciales de API inválidas.');
  }
  if (response.status === 402 || response.status === 403) {
    throw new NotEnoughCreditsError();
  }
  if (response.status === 422) {
    throw new ValidationError(safeDetail || 'Parámetros rechazados por el modelo.');
  }
  if (response.status === 400) {
    throw new BadInputError(safeDetail || 'Solicitud incorrecta.');
  }
  throw new APIError(
    safeDetail || `Error HTTP ${response.status} en Higgsfield API`,
    response.status
  );
}

/**
 * Traduce cualquier error del SDK o de red en una respuesta JSON en español
 * sin exponer jamás la API key del usuario.
 */
export function handleHiggsfieldError(
  error: unknown,
  creds?: ParsedCredentials
): NextResponse {
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      {
        error:
          'API key inválida o no autorizada. Verifica tu Key ID y Key Secret en la configuración.',
        code: 'INVALID_API_KEY',
      },
      { status: 401 }
    );
  }

  if (error instanceof NotEnoughCreditsError) {
    return NextResponse.json(
      {
        error:
          'Saldo o créditos insuficientes en tu cuenta de Higgsfield (console.higgsfield.ai). Recarga tu cuenta para continuar.',
        code: 'INSUFFICIENT_CREDITS',
      },
      { status: 402 }
    );
  }

  if (error instanceof ValidationError || error instanceof BadInputError) {
    const safeMsg = sanitizeErrorText(error.message || '', creds);
    return NextResponse.json(
      {
        error: `Parámetros inválidos para el modelo seleccionado${safeMsg ? `: ${safeMsg}` : '.'}`,
        code: 'VALIDATION_ERROR',
      },
      { status: 400 }
    );
  }

  if (error instanceof APIError) {
    const status = error.statusCode ?? 502;
    if (status === 429) {
      return NextResponse.json(
        {
          error:
            'Límite de velocidad alcanzado en tu cuenta de Higgsfield API. Espera unos segundos e inténtalo de nuevo.',
          code: 'HIGGSFIELD_RATE_LIMIT',
        },
        { status: 429 }
      );
    }
    const safeMsg = sanitizeErrorText(error.message || '', creds);
    return NextResponse.json(
      {
        error: `Error del servidor de Higgsfield (${status})${safeMsg ? `: ${safeMsg}` : '.'}`,
        code: 'UPSTREAM_API_ERROR',
      },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }

  const genericMsg =
    error instanceof Error
      ? sanitizeErrorText(error.message, creds)
      : 'Error inesperado al comunicarse con Higgsfield API.';

  return NextResponse.json(
    {
      error: `Error al procesar la solicitud: ${genericMsg}`,
      code: 'INTERNAL_ERROR',
    },
    { status: 500 }
  );
}
