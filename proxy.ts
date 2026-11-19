import { NextResponse, type NextRequest } from 'next/server';
import { requireHost } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/auth/login is public
  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  const session = await requireHost(request);
  if (!session) {
    if (pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
