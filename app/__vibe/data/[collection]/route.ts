import { NextRequest, NextResponse } from 'next/server'
import { deploymentContext } from '@/lib/v2/http'
import {
  assertVisitorWriteLimit,
  createRecord,
  getCollection,
  listRecords,
  validateRecord,
  visitorHash,
} from '@/lib/v2/managed-data'

export async function GET(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  const context = await deploymentContext(request)
  if (!context) return NextResponse.json({ error: 'Creation not found.' }, { status: 404 })
  const { collection: name } = await params
  const collection = await getCollection(context.project.id, name)
  if (!collection || !collection.operations.includes('list')) {
    return NextResponse.json({ error: 'That collection is not readable.' }, { status: 403 })
  }
  return NextResponse.json({ records: await listRecords(context.project.id, collection.name) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ collection: string }> }) {
  try {
    const context = await deploymentContext(request)
    if (!context) return NextResponse.json({ error: 'Creation not found.' }, { status: 404 })
    const { collection: name } = await params
    const collection = await getCollection(context.project.id, name)
    if (!collection || !collection.operations.includes('create')) {
      return NextResponse.json({ error: 'That collection does not accept submissions.' }, { status: 403 })
    }
    const hash = visitorHash(request)
    await assertVisitorWriteLimit(context.project.id, hash)
    const data = validateRecord(collection, await request.json())
    return NextResponse.json({ record: await createRecord({ projectId: context.project.id, collection, data, visitorHash: hash }) }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The record could not be saved.'
    return NextResponse.json({ error: message }, { status: error instanceof Error && error.name === 'VisitorRateLimitError' ? 429 : 400 })
  }
}
