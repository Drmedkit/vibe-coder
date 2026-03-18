import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const assets = await prisma.asset.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, prompt: true, assetType: true, createdAt: true },
    take: 50,
  })

  return NextResponse.json({
    assets: assets.map(a => ({
      id: a.id,
      prompt: a.prompt,
      assetType: a.assetType,
      url: `/api/images/${a.id}`,
      timestamp: a.createdAt.getTime(),
    })),
  })
}
