import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  createSession,
  createSessionCookieOptions,
  normalizeUsername,
  verifyPassword,
} from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json() as {
      username?: string
      password?: string
    }

    const normalizedUsername = normalizeUsername(username ?? '')
    if (!normalizedUsername || !password) {
      return NextResponse.json({ error: 'Vul je gebruikersnaam en wachtwoord in.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { username: normalizedUsername } })
    if (!user || !(await verifyPassword(password, user.passwordSalt, user.passwordHash))) {
      return NextResponse.json({ error: 'Gebruikersnaam of wachtwoord klopt niet.' }, { status: 401 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const token = await createSession(user.id)
    const response = NextResponse.json({
      user: { id: user.id, username: user.username },
    })
    response.cookies.set(SESSION_COOKIE, token, createSessionCookieOptions())
    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Inloggen is mislukt.' }, { status: 500 })
  }
}
