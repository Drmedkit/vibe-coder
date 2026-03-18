import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!/^[\w-]+$/.test(id)) return new NextResponse('Not found', { status: 404 })

  const asset = await prisma.asset.findUnique({ where: { id } })
  if (!asset) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(Buffer.from(asset.data, 'base64'), {
    headers: {
      'Content-Type': asset.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
