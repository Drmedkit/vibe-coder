import { NextRequest, NextResponse } from 'next/server'
import { isValidClassCode } from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code || !isValidClassCode(code)) {
      return NextResponse.json({ error: 'Verkeerde code' }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Enter error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
