/**
 * Re-send every card sitting in the Error list to the n8n AI workflow — the
 * same thing the drawer's "Send to AI" button does, for all of them at once.
 *
 * For each events/resources row with list_id = 'error' it:
 *   1. sets status = 'processing' (list_id stays 'error'; the n8n callback
 *      moves the card out when enrichment lands, exactly like the UI path)
 *   2. POSTs { ...row, type, action: 'update', use_ai: true, file: null } to
 *      N8N_DESK_WEBHOOK_URL with the X-N8N-WEBHOOK-SECRET header (same payload
 *      and auth as lib/PostToWebhook.tsx)
 *   3. if n8n rejects the call, puts the card back to status = 'new' so it
 *      isn't left stuck as 'processing'
 *
 * Cards are sent one at a time with a pause between them so the workflow
 * isn't hit with every execution at once. Runs against whatever Supabase
 * project NEXT_PUBLIC_SUPABASE_URL points at, and the PRODUCTION webhook.
 *
 * With --triage-events it instead re-sends every EVENT held in the Triage
 * table (list_id ideas / capture / review / error / refine; skips archived and
 * rows already processing), to refresh stale details before a newsletter pass.
 * Same payload as the drawer's "Send to AI", so it re-parses exactly like that
 * button does.
 *
 * Usage:
 *   yarn tsx scripts/send-errors-to-ai.ts            # dry run — lists what would be sent
 *   yarn tsx scripts/send-errors-to-ai.ts --triage-events            # dry run, all held events
 *   yarn tsx scripts/send-errors-to-ai.ts --triage-events --apply
 *   yarn tsx scripts/send-errors-to-ai.ts --apply    # actually sends
 *   yarn tsx scripts/send-errors-to-ai.ts --apply --delay=5000   # ms between cards (default 3000)
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const APPLY = process.argv.includes('--apply')
const TRIAGE_EVENTS = process.argv.includes('--triage-events')
const delayArg = process.argv.find((a) => a.startsWith('--delay='))
const DELAY_MS = delayArg ? Number(delayArg.split('=')[1]) : 3000

const webhookUrl = process.env.N8N_DESK_WEBHOOK_URL
const hmacKey = process.env.DESK_HMAC_KEY

if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  console.error('Missing Supabase env vars in .env.local')
  process.exit(1)
}
if (APPLY && (!webhookUrl || !hmacKey)) {
  console.error('Missing N8N_DESK_WEBHOOK_URL or DESK_HMAC_KEY in .env.local')
  process.exit(1)
}
if (APPLY && !/^https?:\/\//.test(webhookUrl!)) {
  // Catches the "secret pasted into the URL variable" mix-up before any request.
  console.error('N8N_DESK_WEBHOOK_URL is not a URL — check .env.local')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { db: { schema: 'activities' }, auth: { persistSession: false } }
)

type Table = 'events' | 'resources'
const TYPE_BY_TABLE: Record<Table, 'event' | 'resource'> = {
  events: 'event',
  resources: 'resource',
}

function signHeaders(key: string, subject: string) {
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = createHmac('sha256', key)
    .update(`desk>n8n.${ts}.${subject}`)
    .digest('hex')
  return { 'x-desk-timestamp': ts, 'x-desk-signature': sig }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const label = (row: Record<string, unknown>) =>
  String(row.title || row.description || row.id).slice(0, 60)

async function main() {
  const cards: { table: Table; row: Record<string, unknown> }[] = []
  const tables: Table[] = TRIAGE_EVENTS ? ['events'] : ['events', 'resources']
  for (const table of tables) {
    let query = supabase.from(table).select('*')
    query = TRIAGE_EVENTS
      ? query
          .in('list_id', ['ideas', 'capture', 'review', 'error', 'refine'])
          .not('status', 'in', '(processing,archived)')
      : query.eq('list_id', 'error')
    const { data, error } = await query.order('created_at', {
      ascending: true,
    })
    if (error) throw new Error(`${table}: ${error.message}`)
    for (const row of data ?? []) cards.push({ table, row })
  }

  console.log(
    `${cards.length} card(s) in ${TRIAGE_EVENTS ? 'the Triage table (events)' : 'the Error list'} ` +
      `(${APPLY ? 'SENDING' : 'dry run — pass --apply to send'}):\n`
  )

  let ok = 0
  let failed = 0

  for (const [i, { table, row }] of cards.entries()) {
    const tag = `[${i + 1}/${cards.length}] ${TYPE_BY_TABLE[table]} ${label(row)}`
    if (!APPLY) {
      console.log(`  ${tag}`)
      continue
    }

    const id = row.id as string
    const { error: markError } = await supabase
      .from(table)
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (markError) {
      console.error(
        `  ✗ ${tag} — could not mark processing: ${markError.message}`
      )
      failed++
      continue
    }

    let sent = false
    let detail = ''
    try {
      const res = await fetch(webhookUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Same signing scheme as lib/auth/hmac.ts (direction desk>n8n,
          // subject = activity id).
          ...signHeaders(hmacKey!, String(row.id)),
        },
        body: JSON.stringify({
          ...row,
          type: TYPE_BY_TABLE[table],
          action: 'update',
          use_ai: true,
          file: null,
        }),
      })
      sent = res.ok
      if (!res.ok) detail = `n8n responded ${res.status}`
    } catch (err) {
      detail = err instanceof Error ? err.message : 'request failed'
    }

    if (sent) {
      console.log(`  ✓ ${tag}`)
      ok++
    } else {
      console.error(`  ✗ ${tag} — ${detail}`)
      failed++
      await supabase
        .from(table)
        .update({ status: 'new', updated_at: new Date().toISOString() })
        .eq('id', id)
    }

    if (i < cards.length - 1) await sleep(DELAY_MS)
  }

  if (APPLY) {
    console.log(`\nDone: ${ok} sent, ${failed} failed.`)
    if (ok > 0) {
      console.log(
        'Cards leave the Error list as n8n calls back — reload Desk in a minute or two.'
      )
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
