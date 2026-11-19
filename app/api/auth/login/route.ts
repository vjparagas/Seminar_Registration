import { ok, fail, failZod } from '@/lib/api';
import { loginSchema } from '@/lib/validate';
import { signSession, COOKIE_NAME } from '@/lib/auth';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail('Invalid JSON body', 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return failZod(parsed.error);
  }

  const hostPassword = process.env.HOST_PASSWORD;
  if (!hostPassword) {
    return fail('HOST_PASSWORD is not configured on the server', 500);
  }

  if (parsed.data.password !== hostPassword) {
    return fail('Invalid password', 401);
  }

  const token = await signSession({ role: 'host' });

  const response = ok({ message: 'Logged in successfully' });
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });

  return response;
}
