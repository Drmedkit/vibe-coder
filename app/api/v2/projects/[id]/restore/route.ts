import { NextRequest, NextResponse } from 'next/server'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { createBuildJob, getCheckpoint, getOwnedProject } from '@/lib/v2/repository'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const project = await getOwnedProject(id, user.id)
    if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    const body = await request.json() as { checkpointId?: string }
    const checkpoint = body.checkpointId ? await getCheckpoint(body.checkpointId) : null
    if (!checkpoint || checkpoint.projectId !== project.id) {
      return NextResponse.json({ error: 'Checkpoint not found.' }, { status: 404 })
    }
    const build = await createBuildJob({
      projectId: project.id,
      ownerId: user.id,
      kind: 'restore',
      prompt: checkpoint.id,
    })
    return NextResponse.json({ build }, { status: 202 })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'Checkpoint could not be restored.' }, { status: 500 })
  }
}
