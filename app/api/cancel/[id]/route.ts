import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTeamAccess } from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  cancelJobRequest,
  extractUserCredentials,
  handleHiggsfieldError,
} from '@/lib/higgsfield-server';

const requestIdSchema = z
  .string()
  .trim()
  .min(4, 'ID de trabajo inválido.')
  .max(128, 'ID de trabajo demasiado largo.')
  .regex(/^[A-Za-z0-9_-]+$/, 'Formato de ID de trabajo no permitido.');

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const teamAuthError = requireTeamAccess(req);
  if (teamAuthError) return teamAuthError;

  const rateLimitError = checkRateLimit(req, {
    bucket: 'api_cancel',
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const credsResult = extractUserCredentials(req);
  if (!credsResult.ok) {
    return credsResult.response;
  }

  const resolvedParams = await context.params;
  const parsedId = requestIdSchema.safeParse(resolvedParams.id);
  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: parsedId.error.issues[0]?.message ?? 'ID de trabajo inválido.',
        code: 'INVALID_JOB_ID',
      },
      { status: 400 }
    );
  }

  try {
    const cancelResult = await cancelJobRequest(
      credsResult.credentials,
      parsedId.data
    );
    return NextResponse.json(cancelResult);
  } catch (error) {
    return handleHiggsfieldError(error, credsResult.credentials);
  }
}
