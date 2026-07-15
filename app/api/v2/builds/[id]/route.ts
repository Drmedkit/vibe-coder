import { NextRequest, NextResponse } from 'next/server'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { getBuildJob, getOwnedProject } from '@/lib/v2/repository'
import { getDeploymentById } from '@/lib/v2/repository'
import { projectUrls } from '@/lib/v2/http'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser()
    const { id } = await params
    const build = await getBuildJob(id)
    if (!build || !(await getOwnedProject(build.projectId, user.id))) {
      return NextResponse.json({ error: 'Build not found.' }, { status: 404 })
    }
    const deployment = build.deploymentId ? await getDeploymentById(build.deploymentId) : null
    return NextResponse.json({
      build,
      deployment,
      urls: projectUrls({ publicToken: deployment?.publicToken }),
    })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'Could not load build.' }, { status: 500 })
  }
}
