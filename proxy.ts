import { NextResponse, type NextRequest } from 'next/server';
import { requireHost } from '@/lib/auth';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/auth/login is public
  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  const denied = await requireHost(request);
  if (denied) {
    if (pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return denied;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
