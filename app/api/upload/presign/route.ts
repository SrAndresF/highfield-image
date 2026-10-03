import { NextRequest, NextResponse } from 'next/server';
import { requireTeamAccess } from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractUserCredentials } from '@/lib/higgsfield-server';

interface PresignRequestBody {
  contentType?: string;
  filename?: string;
  mediaKind?: 'image' | 'video';
  fileSize?: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const teamAuthError = requireTeamAccess(req);
  if (teamAuthError) return teamAuthError;

  const rateLimitError = checkRateLimit(req, {
    bucket: 'api_upload_presign',
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const credsResult = extractUserCredentials(req);
  if (!credsResult.ok) {
    return credsResult.response;
  }

  let body: PresignRequestBody = {};
  try {
    body = (await req.json()) as PresignRequestBody;
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo de petición JSON inválido.' },
      { status: 400 }
    );
  }

  const isVideo =
    body.mediaKind === 'video' ||
    (body.contentType && body.contentType.toLowerCase().startsWith('video/')) ||
    (body.filename && /\.(mp4|mov|webm|mkv|avi)$/i.test(body.filename));

  // Normalizar content-type
  let contentType = (body.contentType || '').trim().toLowerCase();
  if (contentType === 'image/jpg') {
    contentType = 'image/jpeg';
  } else if (contentType === 'video/quicktime' || contentType === 'video/x-m4v') {
    contentType = 'video/mp4';
  } else if (!contentType) {
    contentType = isVideo ? 'video/mp4' : 'image/jpeg';
  }

  const { credentials } = credsResult;

  // =========================================================================
  // 1. INTENTO PRINCIPAL: Endpoint oficial de Higgsfield /files/generate-upload-url
  // =========================================================================
  try {
    const hfRes = await fetch(
      'https://api.higgsfield.ai/files/generate-upload-url',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${credentials.keyId}:${credentials.keySecret}`,
          'hf-api-key': credentials.keyId,
          'hf-secret': credentials.keySecret,
          'Content-Type': 'application/json',
          'User-Agent': 'higgsfield-server-js/2.0',
        },
        body: JSON.stringify({ content_type: contentType }),
      }
    );

    if (hfRes.ok) {
      const hfData = (await hfRes.json()) as {
        upload_url?: string;
        public_url?: string;
      };

      if (hfData.upload_url && hfData.public_url) {
        return NextResponse.json({
          success: true,
          uploadUrl: hfData.upload_url,
          publicUrl: hfData.public_url,
          contentType,
          method: 'PUT',
          provider: 'higgsfield_cdn',
        });
      }
    } else if (hfRes.status === 401 || hfRes.status === 403) {
      return NextResponse.json(
        {
          error:
            'API key de Higgsfield inválida o no autorizada. Verifica tu Key ID y Secret en la configuración.',
          code: 'INVALID_CREDENTIALS',
        },
        { status: 401 }
      );
    }
  } catch {
    // Continuar al intento 2
  }

  // =========================================================================
  // 2. INTENTO SECUNDARIO: Endpoint de media de agentes (/v1/agent/media)
  // =========================================================================
  try {
    const ext = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
      ? 'webp'
      : contentType.includes('gif')
      ? 'gif'
      : contentType.includes('mp4')
      ? 'mp4'
      : contentType.includes('webm')
      ? 'webm'
      : 'jpeg';

    const agentMediaRes = await fetch(
      'https://api.higgsfield.ai/v1/agent/media',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${credentials.keyId}:${credentials.keySecret}`,
          'hf-api-key': credentials.keyId,
          'hf-secret': credentials.keySecret,
          'Content-Type': 'application/json',
          'User-Agent': 'higgsfield-server-js/2.0',
        },
        body: JSON.stringify({
          extension: ext,
          type: isVideo ? 'video' : 'image',
        }),
      }
    );

    if (agentMediaRes.ok) {
      const slot = (await agentMediaRes.json()) as {
        id?: string;
        upload_url?: string;
        url?: string;
        content_type?: string;
      };

      if (slot.upload_url && (slot.url || slot.id)) {
        return NextResponse.json({
          success: true,
          uploadUrl: slot.upload_url,
          publicUrl: slot.url,
          contentType: slot.content_type || contentType,
          slotId: slot.id,
          method: 'PUT',
          provider: 'higgsfield_agent_media',
        });
      }
    }
  } catch {
    // Falló intento secundario
  }

  return NextResponse.json(
    {
      error:
        'No fue posible generar una URL de subida directa en Higgsfield. Verifica tu API Key o introduce la URL directa del archivo.',
      code: 'PRESIGN_FAILED',
    },
    { status: 502 }
  );
}
