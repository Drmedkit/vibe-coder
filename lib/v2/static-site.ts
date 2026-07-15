import path from 'path'
import { getArtifactStore } from '@/lib/cloudflare'
import { DeploymentRecord } from '@/lib/v2/types'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function safeObjectName(requestedPath: string): string {
  const normalized = path.posix.normalize(`/${requestedPath}`).replace(/^\/+/, '')
  if (!normalized || normalized.startsWith('..') || normalized.includes('/../')) return 'index.html'
  return normalized
}

export async function serveDeploymentFile(
  deployment: DeploymentRecord,
  requestedPath: string,
  options: { indexed: boolean; baseHref?: string },
): Promise<Response> {
  const store = await getArtifactStore()
  const objectName = safeObjectName(requestedPath)
  let object = await store.get(`${deployment.artifactPath}/${objectName}`, 'arrayBuffer')
  let servedName = objectName
  if (!object) {
    servedName = 'index.html'
    object = await store.get(`${deployment.artifactPath}/index.html`, 'arrayBuffer')
  }
  if (!object) return new Response('Creation not found', { status: 404 })

  const extension = path.posix.extname(servedName).toLowerCase()
  const isHtml = extension === '.html'
  const safeBaseHref = options.baseHref && /^\/[a-zA-Z0-9_./-]*$/.test(options.baseHref)
    ? options.baseHref
    : '/'
  const body: BodyInit = isHtml
    ? new TextDecoder().decode(object).replace('<head>', `<head>\n    <base href="${safeBaseHref}" />`)
    : object
  const headers = new Headers({
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
    ].join('; '),
  })
  if (!options.indexed) headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  return new Response(body, { status: 200, headers })
}
