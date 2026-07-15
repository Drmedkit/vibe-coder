import { NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getBuildJob, getOwnedProject, listBuildEvents } from '@/lib/v2/repository'
import { kickBuildWorker } from '@/lib/v2/build-worker'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  const { id } = await params
  const build = await getBuildJob(id)
  if (!user || !build || !(await getOwnedProject(build.projectId, user.id))) {
    return new Response('Not found', { status: 404 })
  }
  void kickBuildWorker()
  let lastId = Number(request.nextUrl.searchParams.get('after') || 0)
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      let sending = false
      const send = async () => {
        if (closed) return
        if (sending) return
        sending = true
        const events = await listBuildEvents(id, lastId)
        for (const event of events) {
          lastId = event.id
          controller.enqueue(encoder.encode(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`))
        }
        const current = await getBuildJob(id)
        if (!current || current.status === 'complete' || current.status === 'failed') {
          closed = true
          clearInterval(interval)
          controller.close()
        }
        sending = false
      }
      void send()
      const interval = setInterval(() => void send(), 700)
      request.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(interval)
        try { controller.close() } catch {}
      })
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
