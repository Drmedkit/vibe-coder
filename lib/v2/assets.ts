import { createHash } from 'crypto'
import { getArtifactStore, getDatabase } from '@/lib/cloudflare'
import { makeId, nowIso } from '@/lib/sqlite'

export interface StoredAsset {
  id: string
  url: string
  mimeType: string
  prompt: string
}

export async function storeDataUrlAsset(input: {
  ownerId: string
  projectId: string | null
  prompt: string
  dataUrl: string
}): Promise<StoredAsset> {
  const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/)
  if (!match) throw new Error('Unsupported generated image format')
  const mimeType = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error('Generated image is too large')
  const hash = createHash('sha256').update(buffer).digest('hex')
  const db = await getDatabase()
  const existing = await db.prepare(`
    SELECT id, prompt, mime_type FROM assets
    WHERE owner_id = ? AND content_hash = ? LIMIT 1
  `).bind(input.ownerId, hash).first<{ id: string; prompt: string; mime_type: string }>()
  if (existing) {
    return { id: existing.id, url: `/api/runtime/assets/${existing.id}`, mimeType: existing.mime_type, prompt: existing.prompt }
  }

  const id = makeId('asset')
  const key = `assets/${hash}`
  await (await getArtifactStore()).put(key, buffer, { metadata: { mimeType, prompt: input.prompt } })
  await db.prepare(`
    INSERT INTO assets (
      id, owner_id, project_id, prompt, mime_type, file_path, content_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, input.ownerId, input.projectId, input.prompt, mimeType, key, hash, nowIso()).run()
  return { id, url: `/api/runtime/assets/${id}`, mimeType, prompt: input.prompt }
}

export async function getAsset(assetId: string): Promise<{
  body: ArrayBuffer
  mimeType: string
  prompt: string
  ownerId: string
} | null> {
  const row = await (await getDatabase()).prepare(`
    SELECT file_path, mime_type, prompt, owner_id FROM assets WHERE id = ?
  `).bind(assetId).first<{
    file_path: string
    mime_type: string
    prompt: string
    owner_id: string
  }>()
  if (!row) return null
  const body = await (await getArtifactStore()).get(row.file_path, 'arrayBuffer')
  if (!body) return null
  return { body, mimeType: row.mime_type, prompt: row.prompt, ownerId: row.owner_id }
}
