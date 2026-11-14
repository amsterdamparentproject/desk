import { NextRequest, NextResponse } from 'next/server'
import { authorizeN8nRequest } from '@/lib/auth/n8n-auth'
import { sweepStuckCards } from '@/lib/parse/server'

const DEFAULT_MINUTES = 5

/**
 * Rescues cards stuck in "Processing" — e.g. n8n died before calling back, or
 * the browser tab that owned the 2-minute timeout was closed. Moves them to
 * the Error list (or just clears the status if already past triage) with a
 * reason on the card.
 *
 * Desk already runs this sweep whenever it loads or polls (see app/page.tsx
 * and pollForUpdates), so no schedule is needed. This route stays for manual
 * or optional scheduled calls:
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
  let result
  try {
    result = await sweepStuckCards(minutes)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'sweep failed' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    minutes: result.minutes,
    swept: result.swept.length,
    items: result.swept,
    failed: result.failed,
  })
}
