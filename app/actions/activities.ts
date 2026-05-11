'use server'

import { createAdminClient } from '@/app/utils/supabase/server'
import { DeskActivity, EventActivity, ResourceActivity } from '@/app/types/activity'
import { ListId } from '@/app/types/list'
import { parseRrule, computeNextDate } from '@/app/utils/rrule'

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
  console.log('[createActivity] table:', table, 'type:', type, 'id:', id)
  const { error } = await supabase.from(table).insert(insert)
  if (error) throw new Error(error.message)
}

const EVENT_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'categories',
  'tagline',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'location', 'neighborhood', 'area',
  'start_date', 'end_date', 'start_time', 'end_time', 'day_of_week', 'duration_minutes',
  'repeat_rrule', 'repeat_frequency', 'repeat_next_date', 'calendar_skip', 'calendar_sent',
] as const satisfies readonly (keyof WritableEvent)[]

const RESOURCE_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'categories',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'location', 'neighborhood', 'area',
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

export async function moveActivity(id: string, type: 'event' | 'resource', list_id: ListId, status?: string) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const update: Record<string, any> = { list_id, updated_at: new Date().toISOString() }
  if (status) update.status = status
  const { error } = await supabase.from(table).update(update).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function saveActivity(id: string, type: 'event' | 'resource', data: Partial<DeskActivity>) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const fields = type === 'event' ? EVENT_FIELDS : RESOURCE_FIELDS
  const update: Record<string, any> = {
    ...pickFields(data, fields),
    updated_at: new Date().toISOString(),
  }

  if (type === 'event') {
    const { frequency, days, untilDate } = parseRrule(data.repeat_rrule)
    update.repeat_next_date = frequency
      ? computeNextDate(frequency, days, untilDate, data.start_date)
      : null
  }

  const { error } = await supabase.from(table).update(update).eq('id', id)
  if (error) throw new Error(error.message)
}
