import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/cloudflare'

const WINDOW_MS = 15 * 60_000

export async function assertAuthRateLimit(
  request: NextRequest,
  action: 'login' | 'register',
  limit: number,
): Promise<void> {
  const address = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
  const window = Math.floor(Date.now() / WINDOW_MS)
  const key = createHash('sha256')
    .update(`${process.env.RATE_LIMIT_SALT || 'vibe-auth'}:${action}:${address}:${window}`)
    .digest('hex')
  const expiresAt = new Date((window + 1) * WINDOW_MS).toISOString()
  const db = await getDatabase()
  await db.prepare(`
    INSERT INTO auth_rate_limits (bucket_key, attempts, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(bucket_key) DO UPDATE SET attempts = attempts + 1
  `).bind(key, expiresAt).run()
  const row = await db.prepare('SELECT attempts FROM auth_rate_limits WHERE bucket_key = ?')
    .bind(key).first<{ attempts: number }>()
  if (Math.random() < 0.02) {
    await db.prepare('DELETE FROM auth_rate_limits WHERE expires_at < ?').bind(new Date().toISOString()).run()
  }
  if (Number(row?.attempts || 0) > limit) {
    const error = new Error('Too many attempts. Wait a few minutes and try again.')
    error.name = 'AuthRateLimitError'
    throw error
  }
}

export function isAuthRateLimit(error: unknown): boolean {
  return error instanceof Error && error.name === 'AuthRateLimitError'
}
