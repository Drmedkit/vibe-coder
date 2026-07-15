import { NextRequest, NextResponse } from 'next/server'
import { isForbidden, isUnauthorized, requireRole } from '@/lib/auth'
import { approveProject, canManageProject, getProject, unpublishProject } from '@/lib/v2/repository'
import { projectUrls, rootDomain } from '@/lib/v2/http'

const RESERVED_SLUGS = new Set(['www', 'app', 'api', 'admin', 'teacher', 'preview', 'static', 'assets', 'help'])

function validSlug(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/.test(value) && !RESERVED_SLUGS.has(value)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('teacher', 'admin')
    const { id } = await params
    const project = await getProject(id)
    if (!project || !(await canManageProject(id, user))) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
    if (!project.latestDeploymentId) {
      return NextResponse.json({ error: 'Build the project before approving a domain.' }, { status: 409 })
    }
    if (!rootDomain()) {
      return NextResponse.json({ error: 'Connect ROOT_DOMAIN before approving named public domains.' }, { status: 409 })
    }
    const body = await request.json() as { slug?: string }
    const slug = body.slug?.trim().toLowerCase() || ''
    if (!validSlug(slug)) {
      return NextResponse.json({ error: 'Use 3-48 lowercase letters, numbers, or hyphens.' }, { status: 400 })
    }
    try {
      const updated = await approveProject(id, slug)
      return NextResponse.json({ project: updated, ...projectUrls({ approvedSlug: updated.approvedSlug }) })
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        return NextResponse.json({ error: 'That domain name is already in use.' }, { status: 409 })
      }
      throw error
    }
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    if (isForbidden(error)) return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })
    return NextResponse.json({ error: 'The domain could not be approved.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole('teacher', 'admin')
    const { id } = await params
    if (!(await getProject(id)) || !(await canManageProject(id, user))) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
    return NextResponse.json({ project: await unpublishProject(id) })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    if (isForbidden(error)) return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })
    return NextResponse.json({ error: 'The project could not be unpublished.' }, { status: 500 })
  }
}
