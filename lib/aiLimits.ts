import { AIIntent } from './types'
import { prisma } from './prisma'

const ONE_HOUR_MS = 60 * 60 * 1000
const TWO_DAYS_MS = 48 * ONE_HOUR_MS
const HEAVY_INTENTS = new Set<AIIntent>(['first_build', 'major_rebuild'])

export const AI_RATE_LIMITS = {
  requestsPerHour: 60,
  heavyBuildsPerHour: 4,
}

export interface AIRateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
  message?: string
}

export async function checkAIRateLimit(ownerId: string, intent: AIIntent): Promise<AIRateLimitResult> {
  const windowStart = new Date(Date.now() - ONE_HOUR_MS)
  const [requestCount, heavyCount] = await Promise.all([
    prisma.aiUsageEvent.count({
      where: {
        ownerId,
        createdAt: { gte: windowStart },
      },
    }),
    HEAVY_INTENTS.has(intent)
      ? prisma.aiUsageEvent.count({
          where: {
            ownerId,
            intent: { in: Array.from(HEAVY_INTENTS) },
            createdAt: { gte: windowStart },
          },
        })
      : Promise.resolve(0),
  ])

  if (requestCount >= AI_RATE_LIMITS.requestsPerHour) {
    return {
      allowed: false,
      retryAfterSeconds: 15 * 60,
      message: 'Je hebt veel AI-berichten gestuurd. Wacht even en werk ondertussen aan je idee of code.',
    }
  }

  if (HEAVY_INTENTS.has(intent) && heavyCount >= AI_RATE_LIMITS.heavyBuildsPerHour) {
    return {
      allowed: false,
      retryAfterSeconds: 20 * 60,
      message: 'Je hebt genoeg grote builds voor dit uur gebruikt. Gebruik nu Leg dit uit of vraag om kleine verbeteringen.',
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

export async function recordAIUsage(ownerId: string, intent: AIIntent): Promise<void> {
  const cutoff = new Date(Date.now() - TWO_DAYS_MS)
  await Promise.all([
    prisma.aiUsageEvent.create({
      data: { ownerId, intent },
    }),
    prisma.aiUsageEvent.deleteMany({
      where: {
        ownerId,
        createdAt: { lt: cutoff },
      },
    }),
  ])
}
