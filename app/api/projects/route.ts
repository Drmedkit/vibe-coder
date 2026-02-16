import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Get all projects for current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const projects = await prisma.project.findMany({
      where: { userId: session.user.id },
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
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const { title, htmlCode, cssCode, jsCode } = await req.json()

    // Check project limit (max 3)
    const projectCount = await prisma.project.count({
      where: { userId: session.user.id },
    })

    if (projectCount >= 3) {
      return NextResponse.json(
        { error: 'Je hebt al 3 projecten. Verwijder er eerst een.' },
        { status: 400 }
      )
    }

    // Validation
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })
    }

    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        htmlCode: htmlCode || '',
        cssCode: cssCode || '',
        jsCode: jsCode || '',
        userId: session.user.id,
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Create project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
