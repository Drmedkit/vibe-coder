import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

// GET - Get single project
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: {
        id: params.id,
        userId: session.user.id, // Only owner can access
      },
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const { title, htmlCode, cssCode, jsCode, saveVersion } = await req.json()

    // Check if project exists and belongs to user
    const existingProject = await prisma.project.findUnique({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!existingProject) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    // If saveVersion is true, create a version backup
    if (saveVersion) {
      await prisma.projectVersion.create({
        data: {
          projectId: params.id,
          htmlCode: existingProject.htmlCode,
          cssCode: existingProject.cssCode,
          jsCode: existingProject.jsCode,
        },
      })
    }

    // Update project
    const project = await prisma.project.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    // Check if project exists and belongs to user
    const project = await prisma.project.findUnique({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project niet gevonden' }, { status: 404 })
    }

    // Delete project (versions will be deleted automatically due to cascade)
    await prisma.project.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete project error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
