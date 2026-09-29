import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  timestamps: number[];
}

const ipStore = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanupExpired(windowMs: number): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of ipStore.entries()) {
    const filtered = entry.timestamps.filter((t) => t > cutoff);
    if (filtered.length === 0) {
      ipStore.delete(key);
    } else {
      entry.timestamps = filtered;
    }
  }
}

export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return '127.0.0.1';
}

export interface RateLimitOptions {
  bucket: string;
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  cleanupExpired(options.windowMs);

  const ip = getClientIp(req);
  const storeKey = `${options.bucket}:${ip}`;
  const now = Date.now();
  const cutoff = now - options.windowMs;

  const current = ipStore.get(storeKey) ?? { timestamps: [] };
  const recentTimestamps = current.timestamps.filter((t) => t > cutoff);

  if (recentTimestamps.length >= options.maxRequests) {
    const oldest = recentTimestamps[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + options.windowMs - now) / 1000)
    );

    return NextResponse.json(
      {
        error: `Demasiadas peticiones desde tu dirección IP. Por favor espera ${retryAfterSeconds} segundos antes de volver a intentarlo.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  recentTimestamps.push(now);
  ipStore.set(storeKey, { timestamps: recentTimestamps });
  return null;
}
