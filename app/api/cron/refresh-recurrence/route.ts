import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/utils/supabase/server'
import { parseRrule, computeNextDate } from '@/app/utils/rrule'

function getYesterday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-n8n-webhook-secret')
  if (!secret || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const yesterday = getYesterday()

  const { data: events, error } = await supabase
    .from('events')
    .select('id, repeat_rrule, start_date')
    .not('repeat_rrule', 'is', null)
    .neq('status', 'archived')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const now = new Date().toISOString()
  let updated = 0
  let skipped = 0

  for (const event of events ?? []) {
    const { frequency, days, untilDate } = parseRrule(event.repeat_rrule)
    if (!frequency) { skipped++; continue }

    // Use the later of start_date and yesterday so the result is always today-or-later
    const refDate = event.start_date && event.start_date > yesterday ? event.start_date : yesterday
    const nextDate = computeNextDate(frequency, days, untilDate, refDate)

    const { error: updateError } = await supabase
      .from('events')
      .update({ repeat_next_date: nextDate, updated_at: now })
      .eq('id', event.id)

    if (updateError) {
      console.error(`Failed to update event ${event.id}:`, updateError.message)
      skipped++
    } else {
      updated++
    }
  }

  return NextResponse.json({ updated, skipped })
}
