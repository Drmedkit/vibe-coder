import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionCookieOptions, destroyCurrentSession } from '@/lib/auth'

export async function POST() {
  await destroyCurrentSession()

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE, '', {
    ...createSessionCookieOptions(),
    maxAge: 0,
  })
  return response
}
