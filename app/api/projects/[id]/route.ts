import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { normalizeBrief, phaseFromBriefAndCode } from '@/lib/projectFlow'
import { CodeState, ProjectPhase } from '@/lib/types'

const PROJECT_PHASES = new Set<ProjectPhase>(['empty', 'shaping', 'ready_for_first_build', 'built', 'polishing'])

function normalizePhase(value: unknown, code: CodeState, brief: unknown, fallback: ProjectPhase): ProjectPhase {
  if (typeof value === 'string' && PROJECT_PHASES.has(value as ProjectPhase)) {
    if ((code.html.trim() || code.css.trim() || code.javascript.trim()) &&
      (value === 'empty' || value === 'shaping' || value === 'ready_for_first_build')) {
      return 'built'
    }
    return value as ProjectPhase
  }
  return phaseFromBriefAndCode(normalizeBrief(brief), code, fallback)
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === null) return null
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id, ownerId: user.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Get project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const {
      title,
      htmlCode,
      cssCode,
      jsCode,
      messages,
      phase,
      brief,
      majorBuildCount,
      firstBuildAcceptedAt,
    } = await req.json()

    const existingProject = await prisma.project.findFirst({
      where: { id, ownerId: user.id },
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    const code: CodeState = {
      html: htmlCode !== undefined ? htmlCode : existingProject.htmlCode,
      css: cssCode !== undefined ? cssCode : existingProject.cssCode,
      javascript: jsCode !== undefined ? jsCode : existingProject.jsCode,
    }
    const normalizedBrief = brief !== undefined ? normalizeBrief(brief) : normalizeBrief(existingProject.brief)
    const parsedFirstBuildDate = parseDate(firstBuildAcceptedAt)

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(htmlCode !== undefined && { htmlCode }),
        ...(cssCode !== undefined && { cssCode }),
        ...(jsCode !== undefined && { jsCode }),
        ...(messages !== undefined && { messages }),
        ...(brief !== undefined && { brief: normalizedBrief as unknown as Prisma.InputJsonValue }),
        ...(phase !== undefined && { phase: normalizePhase(phase, code, normalizedBrief, existingProject.phase as ProjectPhase) }),
        ...(majorBuildCount !== undefined && {
          majorBuildCount: typeof majorBuildCount === 'number' ? Math.max(0, Math.floor(majorBuildCount)) : existingProject.majorBuildCount,
        }),
        ...(parsedFirstBuildDate !== undefined && { firstBuildAcceptedAt: parsedFirstBuildDate }),
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const project = await prisma.project.findFirst({
      where: { id, ownerId: user.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Delete project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
