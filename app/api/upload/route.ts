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
    // 1. INTENTO PRINCIPAL: Alojamiento en la nube directo (Catbox)
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
      // Continuar al intento 2
    }

    // =========================================================================
    // 2. INTENTO SECUNDARIO: Litterbox (72 horas de persistencia)
    // =========================================================================
    try {
      const litterData = new FormData();
      litterData.append('reqtype', 'fileupload');
      litterData.append('time', '72h');
      litterData.append(
        'fileToUpload',
        new Blob([arrayBuffer], { type: contentType }),
        filename
      );

      const litterRes = await fetch(
        'https://litterbox.catbox.moe/resources/internals/api.php',
        {
          method: 'POST',
          body: litterData,
        }
      );

      if (litterRes.ok) {
        const publicUrl = (await litterRes.text()).trim();
        if (publicUrl.startsWith('https://')) {
          return NextResponse.json({
            url: publicUrl,
            provider: 'litterbox_storage',
          });
        }
      }
    } catch {
      // Continuar
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
