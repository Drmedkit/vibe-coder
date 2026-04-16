import { NextRequest } from 'next/server'
import { streamCodeResponse } from '@/lib/groq'
import { CodeState, ChatMode } from '@/lib/types'
import { clientKey, rateLimit, retryAfterSeconds } from '@/lib/rateLimit'

// Extend Vercel's serverless function timeout to 60s.
// Streaming responses bypass the wall-clock timeout entirely on Vercel,
// so long AI completions will no longer time out for users.
export const maxDuration = 60

// Chat requests hit a paid upstream (OpenRouter) and can tie up a worker for
// tens of seconds each. Throttle per IP to stop runaway clients.
const CHAT_RATE_LIMIT = 30
const CHAT_RATE_WINDOW_MS = 60_000

function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(clientKey(request, 'chat'), CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS)
  if (!limit.ok) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Te veel verzoeken. Wacht even.' })}\n\n`,
      {
        status: 429,
        headers: { ...sseHeaders(), 'Retry-After': String(retryAfterSeconds(limit)) },
      },
    )
  }

  const { message, code, history, mode } = (await request.json()) as {
    message: string
    code: CodeState
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    mode?: ChatMode
  }

  if (!message || !code) {
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: 'Message and code context are required' })}\n\n`,
      { status: 400, headers: sseHeaders() },
    )
  }

  const encoder = new TextEncoder()
  const abortController = new AbortController()

  // Propagate client disconnect to the upstream LLM call so we don't keep
  // generating tokens for a browser that's already gone.
  const onClientAbort = () => abortController.abort()
  request.signal.addEventListener('abort', onClientAbort, { once: true })

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false
      const send = (data: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Controller already closed (client disconnected).
        }
      }

      try {
        const result = await streamCodeResponse(
          message,
          code,
          history ?? [],
          mode ?? 'agent',
          (delta) => send({ type: 'delta', content: delta }),
          abortController.signal,
        )
        send({ type: 'done', ...result })
      } catch (error) {
        if (abortController.signal.aborted) {
          // Client walked away — nothing else to report.
        } else {
          console.error('Chat stream error:', error)
          send({ type: 'error', message: 'Failed to generate response' })
        }
      } finally {
        closed = true
        request.signal.removeEventListener('abort', onClientAbort)
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abortController.abort()
    },
  })

  return new Response(stream, { headers: sseHeaders() })
}
