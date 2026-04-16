import { NextRequest } from 'next/server'
import { streamCodeResponse } from '@/lib/groq'
import { CodeState, ChatMode } from '@/lib/types'

// Extend Vercel's serverless function timeout to 60s.
// Streaming responses bypass the wall-clock timeout entirely on Vercel,
// so long AI completions will no longer time out for users.
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const { message, code, history, mode } = await request.json() as {
    message: string
    code: CodeState
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    mode?: ChatMode
  }

  if (!message || !code) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Message and code context are required' })}\n\n`,
      { status: 400, headers: { 'Content-Type': 'text/event-stream' } }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const result = await streamCodeResponse(
          message,
          code,
          history ?? [],
          mode ?? 'agent',
          (delta) => send({ type: 'delta', content: delta })
        )
        send({ type: 'done', ...result })
      } catch (error) {
        console.error('Chat stream error:', error)
        send({ type: 'error', message: 'Failed to generate response' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
