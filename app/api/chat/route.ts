import { NextRequest, NextResponse } from 'next/server'
import { generateCodeResponse } from '@/lib/groq'
import { CodeState } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, code, history } = body as {
      message: string
      code: CodeState
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!message || !code) {
      return NextResponse.json(
        { error: 'Message and code context are required' },
        { status: 400 }
      )
    }

    const response = await generateCodeResponse(message, code, history)

    return NextResponse.json({ response })
  } catch (error) {
    console.error('Chat API Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    )
  }
}
