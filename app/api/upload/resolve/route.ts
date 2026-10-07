import { NextRequest, NextResponse } from 'next/server';
import { requireTeamAccess } from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { resolveDirectMediaUrl } from '@/lib/media-utils';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const teamAuthError = requireTeamAccess(req);
  if (teamAuthError) return teamAuthError;

  const rateLimitError = checkRateLimit(req, {
    bucket: 'api_upload_resolve',
    maxRequests: 60,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  try {
    const body = (await req.json().catch(() => ({}))) as { url?: string };
    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json(
        { error: 'Parámetro "url" requerido.' },
        { status: 400 }
      );
    }

    const resolvedUrl = await resolveDirectMediaUrl(body.url);
    return NextResponse.json({
      success: true,
      url: resolvedUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Error al resolver URL de medios',
      },
      { status: 500 }
    );
  }
}
