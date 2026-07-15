import { NextRequest, NextResponse } from 'next/server'
import { isUnauthorized, requireUser } from '@/lib/auth'
import {
  createBuildJob,
  createCheckpoint,
  getCapabilities,
  getOwnedProject,
} from '@/lib/v2/repository'
import { validateSourceFiles } from '@/lib/v2/compiler'
import { SourceFile } from '@/lib/v2/types'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await getOwnedProject(id, user.id)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    if (project.runtimeVersion !== 'preact-v1') {
      return NextResponse.json({ error: 'Legacy projects use the classic editor.' }, { status: 409 })
    }
    const body = await request.json() as { files?: SourceFile[] }
    const files = validateSourceFiles(Array.isArray(body.files) ? body.files : [])
    const checkpointId = await createCheckpoint({
      projectId: project.id,
      label: 'Manual code edit',
      prompt: 'Manual code edit',
      files,
      capabilities: await getCapabilities(project.id),
    })
    const build = await createBuildJob({
      projectId: project.id,
      ownerId: user.id,
      kind: 'restore',
      prompt: checkpointId,
    })
    return NextResponse.json({ build }, { status: 202 })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Files could not be saved.' }, { status: 400 })
  }
}
