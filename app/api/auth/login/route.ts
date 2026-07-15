import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE,
  createSession,
  createSessionCookieOptions,
  normalizeUsername,
  verifyPassword,
} from '@/lib/auth'
import { nowIso } from '@/lib/sqlite'
import { getDatabase } from '@/lib/cloudflare'
import { UserRole } from '@/lib/v2/types'
import { assertAuthRateLimit, isAuthRateLimit } from '@/lib/v2/auth-rate-limit'

export async function POST(req: NextRequest) {
  try {
    await assertAuthRateLimit(req, 'login', 20)
    const { username, password } = await req.json() as {
      username?: string
      password?: string
    }

    const normalizedUsername = normalizeUsername(username ?? '')
    if (!normalizedUsername || !password) {
      return NextResponse.json({ error: 'Vul je gebruikersnaam en wachtwoord in.' }, { status: 400 })
    }

    const db = await getDatabase()
    const user = await db.prepare(`
      SELECT id, username, password_hash, password_salt, role,
        (SELECT class_id FROM class_memberships WHERE user_id = users.id ORDER BY created_at LIMIT 1) AS class_id
      FROM users WHERE username = ?
    `).bind(normalizedUsername).first<{
      id: string
      username: string
      password_hash: string
      password_salt: string
      role: UserRole
      class_id: string | null
    }>()
    if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
      return NextResponse.json({ error: 'Gebruikersnaam of wachtwoord klopt niet.' }, { status: 401 })
    }

    await db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?')
      .bind(nowIso(), nowIso(), user.id).run()

    const token = await createSession(user.id)
    const response = NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role, classId: user.class_id },
    })
    response.cookies.set(SESSION_COOKIE, token, createSessionCookieOptions())
    return response
  } catch (error) {
    if (isAuthRateLimit(error)) {
      return NextResponse.json({ error: (error as Error).message }, { status: 429 })
    }
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Inloggen is mislukt.' }, { status: 500 })
  }
}
