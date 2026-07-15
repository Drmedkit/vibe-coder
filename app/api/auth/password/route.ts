import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/cloudflare'
import { hashPassword, isUnauthorized, isValidPassword, requireUser, verifyPassword } from '@/lib/auth'
import { nowIso } from '@/lib/sqlite'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json() as { currentPassword?: string; newPassword?: string }
    if (!body.currentPassword || !body.newPassword || !isValidPassword(body.newPassword)) {
      return NextResponse.json({ error: 'Use a new password with at least 8 characters.' }, { status: 400 })
    }
    const db = await getDatabase()
    const row = await db.prepare('SELECT password_hash, password_salt FROM users WHERE id = ?')
      .bind(user.id).first<{ password_hash: string; password_salt: string }>()
    if (!row || !(await verifyPassword(body.currentPassword, row.password_salt, row.password_hash))) {
      return NextResponse.json({ error: 'The current password is not correct.' }, { status: 401 })
    }
    const next = await hashPassword(body.newPassword)
    await db.prepare('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?')
      .bind(next.hash, next.salt, nowIso(), user.id).run()
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    return NextResponse.json({ error: 'The password could not be changed.' }, { status: 500 })
  }
}
