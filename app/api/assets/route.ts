import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isUnauthorized, requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await requireUser()
    const assets = await prisma.asset.findMany({
      where: { ownerId: user.id },
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
  } catch (error) {
    if (isUnauthorized(error)) {
      return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    }
    console.error('Get assets error:', error)
    return NextResponse.json({ error: 'Server fout' }, { status: 500 })
  }
}
