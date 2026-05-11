import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { normalizeBrief, phaseFromBriefAndCode } from '@/lib/projectFlow'
import { CodeState, ProjectPhase } from '@/lib/types'

const PROJECT_PHASES = new Set<ProjectPhase>(['empty', 'shaping', 'ready_for_first_build', 'built', 'polishing'])

function normalizePhase(value: unknown, code: CodeState, brief: unknown): ProjectPhase {
  if (typeof value === 'string' && PROJECT_PHASES.has(value as ProjectPhase)) {
    if ((code.html.trim() || code.css.trim() || code.javascript.trim()) &&
      (value === 'empty' || value === 'shaping' || value === 'ready_for_first_build')) {
      return 'built'
    }
    return value as ProjectPhase
  }
  return phaseFromBriefAndCode(normalizeBrief(brief), code, 'empty')
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

export async function GET() {
  try {
    const user = await requireUser()
    const projects = await prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        htmlCode: true,
        cssCode: true,
        jsCode: true,
        messages: true,
        phase: true,
        brief: true,
        majorBuildCount: true,
        firstBuildAcceptedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Get projects error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
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

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    }

    const code: CodeState = {
      html: typeof htmlCode === 'string' ? htmlCode : '',
      css: typeof cssCode === 'string' ? cssCode : '',
      javascript: typeof jsCode === 'string' ? jsCode : '',
    }
    const normalizedBrief = normalizeBrief(brief)
    const parsedFirstBuildDate = parseDate(firstBuildAcceptedAt)

    const project = await prisma.project.create({
      data: {
        ownerId: user.id,
        title: title.trim(),
        htmlCode: code.html,
        cssCode: code.css,
        jsCode: code.javascript,
        messages: messages || [],
        phase: normalizePhase(phase, code, normalizedBrief),
        brief: normalizedBrief as unknown as Prisma.InputJsonValue,
        majorBuildCount: typeof majorBuildCount === 'number' ? Math.max(0, Math.floor(majorBuildCount)) : 0,
        ...(parsedFirstBuildDate ? { firstBuildAcceptedAt: parsedFirstBuildDate } : {}),
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
