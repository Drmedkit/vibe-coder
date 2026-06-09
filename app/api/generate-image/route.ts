import { NextRequest, NextResponse } from 'next/server'
import { generateGameAsset } from '@/lib/imageGeneration'
import { prisma } from '@/lib/prisma'
import { isUnauthorized, requireUser } from '@/lib/auth'
import { reserveImageUsage } from '@/lib/aiLimits'
import { AIQueueBusyError, withAISlot } from '@/lib/aiQueue'

const VALID_ASSET_TYPES = new Set(['character', 'background', 'item', 'icon'])

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { prompt, assetType = 'item' } = await request.json() as {
      prompt: string
      assetType?: 'character' | 'background' | 'item' | 'icon'
    }
    const cleanPrompt = prompt?.trim()
    if (!cleanPrompt) return NextResponse.json({ error: 'Prompt is verplicht' }, { status: 400 })
    if (!VALID_ASSET_TYPES.has(assetType)) {
      return NextResponse.json({ error: 'Onbekend asset type' }, { status: 400 })
    }

    const reservation = await reserveImageUsage(user.id)
    if (!reservation.allowed) {
      return NextResponse.json({
        error: reservation.message,
        code: 'AI_RATE_LIMIT',
        retryAfterSeconds: reservation.retryAfterSeconds,
      }, {
        status: 429,
        headers: { 'Retry-After': String(reservation.retryAfterSeconds) },
      })
    }

    let dataUrl: string
    try {
      dataUrl = await withAISlot(() => generateGameAsset(cleanPrompt, assetType))
    } catch (error) {
      await reservation.release()
      if (error instanceof AIQueueBusyError) {
        return NextResponse.json({
          error: 'Het is nu erg druk met AI-verzoeken. Wacht een paar tellen en probeer het opnieuw.',
          code: 'AI_BUSY',
          retryAfterSeconds: 15,
        }, {
          status: 429,
          headers: { 'Retry-After': '15' },
        })
      }
      throw error
    }
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')

    const asset = await prisma.asset.create({
      data: { ownerId: user.id, prompt: cleanPrompt, assetType, data: base64, mimeType: 'image/png' },
    })

    const count = await prisma.asset.count({ where: { ownerId: user.id } })
    if (count > 100) {
      const oldest = await prisma.asset.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: 'asc' },
        take: count - 100,
        select: { id: true },
      })
      await prisma.asset.deleteMany({ where: { id: { in: oldest.map(a => a.id) }, ownerId: user.id } })
    }

    return NextResponse.json({
      id: asset.id,
      prompt: cleanPrompt,
      url: `/api/images/${asset.id}`,
      timestamp: Date.now(),
    })
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Image generation error:', error)
    return NextResponse.json({ error: 'Afbeelding genereren mislukt' }, { status: 500 })
  }
}
