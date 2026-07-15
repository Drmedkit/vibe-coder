import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/enter',
  '/p/',
  '/api/runtime/',
  '/runtime/',
  '/api/v2/public/',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/images/',
]

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  const rootDomain = (process.env.ROOT_DOMAIN || '').replace(/^https?:\/\//, '').split(':')[0].toLowerCase()

  // Generated products run inside an opaque-origin iframe sandbox. Only their
  // deliberately small runtime API is available across that boundary.
  if (path.startsWith('/api/runtime/')) {
    const origin = request.headers.get('origin')
    const response = request.method === 'OPTIONS'
      ? new NextResponse(null, { status: 204 })
      : NextResponse.next()
    if (origin === 'null') {
      response.headers.set('Access-Control-Allow-Origin', 'null')
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Vibe-Deployment')
      response.headers.set('Access-Control-Max-Age', '86400')
      response.headers.set('Vary', 'Origin')
    }
    return response
  }

  if (
    rootDomain &&
    host.endsWith(`.${rootDomain}`) &&
    !path.startsWith('/_next/')
  ) {
    const slug = host.slice(0, -(rootDomain.length + 1)).split('.').at(-1)
    if (slug && !['www', 'app', 'api'].includes(slug)) {
      const url = request.nextUrl.clone()
      url.pathname = '/api/v2/public/site'
      url.searchParams.set('slug', slug)
      url.searchParams.set('path', path.replace(/^\/+/, '') || 'index.html')
      return NextResponse.rewrite(url)
    }
  }

  if (
    PUBLIC_PATHS.some(publicPath => path.startsWith(publicPath)) ||
    path.startsWith('/_next') ||
    path === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  if (!request.cookies.get('vibe_session')?.value) {
    return NextResponse.redirect(new URL('/enter', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  runtime: 'experimental-edge',
}
