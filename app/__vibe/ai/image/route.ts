import { NextRequest, NextResponse } from 'next/server'
import { deploymentContext } from '@/lib/v2/http'
import { runtimeImage } from '@/lib/v2/runtime-ai'
import { isLimitError } from '@/lib/v2/quotas'

export const maxDuration = 90

export async function POST(request: NextRequest) {
  try {
    const context = await deploymentContext(request)
    if (!context) return NextResponse.json({ error: 'Creation not found.' }, { status: 404 })
    const body = await request.json() as { prompt?: string }
    return NextResponse.json(await runtimeImage(context.project, body.prompt || ''))
  } catch (error) {
    const status = isLimitError(error) ? 429 : 400
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The image could not be created.' }, { status })
  }
}
