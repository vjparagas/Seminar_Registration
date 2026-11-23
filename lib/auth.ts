import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { NextResponse } from 'next/server';

export const COOKIE_NAME = 'host_session';

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || 'development-secret-key-must-be-at-least-32-chars-long';
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: JWTPayload = { role: 'host' }): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecretKey());
}

export async function verifySession(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    return payload;
  } catch {
    return null;
  }
}

export function extractSessionToken(request: Request): string | null {
  if ('cookies' in request && typeof (request as any).cookies?.get === 'function') {
    const nextReq = request as any;
    const cookie = nextReq.cookies.get(COOKIE_NAME)?.value || nextReq.cookies.get('session')?.value;
    if (cookie) return cookie;
  }

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)(?:host_session|session)=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Returns null when the host is signed in, and a 401 Response otherwise.
 */
export async function requireHost(request: Request): Promise<NextResponse | null> {
  const token = extractSessionToken(request);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const session = await verifySession(token);
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
