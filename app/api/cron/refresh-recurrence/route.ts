import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/utils/supabase/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>
import { parseRrule, computeNextDate } from '@/app/utils/rrule'

function getYesterday(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function refreshDb(supabase: AnySupabaseClient, yesterday: string) {
  const now = new Date().toISOString()

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, repeat_rrule, start_date, repeat_next_date')
    .not('repeat_rrule', 'is', null)
    .neq('status', 'archived')

  if (error) return { error: error.message }

  let updated = 0
  let skipped = 0
  const changes: { title: string; old_date: string | null; new_date: string | null }[] = []

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
      changes.push({
        title: event.title,
        old_date: event.repeat_next_date ?? null,
        new_date: nextDate,
      })
    }
  }

  return { updated, skipped, changes }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-n8n-webhook-secret')
  if (!secret || secret !== process.env.N8N_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const yesterday = getYesterday()

  const prodResult = await refreshDb(createAdminClient(), yesterday)
  if ('error' in prodResult) {
    return NextResponse.json({ error: prodResult.error }, { status: 500 })
  }

  // Refresh test DB if env vars are present
  let testResult: Awaited<ReturnType<typeof refreshDb>> | null = null
  const testUrl = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL
  const testKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
  if (testUrl && testKey) {
    const testClient = createClient(testUrl, testKey, {
      db: { schema: 'activities' },
      auth: { persistSession: false },
    })
    testResult = await refreshDb(testClient, yesterday)
  }

  return NextResponse.json({
    prod: prodResult,
    ...(testResult !== null ? { test: testResult } : {}),
  })
}
