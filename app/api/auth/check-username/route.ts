import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json()

    if (!username?.trim()) {
      return NextResponse.json({ error: 'Gebruikersnaam is verplicht' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
      select: { firstLogin: true },
    })

    if (!user) {
      return NextResponse.json({ exists: false, firstLogin: false })
    }

    return NextResponse.json({ exists: true, firstLogin: user.firstLogin })
  } catch (error) {
    console.error('Check username error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
