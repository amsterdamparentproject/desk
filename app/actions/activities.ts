'use server'

import { createAdminClient } from '@/app/utils/supabase/server'
import { DeskActivity, EventActivity, Location, ResourceActivity, Service } from '@/app/types/activity'
import { ListId } from '@/app/types/list'
import { parseRrule, computeNextDate } from '@/app/utils/rrule'
import { postDesk } from '@/lib/PostToWebhook'
import { geocodeAddress } from '@/app/utils/geocode'

type WritableEvent    = Omit<EventActivity,    'id' | 'created_at' | 'updated_at'>
type WritableResource = Omit<ResourceActivity, 'id' | 'created_at' | 'updated_at'>

export async function uploadActivityFile(id: string, file: File): Promise<string> {
  const supabase = createAdminClient()
  const path = `${id}/${file.name}`
  const { error } = await supabase.storage
    .from('activities')
    .upload(path, file, { contentType: file.type, upsert: true })
  if (error) throw new Error(error.message)
  return supabase.storage.from('activities').getPublicUrl(path).data.publicUrl
}

export async function captureFromShare(data: {
  title: string
  description: string
  url: string
  type: 'event' | 'resource'
  use_ai: boolean
  id?: string
  file_url?: string
}) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const id = data.id ?? crypto.randomUUID()
  const list_id: ListId = data.use_ai ? 'ideas' : 'review'
  const status = data.use_ai ? 'processing' : 'new'
  const table = data.type === 'event' ? 'events' : 'resources'

  const insert: Record<string, unknown> = {
    id,
    title: data.title || data.url || data.description.trim() || '(Shared content)',
    description: data.description,
    newsletter_description: '',
    url: data.url || null,
    list_id,
    status,
    source: 'app_desk',
    created_at: now,
    updated_at: now,
    ...(data.file_url ? { file_url: data.file_url } : {}),
  }
  if (data.type === 'event') insert.start_date = today

  const { error } = await supabase.from(table).insert(insert)
  if (error) throw new Error(error.message)

  if (data.use_ai) {
    await postDesk({
      description: data.description,
      file: null,
      list_id,
      use_ai: true,
      type: data.type,
      id,
      action: 'add',
    }).catch(err => console.error('Share webhook failed:', err))
  }

  return id
}

export async function createActivity(
  id: string,
  type: 'event' | 'resource',
  data: { description: string; list_id: ListId; status: string; file_url?: string | null; services?: Service[]; title?: string }
) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const description = data.description || ''
  const insert: Record<string, unknown> = {
    id,
    title: data.title || description || '(New activity)',
    description,
    newsletter_description: description,
    list_id: data.list_id,
    status: data.status,
    source: 'app_desk',
    ...(data.file_url ? { file_url: data.file_url } : {}),
    // Items seeded directly into Upcoming (bypassing the Refine promotion that
    // normally sets this) need services set up front, and postpartum_post kept
    // in sync since the separate Post repo reads that boolean directly. An
    // empty/omitted array here is a no-op — it must not clobber the DB's
    // default postpartum_post value for ordinary Capture/Review records.
    ...(data.services && data.services.length > 0
      ? { services: data.services, postpartum_post: data.services.includes('postpartum_post') }
      : {}),
    created_at: now,
    updated_at: now,
  }
  if (type === 'event') insert.start_date = today
  const { error } = await supabase.from(table).insert(insert)
  if (error) throw new Error(error.message)
}

const EVENT_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'age_categories', 'categories',
  'tagline',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'postpartum_post', 'services',
  'location', 'neighborhood', 'area', 'latitude', 'longitude',
  'start_date', 'end_date', 'start_time', 'end_time', 'day_of_week', 'duration_minutes',
  'repeat_rrule', 'repeat_frequency', 'repeat_next_date', 'calendar_skip', 'calendar_sent',
] as const satisfies readonly (keyof WritableEvent)[]

const RESOURCE_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'age_categories', 'categories',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'postpartum_post', 'services',
  'location', 'neighborhood', 'area', 'latitude', 'longitude',
] as const satisfies readonly (keyof WritableResource)[]

// Only coerce '' → null for non-text DB columns (dates, times, enums, numbers).
// Text NOT NULL columns (title, description, newsletter_description, etc.) must keep ''.
const NULL_COERCE_FIELDS = new Set<keyof WritableEvent | keyof WritableResource>([
  'snooze_until', 'last_triaged_at', 'newsletter_last',
  'end_date', 'start_time', 'end_time',
  'day_of_week', 'duration_minutes',
  'repeat_frequency', 'repeat_next_date',
])

// events.start_date is NOT NULL DEFAULT CURRENT_DATE — unlike the other date
// columns above, it can never be written as '' or null. If a caller sends an
// empty value (e.g. stale client state, or a cleared date field mid-edit),
// drop the field entirely rather than coercing it — leaves the existing DB
// value untouched instead of violating the not-null constraint.
const REQUIRED_NON_NULL_FIELDS = new Set<keyof WritableEvent | keyof WritableResource>([
  'start_date',
])

function pickFields(data: Partial<DeskActivity>, fields: readonly string[]) {
  return Object.fromEntries(
    fields
      .filter(f => f in data)
      .filter(f => !(REQUIRED_NON_NULL_FIELDS.has(f as keyof WritableEvent) && !(data as any)[f]))
      .map(f => {
        const v = (data as any)[f]
        return [f, v === '' && NULL_COERCE_FIELDS.has(f as keyof WritableEvent) ? null : v]
      })
  )
}

// Used by the callback route for additional events returned by the AI (rest items).
// A single upsert replaces the create+save two-step, and ignoreDuplicates prevents
// re-runs from creating duplicate records.
export async function upsertEnrichedActivity(
  id: string,
  type: 'event' | 'resource',
  data: Partial<DeskActivity> & { description: string; list_id: ListId; status: string }
) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const fields = type === 'event' ? EVENT_FIELDS : RESOURCE_FIELDS
  const now = new Date().toISOString()

  const normalized = data.repeat_frequency
    ? { ...data, repeat_frequency: data.repeat_frequency.toLowerCase() as DeskActivity['repeat_frequency'] }
    : data

  const insert: Record<string, unknown> = {
    id,
    title: normalized.title || normalized.description || '(New activity)',
    description: normalized.description,
    newsletter_description: normalized.newsletter_description ?? normalized.description,
    source: 'app_desk',
    created_at: now,
    updated_at: now,
    ...pickFields(normalized, fields as readonly string[]),
  }

  if (type === 'event') {
    const { frequency, days, untilDate } = parseRrule(normalized.repeat_rrule)
    insert.repeat_next_date = frequency
      ? computeNextDate(frequency, days, untilDate, normalized.start_date)
      : null
  }

  const { error } = await supabase
    .from(table)
    .upsert(insert, { onConflict: 'title,start_date,start_time,url', ignoreDuplicates: true })

  if (error) throw new Error(error.message)

  if (data.location && data.latitude == null) {
    const coords = await geocodeAddress(data.location)
    if (coords) {
      await supabase.from(table)
        .update({ ...coords, updated_at: now })
        .eq('id', id)
    }
  }
}

export async function deleteActivity(id: string, type: 'event' | 'resource') {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'

  // Fetch file_url before deleting so we can clean up storage
  const { data: record } = await supabase.from(table).select('file_url').eq('id', id).single()
  if (record?.file_url) {
    // Extract the storage path from the URL: everything after "/activities/"
    const match = record.file_url.match(/\/activities\/(.+?)(\?|$)/)
    if (match?.[1]) {
      await supabase.storage.from('activities').remove([decodeURIComponent(match[1])])
    }
  }

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function archiveActivity(id: string, type: 'event' | 'resource') {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const { error } = await supabase
    .from(table)
    .update({ status: 'archived', list_id: 'gone', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function moveActivity(
  id: string,
  type: 'event' | 'resource',
  list_id: ListId,
  status?: string,
  newsletter_last?: string | null,
) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const update: Record<string, any> = { list_id, updated_at: new Date().toISOString() }
  if (status !== undefined) update.status = status
  if (newsletter_last !== undefined) update.newsletter_last = newsletter_last
  const { error } = await supabase.from(table).update(update).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveActivity(id: string, type: 'event' | 'resource', data: Partial<DeskActivity>) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const fields = type === 'event' ? EVENT_FIELDS : RESOURCE_FIELDS
  const normalized = data.repeat_frequency
    ? { ...data, repeat_frequency: data.repeat_frequency.toLowerCase() as DeskActivity['repeat_frequency'] }
    : data
  const update: Record<string, any> = {
    ...pickFields(normalized, fields),
    updated_at: new Date().toISOString(),
  }

  // Keep postpartum_post synced with services — additive, since the separate
  // Post repo reads the boolean directly. Whichever one the caller wrote wins;
  // if only the boolean was written, derive services from the current row
  // rather than clobbering any 'newsletter' tag already sitting on it.
  if ('services' in update && Array.isArray(update.services)) {
    update.postpartum_post = update.services.includes('postpartum_post')
  } else if ('postpartum_post' in update) {
    const { data: current } = await supabase.from(table).select('services').eq('id', id).single()
    const currentServices: string[] = current?.services ?? []
    update.services = update.postpartum_post
      ? Array.from(new Set([...currentServices, 'postpartum_post']))
      : currentServices.filter((s: string) => s !== 'postpartum_post')
  }

  const { error } = await supabase.from(table).update(update).eq('id', id)
  if (error) throw new Error(error.message)

  // Geocode if address is present but lat/lng is missing on this record
  if (data.location && data.latitude == null) {
    const { data: current } = await supabase
      .from(table).select('latitude').eq('id', id).single()
    if (!current?.latitude) {
      const coords = await geocodeAddress(data.location)
      if (coords) {
        await supabase.from(table)
          .update({ ...coords, updated_at: new Date().toISOString() })
          .eq('id', id)
        // Also update the matching locations record if it has no lat/lng yet
        if (data.organization) {
          await supabase.from('locations')
            .update({ ...coords, updated_at: new Date().toISOString() })
            .eq('name', data.organization)
            .is('latitude', null)
        }
      }
    }
  }
}

// Stages an item is considered still "fresh" in — a callback landing on one of
// these is safe to route into review/processed. Anything already promoted past
// this (upcoming_events, new_resources, next_newsletter, gone) must NOT be
// silently reset — a stray re-processing callback (e.g. "Send to AI" on an
// already-triaged card) would otherwise yank it back to Triage.
const TRIAGE_STAGE_LISTS = new Set<ListId>(['ideas', 'capture', 'review', 'error'])

// Used by the n8n callback route when enrichment finishes for the *first* item
// in a payload (the seed record the user actually captured/resent). Only forces
// list_id: 'review', status: 'processed' if the record hasn't already advanced
// past Triage — otherwise it just updates content fields in place.
export async function saveEnrichedCallback(
  id: string,
  type: 'event' | 'resource',
  data: Partial<DeskActivity>,
) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const { data: existing } = await supabase.from(table).select('list_id').eq('id', id).single()
  const isFreshCapture = !existing || TRIAGE_STAGE_LISTS.has(existing.list_id as ListId)

  await saveActivity(id, type, {
    ...data,
    ...(isFreshCapture ? { list_id: 'review' as ListId, status: 'processed' as const } : {}),
  })
}

// Drops a single service from an activity's services tag (e.g. "not this
// newsletter issue", without touching status — it wasn't published or
// rejected, just no longer a candidate for that service). Only moves to
// 'gone' once no services remain; postpartum_post stays synced throughout.
export async function dropService(id: string, type: 'event' | 'resource', service: Service) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const { data: row } = await supabase.from(table).select('services').eq('id', id).single()
  const nextServices = ((row?.services ?? []) as string[]).filter(s => s !== service)
  const becameEmpty = nextServices.length === 0
  const update: Record<string, any> = {
    services: nextServices,
    postpartum_post: nextServices.includes('postpartum_post'),
    updated_at: new Date().toISOString(),
  }
  if (becameEmpty) update.list_id = 'gone'
  const { error } = await supabase.from(table).update(update).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function finishNewsletterIssue(
  eventIds: string[],
  resourceIds: string[],
  publishDate: string,
) {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // A service's edition running an item drops it from services (like any
  // other service exit) — status: 'published' always gets stamped since it
  // *did* go out. If no services remain, list_id moves to 'gone'. If it's
  // still tagged postpartum_post, list_id moves back to the Upcoming stage
  // (upcoming_events/new_resources) rather than staying at 'next_newsletter'
  // — otherwise it's still "relevant for Post" by services/status alone but
  // invisible everywhere, since Post's Match/Upcoming panels require
  // list_id === 'upcoming_events'.
  const upcomingListFor = (table: 'events' | 'resources') =>
    table === 'events' ? 'upcoming_events' : 'new_resources'
  const applyToTable = async (table: 'events' | 'resources', ids: string[]) => {
    if (!ids.length) return
    const { data: rows } = await supabase.from(table).select('id, services').in('id', ids)
    await Promise.all((rows ?? []).map(row => {
      const nextServices = ((row.services ?? []) as string[]).filter(s => s !== 'newsletter')
      const becameEmpty = nextServices.length === 0
      return supabase.from(table).update({
        newsletter_last: publishDate,
        status: 'published',
        services: nextServices,
        postpartum_post: nextServices.includes('postpartum_post'),
        list_id: becameEmpty ? 'gone' : upcomingListFor(table),
        updated_at: now,
      }).eq('id', row.id)
    }))
  }

  await Promise.all([
    applyToTable('events', eventIds),
    applyToTable('resources', resourceIds),
  ])
}

// Non-recurring events left sitting in 'upcoming_events' whose date has already
// passed by the time an issue is finished — they were never promoted to
// next_newsletter and the event already happened. Drops 'newsletter' from
// services (status untouched — they weren't rejected or published, just aged
// out); only moves to 'gone' if no services remain.
export async function sweepStaleUpcoming(ids: string[]) {
  if (!ids.length) return
  const supabase = createAdminClient()
  const { data: rows } = await supabase.from('events').select('id, services').in('id', ids)
  await Promise.all((rows ?? []).map(row => {
    const nextServices = ((row.services ?? []) as string[]).filter(s => s !== 'newsletter')
    const becameEmpty = nextServices.length === 0
    return supabase.from('events').update({
      services: nextServices,
      postpartum_post: nextServices.includes('postpartum_post'),
      ...(becameEmpty ? { list_id: 'gone' } : {}),
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
  }))
}

export async function stampNewsletterLast(
  eventIds: string[],
  resourceIds: string[],
  date: string,
) {
  const supabase = createAdminClient()
  const update = { newsletter_last: date, updated_at: new Date().toISOString() }
  await Promise.all([
    eventIds.length    ? supabase.from('events').update(update).in('id', eventIds)      : Promise.resolve(),
    resourceIds.length ? supabase.from('resources').update(update).in('id', resourceIds) : Promise.resolve(),
  ])
}

export async function pollForUpdates(
  processing: { id: string; type: 'event' | 'resource'; created_at: string }[]
): Promise<DeskActivity[]> {
  if (processing.length === 0) return []
  const supabase = createAdminClient()

  const eventIds = processing.filter(p => p.type === 'event').map(p => p.id)
  const resourceIds = processing.filter(p => p.type === 'resource').map(p => p.id)
  const since = processing.reduce((min, p) => p.created_at < min ? p.created_at : min, processing[0].created_at)

  const [eventsById, resourcesById, recentEvents, recentResources] = await Promise.all([
    eventIds.length ? supabase.from('events').select('*').in('id', eventIds) : Promise.resolve({ data: [] as any[] }),
    resourceIds.length ? supabase.from('resources').select('*').in('id', resourceIds) : Promise.resolve({ data: [] as any[] }),
    supabase.from('events').select('*').eq('list_id', 'review').gte('created_at', since),
    supabase.from('resources').select('*').eq('list_id', 'review').gte('created_at', since),
  ])

  const seen = new Set<string>()
  const results: DeskActivity[] = []

  for (const row of [...(eventsById.data ?? []), ...(recentEvents.data ?? [])]) {
    if (!seen.has(row.id)) { seen.add(row.id); results.push({ ...row, type: 'event' as const, file: null, preview_url: null }) }
  }
  for (const row of [...(resourcesById.data ?? []), ...(recentResources.data ?? [])]) {
    if (!seen.has(row.id)) { seen.add(row.id); results.push({ ...row, type: 'resource' as const, file: null, preview_url: null }) }
  }
  return results
}

export async function getLocations(): Promise<Location[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('locations').select('*').order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createLocation(data: {
  name: string
  address: string
  area?: string | null
  neighborhood?: string | null
}): Promise<Location> {
  const supabase = createAdminClient()
  const coords = await geocodeAddress(data.address)
  // Locations skip the events/resources Capture inbox entirely (no AI processing —
  // they're typed straight in) and land directly in Review. postpartum_post
  // defaults true: unlike events/resources, a location has no 'services' array or
  // expiry — it's a single-service, evergreen record, so "in Post" is the default
  // assumption until Refine decides otherwise.
  const { data: row, error } = await supabase
    .from('locations')
    .insert({ ...data, ...(coords ?? {}), list_id: 'review', status: 'new', postpartum_post: true })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return row
}

export async function updateLocation(id: string, data: Partial<Omit<Location, 'id'>>): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('locations')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Locations have their own, simpler lifecycle than events/resources — no
// 'services' array, no expiry, and no archived state at all: a location is
// either accepted (settled, one way or the other) or hard-deleted.
//   Review -> Refine -> Gone (postpartum_post true = "In Post", false = "Not in Post")

// Review -> Refine: confirmed good, still needs data polishing.
export async function advanceLocation(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('locations')
    .update({ list_id: 'refine', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Refine -> Gone: the postpartum_post boolean itself is what splits "In Post"
// from "Not in Post" within Gone — list_id is the same either way.
export async function decideLocationPost(id: string, inPost: boolean): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('locations')
    .update({ list_id: 'gone', status: 'accepted', postpartum_post: inPost, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// No archived state for locations — rejecting one means deleting it outright.
export async function deleteLocation(id: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function upsertLocation(data: {
  name: string
  address: string
  area: string | null
  neighborhood: string | null
  url?: string | null
  description?: string | null
  categories?: string[]
  postpartum_post?: boolean
}): Promise<Location> {
  const supabase = createAdminClient()
  const coords = await geocodeAddress(data.address)
  const { data: row, error } = await supabase
    .from('locations')
    .upsert({ ...data, ...(coords ?? {}), updated_at: new Date().toISOString() }, { onConflict: 'name' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return row
}
