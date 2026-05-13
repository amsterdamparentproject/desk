import { NextRequest, NextResponse } from 'next/server'
import { saveActivity, createActivity } from '@/app/actions/activities'
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

  await saveActivity(first.id, first.type, { ...first, list_id: 'review', status: 'processed' })

  for (const item of rest) {
    const newId = crypto.randomUUID()
    await createActivity(newId, item.type ?? first.type, {
      description: item.description ?? '',
      list_id: 'review',
      status: 'processed',
      file_url: item.file_url ?? null,
    })
    await saveActivity(newId, item.type ?? first.type, { ...item, id: newId, list_id: 'review', status: 'processed' })
  }

  return NextResponse.json({ ok: true })
}
