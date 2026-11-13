import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/app/utils/supabase/server'
import { failurePatch } from './sweep'
import type { ActivityType } from './schema'

// Server-only helpers for recording how an AI parse went. Deliberately NOT a
// 'use server' file, so none of this is exposed as a callable Server Action.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export const tableFor = (type: ActivityType) =>
  type === 'event' ? 'events' : 'resources'

export interface FoundActivity {
  type: ActivityType
  list_id: string
  status: string
  file_url: string | null
}

/**
 * Finds which table a record really lives in. The callback must trust this,
 * not the `type` the AI reports: if the AI calls an event a "resource", an
 * update against the wrong table matches zero rows and the card sits in
 * "Processing" forever.
 */
export async function resolveActivity(
  id: string,
  supabase: AnyClient = createAdminClient()
): Promise<FoundActivity | null> {
  for (const type of ['event', 'resource'] as const) {
    const { data } = await supabase
      .from(tableFor(type))
      .select('list_id, status, file_url')
      .eq('id', id)
      .maybeSingle()
    if (data) {
      return {
        type,
        list_id: data.list_id,
        status: data.status,
        file_url: data.file_url ?? null,
      }
    }
  }
  return null
}

export interface ParseOutcome {
  error: string | null
  warnings: string[]
  raw?: unknown
}

/**
 * Writes parse_error / parse_warnings / parse_raw (migration 015). If that
 * migration has not been run yet, retries without those columns so a deploy
 * that lands before the migration degrades gracefully instead of breaking
 * every callback.
 */
export async function updateWithParseColumns(
  table: 'events' | 'resources',
  id: string,
  patch: Record<string, unknown>,
  outcome: ParseOutcome,
  supabase: AnyClient = createAdminClient()
): Promise<void> {
  const withCols = {
    ...patch,
    parse_error: outcome.error,
    parse_warnings: outcome.warnings,
    parse_raw: outcome.raw ?? null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from(table).update(withCols).eq('id', id)
  if (!error) return
  if (/parse_(error|warnings|raw)/.test(error.message)) {
    const { error: retryError } = await supabase
      .from(table)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (retryError) throw new Error(retryError.message)
    return
  }
  throw new Error(error.message)
}

/** Moves a card out of "processing" after a failed / timed-out parse. */
export async function recordParseFailure(
  found: FoundActivity,
  id: string,
  message: string,
  raw?: unknown
): Promise<void> {
  await updateWithParseColumns(
    tableFor(found.type),
    id,
    failurePatch(found.list_id),
    { error: message, warnings: [], raw }
  )
}

interface DupKey {
  id: string
  title?: string
  start_date?: string
  start_time?: string | null
  url?: string | null
}

/**
 * Other cards that look like the same event. The database's unique constraint
 * on (title, start_date, start_time, url) cannot catch these when url or
 * start_time is NULL (Postgres treats NULLs as distinct), so check here.
 */
export async function findDuplicates(
  type: ActivityType,
  key: DupKey,
  supabase: AnyClient = createAdminClient()
): Promise<{ id: string; title: string; list_id: string }[]> {
  if (type !== 'event' || !key.title || !key.start_date) return []
  const { data } = await supabase
    .from('events')
    .select('id, title, list_id, start_time, url')
    .eq('title', key.title)
    .eq('start_date', key.start_date)
    .neq('id', key.id)
  return (data ?? []).filter(
    (row) =>
      (row.start_time ?? null) === (key.start_time ?? null) &&
      (row.url ?? null) === (key.url ?? null)
  )
}
