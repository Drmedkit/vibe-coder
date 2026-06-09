import { AIIntent } from './types'
import { prisma } from './prisma'

const ONE_HOUR_MS = 60 * 60 * 1000
const TWO_DAYS_MS = 48 * ONE_HOUR_MS
const CLEANUP_PROBABILITY = 0.02
const HEAVY_INTENTS = new Set<AIIntent>(['first_build', 'major_rebuild'])
const IMAGE_INTENT = 'image'

export const AI_RATE_LIMITS = {
  requestsPerHour: 60,
  heavyBuildsPerHour: 4,
  imagesPerHour: 10,
}

export interface AIUsageReservation {
  allowed: boolean
  retryAfterSeconds: number
  message?: string
  release: () => Promise<void>
}

type IntentFilter = { in: string[] } | { not: string }

const CHAT_INTENTS: IntentFilter = { not: IMAGE_INTENT }
const HEAVY_INTENT_FILTER: IntentFilter = { in: Array.from(HEAVY_INTENTS) }
const IMAGE_INTENT_FILTER: IntentFilter = { in: [IMAGE_INTENT] }

const noRelease = async () => {}

function denied(message: string, retryAfterSeconds: number): AIUsageReservation {
  return { allowed: false, retryAfterSeconds, message, release: noRelease }
}

// Seconds until enough events age out of the rolling window for one new
// request to fit under the limit, instead of a fixed pessimistic wait.
async function computeRetryAfterSeconds(
  ownerId: string,
  intentFilter: IntentFilter,
  limit: number
): Promise<number> {
  const windowStart = new Date(Date.now() - ONE_HOUR_MS)
  const events = await prisma.aiUsageEvent.findMany({
    where: { ownerId, intent: intentFilter, createdAt: { gte: windowStart } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  })
  if (events.length < limit) return 0
  const blocking = events[events.length - limit]
  const freeAt = blocking.createdAt.getTime() + ONE_HOUR_MS
  return Math.max(30, Math.ceil((freeAt - Date.now()) / 1000))
}

function maybeCleanupOldEvents(ownerId: string) {
  if (Math.random() >= CLEANUP_PROBABILITY) return
  const cutoff = new Date(Date.now() - TWO_DAYS_MS)
  prisma.aiUsageEvent
    .deleteMany({ where: { ownerId, createdAt: { lt: cutoff } } })
    .catch(error => console.error('AI usage cleanup failed:', error))
}

// The event is recorded BEFORE the model call so concurrent requests count
// each other; callers release() the reservation if the request does no work.
export async function reserveAIUsage(ownerId: string, intent: AIIntent): Promise<AIUsageReservation> {
  maybeCleanupOldEvents(ownerId)
  const event = await prisma.aiUsageEvent.create({ data: { ownerId, intent } })
  const release = async () => {
    await prisma.aiUsageEvent.delete({ where: { id: event.id } }).catch(() => {})
  }

  const windowStart = new Date(Date.now() - ONE_HOUR_MS)
  const [requestCount, heavyCount] = await Promise.all([
    prisma.aiUsageEvent.count({
      where: { ownerId, intent: CHAT_INTENTS, createdAt: { gte: windowStart } },
    }),
    HEAVY_INTENTS.has(intent)
      ? prisma.aiUsageEvent.count({
          where: { ownerId, intent: HEAVY_INTENT_FILTER, createdAt: { gte: windowStart } },
        })
      : Promise.resolve(0),
  ])

  if (requestCount > AI_RATE_LIMITS.requestsPerHour) {
    await release()
    const retryAfterSeconds = await computeRetryAfterSeconds(ownerId, CHAT_INTENTS, AI_RATE_LIMITS.requestsPerHour)
    return denied(
      'Je hebt veel AI-berichten gestuurd. Wacht even en werk ondertussen aan je idee of code.',
      retryAfterSeconds
    )
  }

  if (HEAVY_INTENTS.has(intent) && heavyCount > AI_RATE_LIMITS.heavyBuildsPerHour) {
    await release()
    const retryAfterSeconds = await computeRetryAfterSeconds(ownerId, HEAVY_INTENT_FILTER, AI_RATE_LIMITS.heavyBuildsPerHour)
    return denied(
      'Je hebt genoeg grote builds voor dit uur gebruikt. Gebruik nu Leg dit uit of vraag om kleine verbeteringen.',
      retryAfterSeconds
    )
  }

  return { allowed: true, retryAfterSeconds: 0, release }
}

export async function reserveImageUsage(ownerId: string): Promise<AIUsageReservation> {
  maybeCleanupOldEvents(ownerId)
  const event = await prisma.aiUsageEvent.create({ data: { ownerId, intent: IMAGE_INTENT } })
  const release = async () => {
    await prisma.aiUsageEvent.delete({ where: { id: event.id } }).catch(() => {})
  }

  const windowStart = new Date(Date.now() - ONE_HOUR_MS)
  const imageCount = await prisma.aiUsageEvent.count({
    where: { ownerId, intent: IMAGE_INTENT_FILTER, createdAt: { gte: windowStart } },
  })

  if (imageCount > AI_RATE_LIMITS.imagesPerHour) {
    await release()
    const retryAfterSeconds = await computeRetryAfterSeconds(ownerId, IMAGE_INTENT_FILTER, AI_RATE_LIMITS.imagesPerHour)
    return denied(
      'Je hebt genoeg afbeeldingen voor dit uur gemaakt. Gebruik je bestaande assets of probeer het later opnieuw.',
      retryAfterSeconds
    )
  }

  return { allowed: true, retryAfterSeconds: 0, release }
}
