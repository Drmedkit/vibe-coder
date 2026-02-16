import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  const path = request.nextUrl.pathname

  // Public paths that don't need auth
  if (path.startsWith('/login') || path.startsWith('/register') || path.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // Not authenticated - redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // First login - must go to setup
  if (token.firstLogin && path !== '/first-time-setup') {
    return NextResponse.redirect(new URL('/first-time-setup', request.url))
  }

  // Not first login - can't access setup
  if (!token.firstLogin && path === '/first-time-setup') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|h20-logo.png).*)',
  ],
}
