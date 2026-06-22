import { NextRequest, NextResponse } from 'next/server'
import { saveActivity, upsertEnrichedActivity } from '@/app/actions/activities'
import { DeskActivity } from '@/app/types/activity'

export async function POST(request: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET
  if (!secret || request.headers.get('x-n8n-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const items: DeskActivity[] = Array.isArray(body) ? body : [body as DeskActivity]
  const [first, ...rest] = items

  if (!first?.id || !first?.type) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  // Strip fields n8n injects that aren't part of the DB schema
  const sanitize = (item: DeskActivity): DeskActivity => {
    const { error: _error, ...clean } = item as unknown as Record<string, unknown>
    return clean as unknown as DeskActivity
  }

  await saveActivity(first.id, first.type, { ...sanitize(first), list_id: 'review', status: 'processed' })

  for (const item of rest) {
    const newId = crypto.randomUUID()
    await upsertEnrichedActivity(newId, item.type ?? first.type, {
      ...sanitize(item),
      id: newId,
      description: item.description ?? '',
      list_id: 'review',
      status: 'processed',
    })
  }

  return NextResponse.json({ ok: true })
}
