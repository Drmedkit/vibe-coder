import { NextRequest, NextResponse } from 'next/server'
import { requireUser, isUnauthorized } from '@/lib/auth'
import { createBuildJob, createProject, getOwnedProject } from '@/lib/v2/repository'
import { assertCredits, CREDIT_POLICY, getCreditBalance, isLimitError } from '@/lib/v2/quotas'
import { moderateText } from '@/lib/v2/moderation'

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json() as { projectId?: string; prompt?: string }
    const prompt = body.prompt?.trim() || ''
    if (prompt.length < 8 || prompt.length > 4_000) {
      return NextResponse.json({ error: 'Describe the idea in 8-4,000 characters.' }, { status: 400 })
    }
    const moderation = moderateText(prompt)
    if (!moderation.allowed) {
      return NextResponse.json({ error: moderation.reason }, { status: 422 })
    }

    const existing = body.projectId ? await getOwnedProject(body.projectId, user.id) : null
    if (body.projectId && !existing) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
    const project = existing || await createProject({ ownerId: user.id, classId: user.classId })
    const kind = existing ? 'remix' as const : 'first_build' as const
    await assertCredits(user.id, kind === 'first_build' ? CREDIT_POLICY.firstBuild : CREDIT_POLICY.remix)
    const build = await createBuildJob({ projectId: project.id, ownerId: user.id, kind, prompt })
    return NextResponse.json({ project, build, credits: await getCreditBalance(user.id) }, { status: 202 })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    if (isLimitError(error)) return NextResponse.json({ error: (error as Error).message }, { status: 429 })
    console.error('Create build error:', error)
    return NextResponse.json({ error: 'The build could not be queued.' }, { status: 500 })
  }
}
