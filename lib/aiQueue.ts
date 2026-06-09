// Global cap on concurrent upstream AI calls so one classroom burst cannot
// exhaust the shared provider key; excess requests wait briefly in a FIFO
// queue and are rejected with AIQueueBusyError when the queue is saturated.

const MAX_CONCURRENT_AI_CALLS = 6
const MAX_WAITING = 24
const MAX_WAIT_MS = 30_000

export class AIQueueBusyError extends Error {
  constructor() {
    super('AI queue is full')
    this.name = 'AIQueueBusyError'
  }
}

interface Waiter {
  resolve: () => void
  timer: ReturnType<typeof setTimeout>
}

interface AIQueueState {
  active: number
  waiting: Waiter[]
}

const globalForAIQueue = globalThis as unknown as { aiQueue: AIQueueState | undefined }

const state: AIQueueState = globalForAIQueue.aiQueue ?? { active: 0, waiting: [] }

if (process.env.NODE_ENV !== 'production') {
  globalForAIQueue.aiQueue = state
}

function acquire(): Promise<void> {
  if (state.active < MAX_CONCURRENT_AI_CALLS) {
    state.active += 1
    return Promise.resolve()
  }
  if (state.waiting.length >= MAX_WAITING) {
    return Promise.reject(new AIQueueBusyError())
  }
  return new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      resolve,
      timer: setTimeout(() => {
        const index = state.waiting.indexOf(waiter)
        if (index >= 0) state.waiting.splice(index, 1)
        reject(new AIQueueBusyError())
      }, MAX_WAIT_MS),
    }
    state.waiting.push(waiter)
  })
}

function release() {
  const next = state.waiting.shift()
  if (next) {
    // Hand the slot to the next waiter; active count stays the same.
    clearTimeout(next.timer)
    next.resolve()
    return
  }
  state.active = Math.max(0, state.active - 1)
}

export async function withAISlot<T>(task: () => Promise<T>): Promise<T> {
  await acquire()
  try {
    return await task()
  } finally {
    release()
  }
}
