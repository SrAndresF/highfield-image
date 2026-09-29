import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isTeamPasswordRequired,
  TEAM_ACCESS_COOKIE_NAME,
  verifyPasswordAttempt,
  verifySignedToken,
} from '@/lib/team-auth';
import { checkRateLimit } from '@/lib/rate-limit';

const accessBodySchema = z.object({
  password: z.string().min(1, 'Debes ingresar la contraseña del equipo.'),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const required = isTeamPasswordRequired();
  if (!required) {
    return NextResponse.json({
      required: false,
      authenticated: true,
    });
  }

  const token = req.cookies.get(TEAM_ACCESS_COOKIE_NAME)?.value;
  const authenticated = verifySignedToken(token);

  return NextResponse.json({
    required: true,
    authenticated,
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitRes = checkRateLimit(req, {
    bucket: 'auth_access',
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (rateLimitRes) return rateLimitRes;

  if (!isTeamPasswordRequired()) {
    return NextResponse.json({
      authenticated: true,
      message: 'La aplicación no requiere contraseña de equipo.',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Cuerpo JSON inválido en la solicitud.' },
      { status: 400 }
    );
  }

  const parsed = accessBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          'Ingresa una contraseña válida.',
      },
      { status: 400 }
    );
  }

  const verification = verifyPasswordAttempt(parsed.data.password);
  if (!verification.valid || !verification.signedToken) {
    return NextResponse.json(
      {
        error: 'Contraseña de acceso incorrecta. Verifica con el administrador del equipo.',
        code: 'INVALID_TEAM_PASSWORD',
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    authenticated: true,
    message: 'Acceso concedido al equipo.',
  });

  response.cookies.set({
    name: TEAM_ACCESS_COOKIE_NAME,
    value: verification.signedToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });

  return response;
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({
    authenticated: false,
    message: 'Sesión de equipo cerrada en este navegador.',
  });

  response.cookies.set({
    name: TEAM_ACCESS_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return response;
}
