import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Next.js reloads modules in dev, and serverless platforms can recycle module
// instances in unexpected ways. Cache the client + pool on globalThis so every
// import shares one pool. Previously we only cached in dev, which meant every
// fresh module instance in production spun up its own pg.Pool — with pg's
// default max of 10 connections and no idle/acquire timeouts, a handful of
// concurrent users was enough to exhaust Neon's connection budget and hang
// the entire server.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

const connectionString = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Database URL is not set')
}

// Env-tunable pool sizing. Defaults are chosen for a small classroom
// deployment (~30 concurrent users) on Neon's free tier.
const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 20)
const IDLE_TIMEOUT_MS = Number(process.env.DB_IDLE_TIMEOUT_MS ?? 10_000)
const CONNECTION_TIMEOUT_MS = Number(process.env.DB_CONNECTION_TIMEOUT_MS ?? 5_000)
const STATEMENT_TIMEOUT_MS = Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 10_000)

function createPool(): Pool {
  const pool = new Pool({
    connectionString,
    max: POOL_MAX,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    // Cap individual queries so a hung query can't monopolise a connection.
    statement_timeout: STATEMENT_TIMEOUT_MS,
    query_timeout: STATEMENT_TIMEOUT_MS,
  })

  // Unhandled 'error' events on idle pooled clients would otherwise crash the
  // Node process (for example when Neon closes an idle connection).
  pool.on('error', (err) => {
    console.error('pg pool error:', err)
  })

  return pool
}

const pool = globalForPrisma.pool ?? createPool()
const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ['error', 'warn'],
  })

globalForPrisma.prisma = prisma
globalForPrisma.pool = pool
