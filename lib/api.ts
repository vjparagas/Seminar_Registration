import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function ok<T extends Record<string, unknown>>(
  data?: T,
  status = 200
): NextResponse {
  return NextResponse.json(
    {
      ok: true,
      ...(data ?? {}),
    },
    { status }
  );
}

export function fail(
  error: string,
  status = 400,
  extra?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error,
      ...(extra ?? {}),
    },
    { status }
  );
}

export function failZod(error: ZodError): NextResponse {
  const message = error.issues[0]?.message ?? 'Validation error';
  return fail(message, 400);
}
