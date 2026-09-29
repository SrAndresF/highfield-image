import { NextRequest, NextResponse } from 'next/server';
import { requireTeamAccess } from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  extractUserCredentials,
  handleHiggsfieldError,
  verifyCredentialsAndCheckCredits,
} from '@/lib/higgsfield-server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const teamAuthError = requireTeamAccess(req);
  if (teamAuthError) return teamAuthError;

  const rateLimitError = checkRateLimit(req, {
    bucket: 'api_credits',
    maxRequests: 25,
    windowMs: 60_000,
  });
  if (rateLimitError) return rateLimitError;

  const credsResult = extractUserCredentials(req);
  if (!credsResult.ok) {
    return credsResult.response;
  }

  try {
    const status = await verifyCredentialsAndCheckCredits(credsResult.credentials);
    return NextResponse.json(status);
  } catch (error) {
    return handleHiggsfieldError(error, credsResult.credentials);
  }
}
