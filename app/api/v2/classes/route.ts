import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { isForbidden, isUnauthorized, requireRole } from '@/lib/auth'
import { makeId, nowIso } from '@/lib/sqlite'
import { getDatabase } from '@/lib/cloudflare'

export async function GET() {
  try {
    const user = await requireRole('teacher', 'admin')
    const db = await getDatabase()
    const classes = user.role === 'admin'
      ? (await db.prepare(`
          SELECT classes.*, COUNT(class_memberships.user_id) AS member_count
          FROM classes LEFT JOIN class_memberships ON class_memberships.class_id = classes.id
          GROUP BY classes.id ORDER BY classes.created_at DESC
        `).all()).results
      : (await db.prepare(`
          SELECT classes.*, COUNT(class_memberships.user_id) AS member_count
          FROM classes LEFT JOIN class_memberships ON class_memberships.class_id = classes.id
          WHERE classes.owner_id = ? GROUP BY classes.id ORDER BY classes.created_at DESC
        `).bind(user.id).all()).results
    return NextResponse.json({ classes })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    if (isForbidden(error)) return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })
    return NextResponse.json({ error: 'Classes could not be loaded.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('teacher', 'admin')
    const body = await request.json() as { name?: string }
    const name = body.name?.trim().slice(0, 80) || ''
    if (name.length < 2) return NextResponse.json({ error: 'Give the class a name.' }, { status: 400 })
    const timestamp = nowIso()
    const classroom = {
      id: makeId('class'),
      name,
      joinCode: randomBytes(4).toString('base64url').toLowerCase().replace(/[_-]/g, '').slice(0, 7),
      ownerId: user.id,
      createdAt: timestamp,
    }
    await (await getDatabase()).prepare(`
      INSERT INTO classes (id, name, join_code, owner_id, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).bind(classroom.id, classroom.name, classroom.joinCode, classroom.ownerId, timestamp, timestamp).run()
    return NextResponse.json({ classroom }, { status: 201 })
  } catch (error) {
    if (isUnauthorized(error)) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    if (isForbidden(error)) return NextResponse.json({ error: 'Teacher access required.' }, { status: 403 })
    return NextResponse.json({ error: 'Class could not be created.' }, { status: 500 })
  }
}
