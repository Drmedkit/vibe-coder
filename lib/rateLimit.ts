// Simple in-memory fixed-window rate limiter. Sufficient for a single-node
// deployment (docker-compose, one Next.js server). For multi-node / serverless
// fan-out, swap in Redis or Upstash.

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export interface RateLimitResult {
  ok: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { ok: true, remaining: limit - 1, resetAt }
  }

  existing.count += 1
  const ok = existing.count <= limit
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  }
}

// Periodic GC so the map doesn't grow unbounded.
const gc = setInterval(() => {
  const now = Date.now()
  for (const [key, b] of buckets.entries()) {
    if (b.resetAt <= now) buckets.delete(key)
  }
}, 60_000)
gc.unref?.()

export function clientKey(req: Request, prefix: string): string {
  const h = req.headers
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  return `${prefix}:${ip}`
}

export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000))
}
