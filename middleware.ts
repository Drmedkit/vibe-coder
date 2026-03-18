import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Public paths that don't require the access cookie
const PUBLIC_PATHS = ['/enter', '/api/auth/enter', '/api/auth/leave', '/api/images/']

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some(p => path.startsWith(p)) ||
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    path === '/h20-logo.png'
  ) {
    return NextResponse.next()
  }

  // Check for the access cookie
  const vibeAccess = request.cookies.get('vibe_access')

  if (!vibeAccess || vibeAccess.value !== '1') {
    return NextResponse.redirect(new URL('/enter', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|h20-logo.png).*)',
  ],
}
