import { NextRequest, NextResponse } from 'next/server';
import { requireTeamAccess } from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractUserCredentials, sanitizeErrorText } from '@/lib/higgsfield-server';
import { randomUUID } from 'node:crypto';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const teamAuthError = requireTeamAccess(req);
  if (teamAuthError) return teamAuthError;

  const rateLimitError = checkRateLimit(req, {
    bucket: 'api_upload',
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const credsResult = extractUserCredentials(req);
  if (!credsResult.ok) {
    return credsResult.response;
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No se envió ningún archivo válido en el campo "file".' },
        { status: 400 }
      );
    }

    // Normalizar content-type (S3 y Higgsfield requieren image/jpeg en lugar de image/jpg)
    let contentType = file.type || 'image/jpeg';
    if (contentType === 'image/jpg') {
      contentType = 'image/jpeg';
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const ext =
      contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
        ? 'gif'
        : contentType.includes('mp4')
        ? 'mp4'
        : contentType.includes('webm')
        ? 'webm'
        : contentType.includes('quicktime')
        ? 'mov'
        : 'jpg';

    const filename = `${randomUUID()}.${ext}`;

    // =========================================================================
    // 1. INTENTO PRINCIPAL: Subir a Higgsfield CDN (/files/generate-upload-url)
    // =========================================================================
    try {
      const hfUploadRes = await fetch(
        'https://api.higgsfield.ai/files/generate-upload-url',
        {
          method: 'POST',
          headers: {
            Authorization: `Key ${credsResult.credentials.keyId}:${credsResult.credentials.keySecret}`,
            'hf-api-key': credsResult.credentials.keyId,
            'hf-secret': credsResult.credentials.keySecret,
            'Content-Type': 'application/json',
            'User-Agent': 'higgsfield-server-js/2.0',
          },
          body: JSON.stringify({ content_type: contentType }),
        }
      );

      if (hfUploadRes.ok) {
        const hfData = (await hfUploadRes.json()) as {
          upload_url?: string;
          public_url?: string;
        };

        if (hfData.upload_url && hfData.public_url) {
          // La subida presigned a S3 debe enviarse limpia sin headers de autorización
          const s3Put = await fetch(hfData.upload_url, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
            },
            body: uint8Array,
          });

          if (s3Put.ok) {
            return NextResponse.json({
              url: hfData.public_url,
              provider: 'higgsfield_cdn',
            });
          }
        }
      }
    } catch {
      // Si la API de almacenamiento de Higgsfield no responde o no está habilitada para esta key,
      // procedemos con el fallback público seguro para serverless
    }

    // =========================================================================
    // 2. FALLBACK SEGURO SERVERLESS: Alojamiento público HTTPS accesible por Higgsfield
    // NOTA VERCEL: En AWS Lambda/Vercel el disco es de sólo lectura (/var/task).
    // Jamás intentamos escribir a disco local. Usamos servicios públicos directos.
    // =========================================================================
    try {
      const catboxData = new FormData();
      catboxData.append('reqtype', 'fileupload');
      catboxData.append(
        'fileToUpload',
        new Blob([arrayBuffer], { type: contentType }),
        filename
      );

      const catboxRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: catboxData,
      });

      if (catboxRes.ok) {
        const publicUrl = (await catboxRes.text()).trim();
        if (publicUrl.startsWith('https://')) {
          return NextResponse.json({
            url: publicUrl,
            provider: 'cloud_storage',
          });
        }
      }
    } catch {
      // Intentar segundo proveedor de respaldo
    }

    // 3. Fallback secundario: tmpfiles.org
    try {
      const tmpData = new FormData();
      tmpData.append(
        'file',
        new Blob([arrayBuffer], { type: contentType }),
        filename
      );

      const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        body: tmpData,
      });

      if (tmpRes.ok) {
        const tmpJson = (await tmpRes.json()) as {
          data?: { url?: string };
        };
        const rawUrl = tmpJson?.data?.url;
        if (rawUrl && typeof rawUrl === 'string') {
          const directUrl = rawUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          return NextResponse.json({
            url: directUrl,
            provider: 'tmpfiles_storage',
          });
        }
      }
    } catch {
      // Continuar a error controlado
    }

    return NextResponse.json(
      {
        error:
          'No fue posible obtener un enlace HTTPS público para el archivo. Puedes ingresar una URL pública directamente usando la opción "Enlace URL".',
        code: 'UPLOAD_FAILED',
      },
      { status: 502 }
    );
  } catch (error) {
    const safeError = sanitizeErrorText(
      error instanceof Error ? error.message : 'Error inesperado al subir archivo'
    );
    return NextResponse.json(
      { error: `Error al procesar el archivo: ${safeError}` },
      { status: 500 }
    );
  }
}
