/**
 * Utilidades para resolución y compatibilidad de medios (imágenes y videos)
 * para los motores de IA de Higgsfield y los navegadores.
 */

/**
 * Resuelve URLs de almacenamiento temporal (como tmpfiles.org)
 * a su enlace de descarga directo y binario sin páginas intermedias de HTML.
 * Crucial para que los trabajadores de IA (Python) y los reproductores de video
 * descarguen el archivo multimedia real en lugar del HTML del sitio.
 */
export async function resolveDirectMediaUrl(url: string): Promise<string> {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();

  // Si es tmpfiles.org y aún no tiene el token de descarga directa con hash
  if (trimmed.includes('tmpfiles.org') && !trimmed.match(/\/dl\/\d+\.[a-f0-9]+\//i)) {
    try {
      const dlPage = trimmed
        .replace('tmpfiles.org/dl/', 'tmpfiles.org/')
        .replace('tmpfiles.org/', 'tmpfiles.org/dl/');

      const res = await fetch(dlPage, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const html = await res.text();
        const match = html.match(/href=["'](https:\/\/tmpfiles\.org\/dl\/[^"']+)["']/i);
        if (match?.[1]) {
          return match[1];
        }
      }
    } catch {
      // Si falla la llamada HTTP a la página de descarga, retornar la URL original
    }
  }

  return trimmed;
}

/**
 * Recorre recursivamente un objeto o array de parámetros y resuelve
 * cualquier URL multimedia para que apunte directamente al archivo binario.
 */
export async function resolvePayloadMediaUrls(
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const processVal = async (val: unknown): Promise<unknown> => {
    if (typeof val === 'string') {
      return await resolveDirectMediaUrl(val);
    }
    if (Array.isArray(val)) {
      return Promise.all(val.map((item) => processVal(item)));
    }
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = await processVal(v);
      }
      return out;
    }
    return val;
  };

  return (await processVal(data)) as Record<string, unknown>;
}
