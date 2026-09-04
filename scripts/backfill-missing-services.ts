/**
 * Backfill `services` for events and resources that have no service tagged
 * at all — the "lost events" bug: with services = '{}', a row is invisible
 * in both the Newsletter and Post tabs (both are filtered by
 * services.includes(...)), whether it's still being triaged or already
 * accepted and sitting in Upcoming.
 *
 * Scope:
 *   - events: every list_id except 'gone' (Capture/Review/Refine included,
 *     not just Upcoming/Next newsletter) + services = '{}' + start_date >= today
 *   - resources: every list_id except 'gone' + services = '{}' — no date
 *     filter, since resources have no start_date column
 *   - 'gone' is excluded on purpose — those items already exited the
 *     pipeline (rejected or aged out) and shouldn't be reactivated by this
 *
 * Sets:
 *   - events    → services = ['newsletter', 'postpartum_post'], postpartum_post = true
 *   - resources → services = ['newsletter'] only, postpartum_post = false —
 *     resources are never eligible for Post (013_resources_never_in_post.sql):
 *     the Postpartum Post matcher only queries events, locations, and playgrounds.
 *
 * Matches the app's own default (see 014_default_services_on.sql) — this is
 * a one-time catch-up for rows created before that default (and the
 * matching app-level seeding fix) existed.
 *
 * Usage:
 *   npx tsx scripts/backfill-missing-services.ts            # dry run — lists what would change
 *   npx tsx scripts/backfill-missing-services.ts --apply     # actually writes the update
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const APPLY = process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'activities' } }
)

// Every list_id except 'gone' — the unified resting place for anything that
// has exited the active pipeline (rejected at triage, dropped from an
// issue, or published). Not every list_id applies to both tables (e.g.
// resources never use 'upcoming_events'), which is harmless here — the
// filter just won't match rows that can't exist with that combination.
const NON_GONE_LISTS = ['ideas', 'capture', 'review', 'error', 'refine', 'upcoming_events', 'new_resources', 'next_newsletter']

async function backfillEvents(today: string) {
  console.log(`--- events (start_date >= ${today}) ---`)

  const { data: rows, error } = await supabase
    .from('events')
    .select('id, title, start_date, list_id, status')
    .filter('services', 'eq', '{}')
    .in('list_id', NON_GONE_LISTS)
    .gte('start_date', today)
    .order('start_date', { ascending: true })

  if (error) { console.error('Fetch error:', error.message); return }
  if (!rows?.length) { console.log('Nothing to backfill.\n'); return }

  console.log(`${rows.length} event(s) matched:\n`)
  for (const row of rows) {
    console.log(`  ${row.start_date}  [${row.list_id}/${row.status}]  ${row.title}  (${row.id})`)
  }

  if (!APPLY) { console.log('\nDry run only — no changes written.\n'); return }

  console.log('\nApplying...\n')
  let ok = 0, failed = 0
  for (const row of rows) {
    const { error: updateError } = await supabase
      .from('events')
      .update({ services: ['newsletter', 'postpartum_post'], postpartum_post: true, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (updateError) { failed++; console.log(`  ✗ ${row.title}\n    ${updateError.message}`) }
    else { ok++; console.log(`  ✓ ${row.title}`) }
  }
  console.log(`\nevents: ${ok} updated, ${failed} failed\n`)
}

async function backfillResources() {
  console.log('--- resources (no date filter) ---')

  const { data: rows, error } = await supabase
    .from('resources')
    .select('id, title, list_id, status')
    .filter('services', 'eq', '{}')
    .in('list_id', NON_GONE_LISTS)
    .order('title', { ascending: true })

  if (error) { console.error('Fetch error:', error.message); return }
  if (!rows?.length) { console.log('Nothing to backfill.\n'); return }

  console.log(`${rows.length} resource(s) matched:\n`)
  for (const row of rows) {
    console.log(`  [${row.list_id}/${row.status}]  ${row.title}  (${row.id})`)
  }

  if (!APPLY) { console.log('\nDry run only — no changes written.\n'); return }

  console.log('\nApplying...\n')
  let ok = 0, failed = 0
  for (const row of rows) {
    const { error: updateError } = await supabase
      .from('resources')
      .update({ services: ['newsletter'], postpartum_post: false, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (updateError) { failed++; console.log(`  ✗ ${row.title}\n    ${updateError.message}`) }
    else { ok++; console.log(`  ✓ ${row.title}`) }
  }
  console.log(`\nresources: ${ok} updated, ${failed} failed\n`)
}

async function main() {
  const today = new Date().toISOString().split('T')[0]
  console.log('=== Backfill missing services ===')
  console.log(APPLY ? 'Mode: APPLY (writing changes)\n' : 'Mode: DRY RUN (pass --apply to write)\n')

  await backfillEvents(today)
  await backfillResources()

  console.log('=== Done ===')
}

main().catch(console.error)
