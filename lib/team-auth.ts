import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const TEAM_ACCESS_COOKIE_NAME = 'hf_team_access';

function getConfiguredTeamPassword(): string | null {
  const raw = process.env.APP_ACCESS_PASSWORD;
  if (!raw || raw.trim().length === 0) {
    return null;
  }
  return raw.trim();
}

export function isTeamPasswordRequired(): boolean {
  return getConfiguredTeamPassword() !== null;
}

function createSignedToken(password: string): string {
  const payload = 'authorized_team_member_v1';
  const signature = createHmac('sha256', password)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

export function verifySignedToken(token: string | undefined): boolean {
  const password = getConfiguredTeamPassword();
  if (!password) {
    return true;
  }
  if (!token) {
    return false;
  }
  const expectedToken = createSignedToken(password);
  const tokenBuf = Buffer.from(token, 'utf8');
  const expectedBuf = Buffer.from(expectedToken, 'utf8');
  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export function verifyPasswordAttempt(candidatePassword: string): {
  valid: boolean;
  signedToken?: string;
} {
  const password = getConfiguredTeamPassword();
  if (!password) {
    return { valid: true };
  }
  const candidateBuf = Buffer.from(candidatePassword.trim(), 'utf8');
  const expectedBuf = Buffer.from(password, 'utf8');
  if (candidateBuf.length !== expectedBuf.length) {
    return { valid: false };
  }
  const isMatch = timingSafeEqual(candidateBuf, expectedBuf);
  if (!isMatch) {
    return { valid: false };
  }
  return {
    valid: true,
    signedToken: createSignedToken(password),
  };
}

export function requireTeamAccess(req: NextRequest): NextResponse | null {
  if (!isTeamPasswordRequired()) {
    return null;
  }
  const cookieToken = req.cookies.get(TEAM_ACCESS_COOKIE_NAME)?.value;
  if (!verifySignedToken(cookieToken)) {
    return NextResponse.json(
      {
        error:
          'Acceso de equipo requerido. Ingresa la contraseña del equipo para utilizar la aplicación.',
        code: 'TEAM_ACCESS_REQUIRED',
      },
      { status: 401 }
    );
  }
  return null;
}
