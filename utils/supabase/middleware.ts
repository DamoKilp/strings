// utils/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';

/**
 * Update the Supabase auth session in Next.js Middleware.
 * Ensures cookies are properly refreshed and returned to the browser.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const urlWithCode = new URL(request.url);
  const hasAuthCode = urlWithCode.searchParams.has('code');
  const hasRecoveryToken = urlWithCode.searchParams.has('token') && urlWithCode.searchParams.get('type') === 'recovery';
  const isAlreadyCallback = urlWithCode.pathname === '/auth/callback';
  if ((hasAuthCode || hasRecoveryToken) && !isAlreadyCallback) {
    const callbackUrl = new URL('/auth/callback', urlWithCode.origin);
    urlWithCode.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    if (!callbackUrl.searchParams.has('redirect_to')) {
      const originalPathAndQuery = urlWithCode.pathname + (urlWithCode.search || '');
      callbackUrl.searchParams.set('redirect_to', originalPathAndQuery);
    }
    return NextResponse.redirect(callbackUrl);
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        async setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      }
    }
  );
  const { data: { user: finalUser } } = await supabase.auth.getUser();
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.')) {
    return response;
  }

  const protectedRoutes = ['/', '/dashboard', '/settings'];
  const authRoutes = ['/sign-in', '/sign-up'];
  const publicRoutes = ['/auth/callback', '/api'];

  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  );
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));
  const isSignInRoute = pathname.startsWith('/sign-in');
  const isLogoutFlow = isSignInRoute && url.searchParams.has('logout');

  if (isPublicRoute) {
    return response;
  }

  if (!finalUser && isProtectedRoute) {
    const redirectUrl = new URL('/sign-in', request.url);
    redirectUrl.searchParams.set('redirect_to', pathname + url.search);
    redirectUrl.searchParams.set('message', 'Authentication required');
    return NextResponse.redirect(redirectUrl);
  }

  if (finalUser && isAuthRoute && !isLogoutFlow) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}


