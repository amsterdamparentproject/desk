/**
 * Backfill latitude/longitude for existing events, resources, and locations
 * that have an address but no coordinates.
 *
 * Usage:
 *   npx tsx scripts/backfill-lat-lng.ts
 *
 * Nominatim rate limit: 1 request/second (enforced by 1.1s delay between calls).
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const USER_AGENT = 'AmsterdamParentProject/1.0 (amsterdamparentproject@gmail.com)'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { db: { schema: 'activities' } }
)

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function geocode(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0`
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }
  } catch (err) {
    return null
  }
}

async function backfillTable(table: 'events' | 'resources') {
  const { data: rows, error } = await supabase
    .from(table)
    .select('id, location')
    .not('location', 'is', null)
    .neq('location', '')
    .is('latitude', null)

  if (error) { console.error(`[${table}] fetch error:`, error.message); return }
  if (!rows?.length) { console.log(`[${table}] nothing to backfill`); return }

  console.log(`[${table}] ${rows.length} record(s) to geocode\n`)

  for (const row of rows) {
    if (!row.location) continue
    const coords = await geocode(row.location)
    if (coords) {
      const { error: updateError } = await supabase
        .from(table)
        .update({ ...coords, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      console.log(updateError
        ? `  ✗ ${row.location}\n    ${updateError.message}`
        : `  ✓ ${row.location}\n    → ${coords.latitude}, ${coords.longitude}`)
    } else {
      console.log(`  ? ${row.location}\n    → no result from Nominatim`)
    }
    await sleep(1100)
  }
}

async function backfillLocations() {
  const { data: rows, error } = await supabase
    .from('locations')
    .select('id, address')
    .is('latitude', null)

  if (error) { console.error('[locations] fetch error:', error.message); return }
  if (!rows?.length) { console.log('[locations] nothing to backfill'); return }

  console.log(`[locations] ${rows.length} record(s) to geocode\n`)

  for (const row of rows) {
    const coords = await geocode(row.address)
    if (coords) {
      const { error: updateError } = await supabase
        .from('locations')
        .update({ ...coords, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      console.log(updateError
        ? `  ✗ ${row.address}\n    ${updateError.message}`
        : `  ✓ ${row.address}\n    → ${coords.latitude}, ${coords.longitude}`)
    } else {
      console.log(`  ? ${row.address}\n    → no result from Nominatim`)
    }
    await sleep(1100)
  }
}

async function main() {
  console.log('=== Lat/lng backfill ===\n')
  await backfillLocations()
  console.log()
  await backfillTable('events')
  console.log()
  await backfillTable('resources')
  console.log('\n=== Done ===')
}

main().catch(console.error)
