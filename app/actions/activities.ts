'use server'

import { createAdminClient } from '@/app/utils/supabase/server'
import { DeskActivity, EventActivity, Location, ResourceActivity } from '@/app/types/activity'
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
  data: { description: string; list_id: ListId; status: string; file_url?: string | null }
) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const now = new Date().toISOString()
  const today = now.split('T')[0]
  const description = data.description || ''
  const insert: Record<string, unknown> = {
    id,
    title: description || '(New activity)',
    description,
    newsletter_description: description,
    list_id: data.list_id,
    status: data.status,
    source: 'app_desk',
    ...(data.file_url ? { file_url: data.file_url } : {}),
    created_at: now,
    updated_at: now,
  }
  if (type === 'event') insert.start_date = today
  const { error } = await supabase.from(table).insert(insert)
  if (error) throw new Error(error.message)
}

const EVENT_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'categories',
  'tagline',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'location', 'neighborhood', 'area', 'latitude', 'longitude',
  'start_date', 'end_date', 'start_time', 'end_time', 'day_of_week', 'duration_minutes',
  'repeat_rrule', 'repeat_frequency', 'repeat_next_date', 'calendar_skip', 'calendar_sent',
] as const satisfies readonly (keyof WritableEvent)[]

const RESOURCE_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'categories',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'location', 'neighborhood', 'area', 'latitude', 'longitude',
] as const satisfies readonly (keyof WritableResource)[]

// Only coerce '' → null for non-text DB columns (dates, times, enums, numbers).
// Text NOT NULL columns (title, description, newsletter_description, etc.) must keep ''.
const NULL_COERCE_FIELDS = new Set<keyof WritableEvent | keyof WritableResource>([
  'snooze_until', 'last_triaged_at', 'newsletter_last',
  'start_date', 'end_date', 'start_time', 'end_time',
  'day_of_week', 'duration_minutes',
  'repeat_frequency', 'repeat_next_date',
])

function pickFields(data: Partial<DeskActivity>, fields: readonly string[]) {
  return Object.fromEntries(
    fields
      .filter(f => f in data)
      .map(f => {
        const v = (data as any)[f]
        return [f, v === '' && NULL_COERCE_FIELDS.has(f as keyof WritableEvent) ? null : v]
      })
  )
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
    .update({ status: 'archived', updated_at: new Date().toISOString() })
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

  if (type === 'event') {
    const { frequency, days, untilDate } = parseRrule(normalized.repeat_rrule)
    update.repeat_next_date = frequency
      ? computeNextDate(frequency, days, untilDate, normalized.start_date)
      : null
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

export async function finishNewsletterIssue(
  eventIds: string[],
  resourceIds: string[],
  publishDate: string,
) {
  const supabase = createAdminClient()
  const update = { newsletter_last: publishDate, status: 'archived', updated_at: new Date().toISOString() }
  await Promise.all([
    eventIds.length    ? supabase.from('events').update(update).in('id', eventIds)      : Promise.resolve(),
    resourceIds.length ? supabase.from('resources').update(update).in('id', resourceIds) : Promise.resolve(),
  ])
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

export async function upsertLocation(data: {
  name: string
  address: string
  area: string | null
  neighborhood: string | null
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
