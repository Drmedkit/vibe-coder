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
import { makeId, nowIso } from '@/lib/sqlite'
import { getDatabase } from '@/lib/cloudflare'
import { assertAuthRateLimit, isAuthRateLimit } from '@/lib/v2/auth-rate-limit'

export async function POST(req: NextRequest) {
  try {
    await assertAuthRateLimit(req, 'register', 10)
    const { classCode, username, password } = await req.json() as {
      classCode?: string
      username?: string
      password?: string
    }

    if (!classCode || !(await isValidClassCode(classCode))) {
      return NextResponse.json({ error: 'De klascode klopt niet.' }, { status: 401 })
    }

    const normalizedUsername = normalizeUsername(username ?? '')
    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json({
        error: 'Gebruik 3-24 tekens: letters, cijfers, streepjes of underscores.',
      }, { status: 400 })
    }

    if (!password || !isValidPassword(password)) {
      return NextResponse.json({ error: 'Use a password with at least 8 characters.' }, { status: 400 })
    }

    const normalizedCode = classCode.trim().toLowerCase()
    const db = await getDatabase()
    const classroom = await db.prepare('SELECT id FROM classes WHERE join_code = ? AND is_active = 1')
      .bind(normalizedCode).first<{ id: string }>()
    if (!classroom) {
      return NextResponse.json({ error: 'That class code is not active.' }, { status: 401 })
    }

    const existing = await db.prepare('SELECT id FROM users WHERE username = ?').bind(normalizedUsername).first()
    if (existing) {
      return NextResponse.json({ error: 'Deze gebruikersnaam bestaat al.' }, { status: 409 })
    }

    const { hash, salt } = await hashPassword(password)
    const createdAt = nowIso()
    const user = { id: makeId('user'), username: normalizedUsername, role: 'student' as const }
    await db.batch([
      db.prepare(`
        INSERT INTO users (id, username, password_hash, password_salt, role, created_at, updated_at, last_login_at)
        VALUES (?, ?, ?, ?, 'student', ?, ?, ?)
      `).bind(user.id, user.username, hash, salt, createdAt, createdAt, createdAt),
      db.prepare(`
        INSERT INTO class_memberships (class_id, user_id, created_at) VALUES (?, ?, ?)
      `).bind(classroom.id, user.id, createdAt),
    ])

    const token = await createSession(user.id)
    const response = NextResponse.json({ user: { ...user, classId: classroom.id } })
    response.cookies.set(SESSION_COOKIE, token, createSessionCookieOptions())
    return response
  } catch (error) {
    if (isAuthRateLimit(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 429 })
    }
    console.error('Register error:', error)
    return NextResponse.json({ error: 'Registreren is mislukt.' }, { status: 500 })
  }
}
