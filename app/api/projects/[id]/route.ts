import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get single project
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// PUT - Update project
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { title, htmlCode, cssCode, jsCode } = await req.json()

    const existingProject = await prisma.project.findUnique({
      where: { id },
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
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
    console.error('Update project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// DELETE - Delete project
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await prisma.project.findUnique({
      where: { id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    await prisma.project.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
