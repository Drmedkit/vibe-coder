import { cookies } from 'next/headers'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { makeId, nowIso } from '@/lib/sqlite'
import { getDatabase } from '@/lib/cloudflare'
import { UserRole } from '@/lib/v2/types'

const scrypt = promisify(scryptCallback)

export const SESSION_COOKIE = 'vibe_session'
const SESSION_DAYS = 7
const SESSION_MAX_AGE = 60 * 60 * 24 * SESSION_DAYS

export interface AuthUser {
  id: string
  username: string
  role: UserRole
  classId: string | null
}

interface UserRow {
  id: string
  username: string
  role: UserRole
  class_id: string | null
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]{3,24}$/.test(username)
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 128
}

export async function isValidClassCode(code: string): Promise<boolean> {
  const found = await (await getDatabase())
    .prepare('SELECT 1 AS ok FROM classes WHERE join_code = ? AND is_active = 1')
    .bind(code.trim().toLowerCase()).first()
  return Boolean(found)
}

export async function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return {
    salt,
    hash: derived.toString('hex'),
  }
}

export async function verifyPassword(password: string, salt: string, expectedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt)
  const actual = Buffer.from(hash, 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashSessionToken(token)
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString()

  await (await getDatabase()).prepare(`
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(makeId('session'), userId, tokenHash, createdAt, expiresAt).run()

  return token
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const db = await getDatabase()
  const session = await db.prepare(`
    SELECT users.id, users.username, users.role,
      (SELECT class_id FROM class_memberships WHERE user_id = users.id ORDER BY created_at LIMIT 1) AS class_id,
      sessions.expires_at
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).bind(tokenHash).first<UserRow & { expires_at: string }>()

  if (!session) return null

  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    return null
  }

  return {
    id: session.id,
    username: session.username,
    role: session.role,
    classId: session.class_id,
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    const error = new Error('Unauthorized')
    error.name = 'UnauthorizedError'
    throw error
  }
  return user
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.name === 'UnauthorizedError'
}

export async function requireRole(...roles: UserRole[]): Promise<AuthUser> {
  const user = await requireUser()
  if (!roles.includes(user.role)) {
    const error = new Error('Forbidden')
    error.name = 'ForbiddenError'
    throw error
  }
  return user
}

export function isForbidden(error: unknown): boolean {
  return error instanceof Error && error.name === 'ForbiddenError'
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return

  await (await getDatabase()).prepare('DELETE FROM sessions WHERE token_hash = ?')
    .bind(hashSessionToken(token)).run()
}
