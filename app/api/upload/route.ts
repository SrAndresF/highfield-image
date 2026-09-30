import { NextRequest, NextResponse } from 'next/server';
import { requireTeamAccess } from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { extractUserCredentials, sanitizeErrorText } from '@/lib/higgsfield-server';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
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

    const contentType = file.type || 'image/jpeg';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Intentar primero subir directamente al CDN de Higgsfield mediante /files/generate-upload-url
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
          const s3Put = await fetch(hfData.upload_url, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
            },
            body: buffer,
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
      // Continuar al almacenamiento local si el CDN de Higgsfield no está disponible
    }

    // Fallback: guardar archivo temporal en carpeta pública del servidor
    const ext =
      contentType.includes('png')
        ? 'png'
        : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('gif')
        ? 'gif'
        : contentType.includes('mp4')
        ? 'mp4'
        : 'jpg';

    const filename = `${randomUUID()}.${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || 'localhost:3000';
    const localUrl = `${protocol}://${host}/uploads/${filename}`;

    return NextResponse.json({
      url: localUrl,
      provider: 'local_storage',
    });
  } catch (error) {
    const safeError = sanitizeErrorText(
      error instanceof Error ? error.message : 'Error desconocido al subir archivo'
    );
    return NextResponse.json(
      { error: `Error al procesar el archivo: ${safeError}` },
      { status: 500 }
    );
  }
}
