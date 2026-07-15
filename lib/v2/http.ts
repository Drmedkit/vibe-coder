import { NextRequest } from 'next/server'
import { getActiveDeploymentBySlug, getDeploymentById, getDeploymentByToken, getProjectByDeployment } from '@/lib/v2/repository'

export function rootDomain(): string | null {
  const value = process.env.ROOT_DOMAIN?.trim()
  return value ? value.replace(/^https?:\/\//, '').replace(/\/$/, '') : null
}

export function projectUrls(input: { publicToken?: string | null; approvedSlug?: string | null }) {
  const domain = rootDomain()
  return {
    // Relative links survive workers.dev, preview deployments, and custom domains.
    unlistedUrl: input.publicToken ? `/p/${input.publicToken}/` : null,
    publicUrl: input.approvedSlug && domain ? `https://${input.approvedSlug}.${domain}/` : null,
  }
}

export async function resolveDeploymentFromRequest(request: NextRequest) {
  const headerToken = request.headers.get('x-vibe-deployment')?.trim()
  if (headerToken) return getDeploymentByToken(headerToken)

  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  const configuredDomain = rootDomain()
  const domain = configuredDomain?.split(':')[0].toLowerCase()
  if (domain && host.endsWith(`.${domain}`)) {
    const slug = host.slice(0, -(domain.length + 1)).split('.').at(-1)
    if (slug) return getActiveDeploymentBySlug(slug)
  }
  return null
}

export async function deploymentContext(request: NextRequest) {
  const deployment = await resolveDeploymentFromRequest(request)
  if (!deployment) return null
  const project = await getProjectByDeployment(deployment.id)
  if (!project) return null
  return { deployment, project }
}

export async function deploymentForProject(project: { latestDeploymentId: string | null }) {
  return project.latestDeploymentId ? getDeploymentById(project.latestDeploymentId) : null
}
