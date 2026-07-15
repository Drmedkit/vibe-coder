import { NextRequest } from 'next/server'
import { getAsset } from '@/lib/v2/assets'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const asset = await getAsset(id)
  if (!asset) return new Response('Asset not found', { status: 404 })
  return new Response(asset.body, {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
