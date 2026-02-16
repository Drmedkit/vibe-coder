import { NextRequest, NextResponse } from 'next/server'
import { generateImage, generateGameAsset } from '@/lib/imageGeneration'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, assetType } = body as {
      prompt: string
      assetType?: 'character' | 'background' | 'item' | 'icon'
    }

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    let result

    if (assetType) {
      result = await generateGameAsset(prompt, assetType)
    } else {
      result = await generateImage(prompt)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Image Generation API Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    )
  }
}
