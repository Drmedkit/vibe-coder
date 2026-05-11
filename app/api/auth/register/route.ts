import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  createSession,
  createSessionCookieOptions,
  hashPassword,
  isValidClassCode,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { classCode, username, password } = await req.json() as {
      classCode?: string
      username?: string
      password?: string
    }

    if (!classCode || !isValidClassCode(classCode)) {
      return NextResponse.json({ error: 'De klascode klopt niet.' }, { status: 401 })
    }

    const normalizedUsername = normalizeUsername(username ?? '')
    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json({
        error: 'Gebruik 3-24 tekens: letters, cijfers, streepjes of underscores.',
      }, { status: 400 })
    }

    if (!password || !isValidPassword(password)) {
      return NextResponse.json({ error: 'Gebruik een wachtwoord van minimaal 6 tekens.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { username: normalizedUsername } })
    if (existing) {
      return NextResponse.json({ error: 'Deze gebruikersnaam bestaat al.' }, { status: 409 })
    }

    const { hash, salt } = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        passwordHash: hash,
        passwordSalt: salt,
        lastLoginAt: new Date(),
      },
      select: { id: true, username: true },
    })

    const token = await createSession(user.id)
    const response = NextResponse.json({ user })
    response.cookies.set(SESSION_COOKIE, token, createSessionCookieOptions())
    return response
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Registreren is mislukt.' }, { status: 500 })
  }
}
