import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// nginx strips /vibe-coder prefix before proxying, so paths here are root-relative
function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, request.url))
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET
  })

  const path = request.nextUrl.pathname

  // Publieke paden
  if (path.startsWith('/login') || path.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // /register: alleen voor admins
  if (path.startsWith('/register')) {
    if (!token || token.role !== 'ADMIN') {
      return redirectTo('/login', request)
    }
    return NextResponse.next()
  }

  // Not authenticated - redirect to login
  if (!token) {
    return redirectTo('/login', request)
  }

  // First login - must go to setup
  if (token.firstLogin && path !== '/first-time-setup') {
    return redirectTo('/first-time-setup', request)
  }

  // Not first login - can't access setup
  if (!token.firstLogin && path === '/first-time-setup') {
    return redirectTo('/', request)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|h20-logo.png).*)',
  ],
}
