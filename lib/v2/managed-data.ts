import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/cloudflare'
import { makeId, nowIso, parseJson } from '@/lib/sqlite'
import { CollectionCapability, CollectionField } from '@/lib/v2/types'
import { getCapabilities } from '@/lib/v2/repository'
import { moderateText, sanitizePublicText } from '@/lib/v2/moderation'

export async function getCollection(projectId: string, name: string): Promise<CollectionCapability | null> {
  const cleanName = name.trim().toLowerCase()
  return (await getCapabilities(projectId)).collections.find(collection => collection.name === cleanName) || null
}

export function visitorHash(request: NextRequest): string {
  const forwarded = request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const address = forwarded || request.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(`${process.env.VISITOR_HASH_SALT || 'vibe-runtime'}:${address}`).digest('hex')
}

function normalizeField(field: CollectionField, value: unknown): string | number | boolean | null {
  if (value === undefined || value === null || value === '') {
    if (field.required) throw new Error(`${field.name} is required.`)
    return null
  }
  if (field.type === 'text') {
    const text = sanitizePublicText(value, Math.min(field.maxLength || 500, 1_000))
    if (field.required && !text) throw new Error(`${field.name} is required.`)
    const moderation = moderateText(text)
    if (!moderation.allowed) throw new Error('That text needs an adult review.')
    return text
  }
  if (field.type === 'number') {
    const number = Number(value)
    if (!Number.isFinite(number) || Math.abs(number) > 1_000_000_000) throw new Error(`${field.name} must be a number.`)
    return number
  }
  if (typeof value !== 'boolean') throw new Error(`${field.name} must be true or false.`)
  return value
}

export function validateRecord(
  collection: CollectionCapability,
  input: unknown,
  partial = false,
): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A record object is required.')
  const source = input as Record<string, unknown>
  const output: Record<string, unknown> = {}
  for (const field of collection.fields) {
    if (partial && source[field.name] === undefined) continue
    output[field.name] = normalizeField({ ...field, required: partial ? false : field.required }, source[field.name])
  }
  if (Object.keys(output).length === 0) throw new Error('No valid fields were provided.')
  return output
}

export async function assertVisitorWriteLimit(projectId: string, hash: string): Promise<void> {
  const row = await (await getDatabase()).prepare(`
    SELECT COUNT(*) AS total FROM project_records
    WHERE project_id = ? AND visitor_hash = ? AND created_at >= ?
  `).bind(projectId, hash, new Date(Date.now() - 60_000).toISOString()).first<{ total: number }>()
  if (Number(row?.total || 0) >= 12) {
    const error = new Error('Too many changes. Wait a moment and try again.')
    error.name = 'VisitorRateLimitError'
    throw error
  }
}

export async function listRecords(projectId: string, collectionName: string) {
  const { results } = await (await getDatabase()).prepare(`
    SELECT id, data_json, created_at, updated_at FROM project_records
    WHERE project_id = ? AND collection_name = ? ORDER BY created_at DESC LIMIT 100
  `).bind(projectId, collectionName).all<{
    id: string
    data_json: string
    created_at: string
    updated_at: string
  }>()
  return results.map(row => ({
    id: row.id,
    ...parseJson<Record<string, unknown>>(row.data_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))
}

export async function createRecord(input: {
  projectId: string
  collection: CollectionCapability
  data: Record<string, unknown>
  visitorHash: string
}) {
  const db = await getDatabase()
  const count = await db.prepare(`
    SELECT COUNT(*) AS total FROM project_records WHERE project_id = ? AND collection_name = ?
  `).bind(input.projectId, input.collection.name).first<{ total: number }>()
  if (Number(count?.total || 0) >= Math.min(input.collection.maxRecords || 500, 2_000)) {
    throw new Error('This collection is full.')
  }
  const id = makeId('record')
  const timestamp = nowIso()
  await db.prepare(`
    INSERT INTO project_records (
      id, project_id, collection_name, data_json, visitor_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, input.projectId, input.collection.name, JSON.stringify(input.data),
    input.visitorHash, timestamp, timestamp,
  ).run()
  return { id, ...input.data, createdAt: timestamp, updatedAt: timestamp }
}

export async function updateRecord(input: {
  projectId: string
  collection: CollectionCapability
  recordId: string
  patch: Record<string, unknown>
}) {
  const db = await getDatabase()
  const row = await db.prepare(`
    SELECT data_json FROM project_records
    WHERE id = ? AND project_id = ? AND collection_name = ?
  `).bind(input.recordId, input.projectId, input.collection.name).first<{ data_json: string }>()
  if (!row) throw new Error('Record not found.')
  const data = { ...parseJson<Record<string, unknown>>(row.data_json, {}), ...input.patch }
  const updatedAt = nowIso()
  await db.prepare('UPDATE project_records SET data_json = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(data), updatedAt, input.recordId).run()
  return { id: input.recordId, ...data, updatedAt }
}

export async function incrementRecord(input: {
  projectId: string
  collection: CollectionCapability
  recordId: string
  field: string
  amount: number
}) {
  const field = input.collection.fields.find(candidate => candidate.name === input.field && candidate.type === 'number')
  if (!field) throw new Error('That field cannot be incremented.')
  const db = await getDatabase()
  const row = await db.prepare(`
    SELECT data_json FROM project_records WHERE id = ? AND project_id = ? AND collection_name = ?
  `).bind(input.recordId, input.projectId, input.collection.name).first<{ data_json: string }>()
  if (!row) throw new Error('Record not found.')
  const data = parseJson<Record<string, unknown>>(row.data_json, {})
  const current = Number(data[input.field] || 0)
  data[input.field] = Math.max(-1_000_000_000, Math.min(1_000_000_000, current + input.amount))
  const updatedAt = nowIso()
  await db.prepare('UPDATE project_records SET data_json = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(data), updatedAt, input.recordId).run()
  return { id: input.recordId, ...data, updatedAt }
}
