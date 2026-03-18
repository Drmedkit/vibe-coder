import { NextRequest, NextResponse } from 'next/server'
import { generateCodeResponse } from '@/lib/groq'
import { CodeState, ChatMode } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { message, code, history, mode } = await request.json() as {
      message: string
      code: CodeState
      history: Array<{ role: 'user' | 'assistant'; content: string }>
      mode?: ChatMode
    }

    if (!message || !code) {
      return NextResponse.json({ error: 'Message and code context are required' }, { status: 400 })
    }

    const result = await generateCodeResponse(message, code, history, mode ?? 'agent')

    return NextResponse.json(result)
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 })
  }
}
