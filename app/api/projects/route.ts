import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MAX_TITLE_LEN = 200
const MAX_CODE_BYTES = 512 * 1024 // 512 KB per field
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 200

// GET - List projects (metadata only, paginated).
// Previously this returned every project's full html/css/js source on every
// page load. With ~13 concurrent users that becomes multi-megabyte responses
// per request, which ties up DB connections and saturates the Node event
// loop on JSON serialisation. Full project contents are fetched on demand
// via GET /api/projects/[id] when the user opens or forks a project.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const limitParam = Number(url.searchParams.get('limit'))
    const take = Math.min(
      Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT,
      MAX_LIMIT,
    )
    const cursor = url.searchParams.get('cursor')

    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const nextCursor = projects.length === take ? projects[projects.length - 1].id : null

    return NextResponse.json({ projects, nextCursor })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// POST - Create new project
export async function POST(req: NextRequest) {
  try {
    const { title, htmlCode, cssCode, jsCode } = (await req.json()) as {
      title?: string
      htmlCode?: string
      cssCode?: string
      jsCode?: string
    }

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    }
    if (title.length > MAX_TITLE_LEN) {
      return NextResponse.json({ error: 'Titel te lang' }, { status: 400 })
    }
    for (const [name, value] of [
      ['htmlCode', htmlCode],
      ['cssCode', cssCode],
      ['jsCode', jsCode],
    ] as const) {
      if (value && Buffer.byteLength(value) > MAX_CODE_BYTES) {
        return NextResponse.json({ error: `${name} is te groot` }, { status: 413 })
      }
    }

    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        htmlCode: htmlCode ?? '',
        cssCode: cssCode ?? '',
        jsCode: jsCode ?? '',
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
