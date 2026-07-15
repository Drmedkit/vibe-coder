import { NextRequest } from 'next/server'
import { getDeploymentByToken } from '@/lib/v2/repository'
import { serveDeploymentFile } from '@/lib/v2/static-site'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string; path?: string[] }> },
) {
  const { token, path } = await params
  const deployment = await getDeploymentByToken(token)
  if (!deployment) return new Response('Creation not found', { status: 404 })
  return serveDeploymentFile(deployment, path?.join('/') || 'index.html', {
    indexed: false,
    baseHref: `/p/${token}/`,
  })
}
