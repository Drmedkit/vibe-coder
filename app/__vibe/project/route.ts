import { NextRequest, NextResponse } from 'next/server'
import { deploymentContext } from '@/lib/v2/http'
import { getCapabilities } from '@/lib/v2/repository'

export async function GET(request: NextRequest) {
  const context = await deploymentContext(request)
  if (!context) return NextResponse.json({ error: 'Creation not found.' }, { status: 404 })
  return NextResponse.json({
    id: context.project.id,
    title: context.project.title,
    summary: context.project.summary,
    capabilities: await getCapabilities(context.project.id),
  })
}
