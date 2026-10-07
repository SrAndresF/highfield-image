import { NextRequest, NextResponse } from 'next/server';
import { resolveDirectMediaUrl } from '@/lib/media-utils';

export const dynamic = 'force-dynamic';

/**
 * Proxy de medios público de alta compatibilidad.
 * Resuelve el problema donde los servidores GPU de Higgsfield (que usan Python requests / urllib)
 * sufren bloqueos de firewall (ConnectionReset / 403) o reciben páginas HTML al descargar desde
 * servicios temporales como tmpfiles.org o Catbox.
 * Este proxy resuelve los enlaces de descarga directos y retransmite el flujo binario con un
 * User-Agent de navegador legítimo, soporte de Range y encabezados MIME precisos.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const rawTargetUrl = searchParams.get('url');

  if (!rawTargetUrl) {
    return NextResponse.json(
      { error: 'Parámetro "url" faltante en la petición.' },
      { status: 400 }
    );
  }

  try {
    const targetUrl = await resolveDirectMediaUrl(rawTargetUrl);
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Solo se admiten URLs con protocolo HTTP o HTTPS.' },
        { status: 400 }
      );
    }

    const forwardHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      forwardHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers: forwardHeaders,
      cache: 'no-store',
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return NextResponse.json(
        { error: `El servidor de origen respondió con estado ${upstreamRes.status}` },
        { status: upstreamRes.status }
      );
    }

    const responseHeaders = new Headers();

    let contentType = upstreamRes.headers.get('content-type');
    if (
      !contentType ||
      contentType === 'application/octet-stream' ||
      contentType.includes('text/plain') ||
      contentType.includes('SIMH') ||
      contentType.includes('html') ||
      !contentType.includes('/')
    ) {
      const lower = targetUrl.toLowerCase();
      if (lower.endsWith('.mp4')) contentType = 'video/mp4';
      else if (lower.endsWith('.webm')) contentType = 'video/webm';
      else if (lower.endsWith('.mov')) contentType = 'video/quicktime';
      else if (lower.endsWith('.png')) contentType = 'image/png';
      else if (lower.endsWith('.webp')) contentType = 'image/webp';
      else contentType = 'image/jpeg';
    }

    responseHeaders.set('Content-Type', contentType);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Error al retransmitir el medio: ${error instanceof Error ? error.message : 'Error desconocido'}`,
      },
      { status: 502 }
    );
  }
}
