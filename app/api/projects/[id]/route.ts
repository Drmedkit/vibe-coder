import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const MAX_TITLE_LEN = 200
const MAX_CODE_BYTES = 512 * 1024

// Prisma throws a known-request error with code P2025 when an update/delete
// targets a missing row. We check duck-typed to avoid pulling in the
// Prisma namespace just for a type guard.
function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2025'
  )
}

// GET - Get single project (full content)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const project = await prisma.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// PUT - Update project.
// Previously we ran findUnique + update as two separate queries, which (a)
// doubled the DB roundtrips per write and (b) left a race window where the
// row could be deleted between the check and the update. Now we dispatch a
// single UPDATE and translate the P2025 error into a 404.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { title, htmlCode, cssCode, jsCode } = (await req.json()) as {
      title?: string
      htmlCode?: string
      cssCode?: string
      jsCode?: string
    }

    if (title !== undefined && title.length > MAX_TITLE_LEN) {
      return NextResponse.json({ error: 'Titel te lang' }, { status: 400 })
    }
    for (const [name, value] of [
      ['htmlCode', htmlCode],
      ['cssCode', cssCode],
      ['jsCode', jsCode],
    ] as const) {
      if (value !== undefined && Buffer.byteLength(value) > MAX_CODE_BYTES) {
        return NextResponse.json({ error: `${name} is te groot` }, { status: 413 })
      }
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        ...(htmlCode !== undefined && { htmlCode }),
        ...(cssCode !== undefined && { cssCode }),
        ...(jsCode !== undefined && { jsCode }),
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// DELETE - Delete project (single query, idempotent on 404)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    await prisma.project.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isRecordNotFound(error)) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }
    console.error('Delete project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
