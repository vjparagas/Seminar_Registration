import { ok, fail } from '@/lib/api';
import { requireHost, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  const host = await requireHost(request);
  if (!host) {
    return fail('Unauthorized', 401);
  }

  const response = ok({ message: 'Logged out successfully' });
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
