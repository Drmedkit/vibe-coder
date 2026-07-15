import { NextRequest } from 'next/server'
import { getActiveDeploymentBySlug } from '@/lib/v2/repository'
import { serveDeploymentFile } from '@/lib/v2/static-site'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug') || ''
  const requestedPath = request.nextUrl.searchParams.get('path') || 'index.html'
  const deployment = await getActiveDeploymentBySlug(slug)
  if (!deployment) return new Response('Creation not found', { status: 404 })
  return serveDeploymentFile(deployment, requestedPath, { indexed: true, baseHref: '/' })
}
