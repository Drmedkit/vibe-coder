import { NextRequest, NextResponse } from 'next/server'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { createProject, listProjectsForUser } from '@/lib/v2/repository'
import { deploymentForProject, projectUrls } from '@/lib/v2/http'
import { getCreditBalance } from '@/lib/v2/quotas'

export async function GET() {
  try {
    const user = await requireUser()
    const projectRows = await listProjectsForUser(user)
    const projects = await Promise.all(projectRows.map(async project => {
      const deployment = await deploymentForProject(project)
      return {
        ...project,
        deployment,
        ...projectUrls({ publicToken: deployment?.publicToken, approvedSlug: project.approvedSlug }),
      }
    }))
    return NextResponse.json({ projects, credits: await getCreditBalance(user.id), user })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'Projects could not be loaded.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json() as { title?: string }
    const project = await createProject({
      ownerId: user.id,
      classId: user.classId,
      title: body.title || 'Untitled creation',
    })
    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'Project could not be created.' }, { status: 500 })
  }
}
