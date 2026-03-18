import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET - Get all projects
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        htmlCode: true,
        cssCode: true,
        jsCode: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Get projects error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}

// POST - Create new project
export async function POST(req: NextRequest) {
  try {
    const { title, htmlCode, cssCode, jsCode } = await req.json()

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        htmlCode: htmlCode || '',
        cssCode: cssCode || '',
        jsCode: jsCode || '',
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
