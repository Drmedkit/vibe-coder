import { cookies } from 'next/headers'
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { prisma } from '@/lib/prisma'

const scrypt = promisify(scryptCallback)

export const SESSION_COOKIE = 'vibe_session'
export const CLASS_CODE = 'h20'

const SESSION_DAYS = 7
const SESSION_MAX_AGE = 60 * 60 * 24 * SESSION_DAYS

export interface AuthUser {
  id: string
  username: string
}

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9_-]{3,24}$/.test(username)
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6 && password.length <= 128
}

export function isValidClassCode(code: string): boolean {
  return code.trim().toLowerCase() === CLASS_CODE
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
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000)

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  })

  return token
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, username: true } } },
  })

  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { tokenHash } }).catch(() => undefined)
    return null
  }

  return session.user
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

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return

  await prisma.session
    .delete({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => undefined)
}
