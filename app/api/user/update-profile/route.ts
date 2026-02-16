import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcrypt'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }

    const { displayName, newPassword } = await req.json()

    // Validation
    if (!displayName || !displayName.trim()) {
      return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    }

    if (!newPassword || newPassword.length < 4) {
      return NextResponse.json({ error: 'Wachtwoord moet minimaal 4 tekens zijn' }, { status: 400 })
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        displayName: displayName.trim(),
        passwordHash,
        firstLogin: false,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.displayName,
        firstLogin: updatedUser.firstLogin,
      },
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
