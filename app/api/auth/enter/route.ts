import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()
    const classCode = process.env.CLASS_CODE || 'h20-vibe-2026'

    if (code !== classCode) {
      return NextResponse.json({ error: 'Verkeerde code' }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set('vibe_access', '1', {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      // 7 days
      maxAge: 60 * 60 * 24 * 7,
    })

    return response
  } catch (error) {
    console.error('Enter error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
