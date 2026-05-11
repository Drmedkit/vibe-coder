import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/enter',
  '/api/auth/enter',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/images/',
]

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  if (
    PUBLIC_PATHS.some(p => path.startsWith(p)) ||
    path.startsWith('/_next') ||
    path === '/favicon.ico' ||
    path === '/h20-logo.png' ||
    path === '/h20-logo-gitw.png' ||
    path === '/h20-pattern.png'
  ) {
    return NextResponse.next()
  }

  const session = request.cookies.get('vibe_session')

  if (!session?.value) {
    return NextResponse.redirect(new URL('/enter', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|h20-logo.png|h20-logo-gitw.png|h20-pattern.png).*)',
  ],
}
