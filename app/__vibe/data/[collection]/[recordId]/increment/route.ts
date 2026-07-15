import { NextRequest, NextResponse } from 'next/server'
import { deploymentContext } from '@/lib/v2/http'
import { assertVisitorWriteLimit, getCollection, incrementRecord, visitorHash } from '@/lib/v2/managed-data'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; recordId: string }> },
) {
  try {
    const context = await deploymentContext(request)
    if (!context) return NextResponse.json({ error: 'Creation not found.' }, { status: 404 })
    const { collection: name, recordId } = await params
    const collection = await getCollection(context.project.id, name)
    if (!collection || !collection.operations.includes('increment')) {
      return NextResponse.json({ error: 'That collection has no counters.' }, { status: 403 })
    }
    await assertVisitorWriteLimit(context.project.id, visitorHash(request))
    const body = await request.json() as { field?: string; amount?: number }
    const amount = Number(body.amount || 1)
    if (!Number.isFinite(amount) || Math.abs(amount) > 1000) {
      return NextResponse.json({ error: 'Invalid counter amount.' }, { status: 400 })
    }
    return NextResponse.json({ record: await incrementRecord({
      projectId: context.project.id,
      collection,
      recordId,
      field: body.field || '',
      amount,
    }) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The counter could not be updated.' }, { status: 400 })
  }
}
