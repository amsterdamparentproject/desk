import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/app/utils/supabase/server'
import { authorizeN8nRequest } from '@/lib/auth/n8n-auth'
import { failurePatch, staleCutoffIso } from '@/lib/parse/sweep'
import { updateWithParseColumns } from '@/lib/parse/server'

const DEFAULT_MINUTES = 5

/**
 * Rescues cards stuck in "Processing" — e.g. n8n died before calling back, or
 * the browser tab that owned the 2-minute timeout was closed. Moves them to
 * the Error list (or just clears the status if already past triage) with a
 * reason on the card.
 *
 * Trigger it on a schedule (an n8n Schedule node every ~5 minutes works, same
 * as refresh-recurrence):
 *   POST /api/cron/sweep-stuck            signed headers (lib/auth/n8n-auth.ts)
 *   POST /api/cron/sweep-stuck?minutes=10 to change the threshold
 */
export async function POST(req: NextRequest) {
  // n8n signs the route path (HMAC, see lib/auth/n8n-auth.ts).
  if (!authorizeN8nRequest(req.headers, req.nextUrl.pathname).ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requested = Number(req.nextUrl.searchParams.get('minutes'))
  const minutes =
    Number.isFinite(requested) && requested >= 1 ? requested : DEFAULT_MINUTES
  const cutoff = staleCutoffIso(new Date(), minutes)

  const supabase = createAdminClient()
  const swept: { table: string; id: string; title: string }[] = []
  const failed: { table: string; id: string; error: string }[] = []

  for (const table of ['events', 'resources'] as const) {
    const { data, error } = await supabase
      .from(table)
      .select('id, title, list_id')
      .eq('status', 'processing')
      .lt('updated_at', cutoff)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    for (const row of data ?? []) {
      try {
        await updateWithParseColumns(table, row.id, failurePatch(row.list_id), {
          error: `No response from the AI after ${minutes} minutes — try "Send to AI" again or enter details by hand`,
          warnings: [],
        })
        swept.push({ table, id: row.id, title: row.title })
      } catch (err) {
        failed.push({
          table,
          id: row.id,
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }
  }

  return NextResponse.json({
    minutes,
    swept: swept.length,
    items: swept,
    failed,
  })
}
