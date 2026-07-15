import { NextRequest, NextResponse } from 'next/server'
import { isUnauthorized, requireUser } from '@/lib/auth'
import {
  canManageProject,
  deleteProject,
  getCapabilities,
  getProject,
  getProjectFiles,
  listCheckpoints,
  updateProject,
} from '@/lib/v2/repository'
import { deploymentForProject, projectUrls } from '@/lib/v2/http'

async function loadForUser(id: string) {
  const user = await requireUser()
  const project = await getProject(id)
  if (!project || !(await canManageProject(id, user))) return { user, project: null }
  return { user, project }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { user, project } = await loadForUser(id)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    const deployment = await deploymentForProject(project)
    return NextResponse.json({
      project,
      files: await getProjectFiles(id),
      capabilities: await getCapabilities(id),
      checkpoints: await listCheckpoints(id),
      deployment,
      urls: projectUrls({ publicToken: deployment?.publicToken, approvedSlug: project.approvedSlug }),
      permissions: { canApprove: user.role === 'teacher' || user.role === 'admin' },
    })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'Project could not be loaded.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { project } = await loadForUser(id)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    const body = await request.json() as { title?: string; summary?: string }
    return NextResponse.json({ project: await updateProject(id, body) })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'Project could not be updated.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { project } = await loadForUser(id)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    await deleteProject(id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'Project could not be deleted.' }, { status: 500 })
  }
}
