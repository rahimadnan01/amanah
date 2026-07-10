import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth-edge';

// Routes that don't require authentication
const publicRoutes = ['/login'];

// Routes that require authentication
const protectedRoutes = ['/dashboard'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));
  
  // Check if it's a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  
  // Get session token from cookie
  const sessionToken = request.cookies.get('admin_session')?.value;
  
  // If accessing protected route without session, redirect to login
  if (isProtectedRoute && !sessionToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // If accessing login page with valid session, redirect to dashboard
  if (isPublicRoute && sessionToken) {
    try {
      const payload = await verifyToken(sessionToken);
      if (payload) {
        const dashboardUrl = new URL('/dashboard', request.url);
        return NextResponse.redirect(dashboardUrl);
      }
    } catch (error) {
      // Invalid token, continue to login page
    }
  }
  
  // If accessing protected route with session, validate it
  if (isProtectedRoute && sessionToken) {
    try {
      const payload = await verifyToken(sessionToken);
      if (!payload) {
        const loginUrl = new URL('/login', request.url);
        return NextResponse.redirect(loginUrl);
      }
      
      // Check if token is expired (JWT exp check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        const loginUrl = new URL('/login', request.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('admin_session');
        return response;
      }
    } catch (error) {
      const loginUrl = new URL('/login', request.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('admin_session');
      return response;
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes are handled by their own middleware)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
