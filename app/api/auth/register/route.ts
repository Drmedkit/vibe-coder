import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'

// Simple invite code - change this to something secret!
const VALID_INVITE_CODE = 'h20-vibe-2026'

export async function POST(req: NextRequest) {
  try {
    const { inviteCode, username, displayName, password } = await req.json()

    // Check invite code
    if (inviteCode !== VALID_INVITE_CODE) {
      return NextResponse.json(
        { error: 'Ongeldige invite code' },
        { status: 400 }
      )
    }

    // Validation
    if (!username || username.length < 3) {
      return NextResponse.json(
        { error: 'Gebruikersnaam moet minimaal 3 tekens zijn' },
        { status: 400 }
      )
    }

    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: 'Naam is verplicht' },
        { status: 400 }
      )
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { error: 'Wachtwoord moet minimaal 4 tekens zijn' },
        { status: 400 }
      )
    }

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Gebruikersnaam is al in gebruik' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        displayName: displayName.trim(),
        passwordHash,
        role: 'STUDENT',
        firstLogin: false, // Already set name and password during registration
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Server fout' },
      { status: 500 }
    )
  }
}
