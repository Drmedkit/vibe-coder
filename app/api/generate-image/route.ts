import { NextRequest, NextResponse } from 'next/server'
import { generateGameAsset } from '@/lib/imageGeneration'
import { prisma } from '@/lib/prisma'
import { clientKey, rateLimit, retryAfterSeconds } from '@/lib/rateLimit'

export const maxDuration = 60

const MAX_PROMPT_LEN = 1000
const VALID_TYPES = new Set<'character' | 'background' | 'item' | 'icon'>([
  'character',
  'background',
  'item',
  'icon',
])

// Image generation is the most expensive operation in the app — each call
// keeps a worker busy for 10-20s waiting on Google Imagen. Without throttling,
// one bored student can single-handedly saturate the server.
const IMAGE_RATE_LIMIT = 5 // requests
const IMAGE_RATE_WINDOW_MS = 60_000 // per minute

export async function POST(request: NextRequest) {
  const limit = rateLimit(clientKey(request, 'img'), IMAGE_RATE_LIMIT, IMAGE_RATE_WINDOW_MS)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Te veel afbeeldingen in korte tijd. Wacht even en probeer opnieuw.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds(limit)) },
      },
    )
  }

  try {
    const body = (await request.json()) as { prompt?: string; assetType?: string }
    const prompt = body.prompt?.trim()
    const assetType = (body.assetType ?? 'item') as 'character' | 'background' | 'item' | 'icon'

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }
    if (prompt.length > MAX_PROMPT_LEN) {
      return NextResponse.json({ error: 'Prompt te lang' }, { status: 400 })
    }
    if (!VALID_TYPES.has(assetType)) {
      return NextResponse.json({ error: 'Onbekend assetType' }, { status: 400 })
    }

    // If the client has already gone away, don't spend 10-20s talking to
    // Google on their behalf.
    if (request.signal.aborted) {
      return NextResponse.json({ error: 'Client afgebroken' }, { status: 499 })
    }

    const dataUrl = await generateGameAsset(prompt, assetType)
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')

    const asset = await prisma.asset.create({
      data: { prompt, assetType, data: base64, mimeType: 'image/png' },
    })

    return NextResponse.json({
      id: asset.id,
      prompt,
      url: `/api/images/${asset.id}`,
      timestamp: Date.now(),
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json({ error: 'Afbeelding genereren mislukt' }, { status: 500 })
  }
}
