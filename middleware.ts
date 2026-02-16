import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Redirect to first-time setup if needed
    if (token?.firstLogin && path !== '/first-time-setup') {
      return NextResponse.redirect(new URL('/first-time-setup', req.url))
    }

    // Don't allow access to first-time setup if not first login
    if (!token?.firstLogin && path === '/first-time-setup') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
)

// Protect all routes except login and API routes
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|h20-logo.png|login).*)',
  ],
}
