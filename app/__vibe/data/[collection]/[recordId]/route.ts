import { NextRequest, NextResponse } from 'next/server'
import { deploymentContext } from '@/lib/v2/http'
import { assertVisitorWriteLimit, getCollection, updateRecord, validateRecord, visitorHash } from '@/lib/v2/managed-data'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collection: string; recordId: string }> },
) {
  try {
    const context = await deploymentContext(request)
    if (!context) return NextResponse.json({ error: 'Creation not found.' }, { status: 404 })
    const { collection: name, recordId } = await params
    const collection = await getCollection(context.project.id, name)
    if (!collection || !collection.operations.includes('update')) {
      return NextResponse.json({ error: 'That collection cannot be updated.' }, { status: 403 })
    }
    await assertVisitorWriteLimit(context.project.id, visitorHash(request))
    const patch = validateRecord(collection, await request.json(), true)
    return NextResponse.json({ record: await updateRecord({ projectId: context.project.id, collection, recordId, patch }) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The record could not be updated.' }, { status: 400 })
  }
}
