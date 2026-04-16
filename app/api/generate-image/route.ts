import { NextRequest, NextResponse } from 'next/server'
import { generateGameAsset } from '@/lib/imageGeneration'
import { prisma } from '@/lib/prisma'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { prompt, assetType = 'item' } = await request.json() as {
      prompt: string
      assetType?: 'character' | 'background' | 'item' | 'icon'
    }
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    // Generate image (returns data URL)
    const dataUrl = await generateGameAsset(prompt, assetType)
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')

    // Save to database
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
