import { getDatabase } from '@/lib/cloudflare'
import { makeId, nowIso } from '@/lib/sqlite'

export const CREDIT_POLICY = {
  dailyCreatorCredits: Number(process.env.DAILY_CREATOR_CREDITS || 100),
  firstBuild: 20,
  remix: 5,
  image: 10,
  runtimeTextCallsPerProject: Number(process.env.RUNTIME_TEXT_DAILY_LIMIT || 50),
  runtimeImageCallsPerProject: Number(process.env.RUNTIME_IMAGE_DAILY_LIMIT || 3),
} as const

function startOfToday(): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  return date.toISOString()
}

export async function getDailyCreditsUsed(ownerId: string): Promise<number> {
  const row = await (await getDatabase()).prepare(`
    SELECT COALESCE(SUM(credits), 0) AS total FROM usage_events
    WHERE owner_id = ? AND created_at >= ?
  `).bind(ownerId, startOfToday()).first<{ total: number }>()
  return Number(row?.total || 0)
}

export async function getCreditBalance(ownerId: string): Promise<{ used: number; remaining: number; total: number }> {
  const used = await getDailyCreditsUsed(ownerId)
  return {
    used,
    remaining: Math.max(0, CREDIT_POLICY.dailyCreatorCredits - used),
    total: CREDIT_POLICY.dailyCreatorCredits,
  }
}

export async function assertCredits(ownerId: string, credits: number): Promise<void> {
  const balance = await getCreditBalance(ownerId)
  if (balance.remaining < credits) {
    const error = new Error(`This build needs ${credits} credits. ${balance.remaining} remain today.`)
    error.name = 'CreditLimitError'
    throw error
  }
}

export async function spendCredits(
  ownerId: string,
  projectId: string | null,
  kind: string,
  credits: number,
): Promise<void> {
  await (await getDatabase()).prepare(`
    INSERT INTO usage_events (id, owner_id, project_id, kind, credits, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(makeId('usage'), ownerId, projectId, kind, credits, nowIso()).run()
}

export async function assertRuntimeCall(
  projectId: string,
  kind: 'runtime_text' | 'runtime_image',
): Promise<void> {
  const row = await (await getDatabase()).prepare(`
    SELECT COUNT(*) AS total FROM usage_events
    WHERE project_id = ? AND kind = ? AND created_at >= ?
  `).bind(projectId, kind, startOfToday()).first<{ total: number }>()
  const limit = kind === 'runtime_text'
    ? CREDIT_POLICY.runtimeTextCallsPerProject
    : CREDIT_POLICY.runtimeImageCallsPerProject
  if (Number(row?.total || 0) >= limit) {
    const error = new Error('This creation has used its AI allowance for today.')
    error.name = 'RuntimeLimitError'
    throw error
  }
}

export function isLimitError(error: unknown): boolean {
  return error instanceof Error && ['CreditLimitError', 'RuntimeLimitError'].includes(error.name)
}
