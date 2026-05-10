'use server'

import { createAdminClient } from '@/app/utils/supabase/server'
import { DeskActivity } from '@/app/types/activity'
import { ListId } from '@/app/types/list'
import { parseRrule, computeNextDate } from '@/app/utils/rrule'

const EVENT_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'categories',
  'tagline',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'location', 'neighborhood', 'area',
  'start_date', 'end_date', 'start_time', 'end_time', 'day_of_week', 'duration_minutes',
  'repeat_rrule', 'repeat_frequency', 'repeat_next_date', 'calendar_skip', 'calendar_sent',
] as const

const RESOURCE_FIELDS = [
  'list_id', 'status', 'source', 'snooze_until', 'last_triaged_at', 'triage_notes', 'file_url',
  'title', 'description', 'url', 'organization', 'age_range', 'categories',
  'newsletter_description', 'newsletter_last', 'newsletter_highlight',
  'location', 'neighborhood', 'area',
] as const

function pickFields(data: Partial<DeskActivity>, fields: readonly string[]) {
  return Object.fromEntries(
    fields
      .filter(f => f in data)
      .map(f => {
        const v = (data as any)[f]
        // Postgres rejects "" for date/time/numeric/enum columns — coerce to null
        return [f, v === '' ? null : v]
      })
  )
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

export async function moveActivity(id: string, type: 'event' | 'resource', list_id: ListId) {
  const supabase = createAdminClient()
  const table = type === 'event' ? 'events' : 'resources'
  const { error } = await supabase
    .from(table)
    .update({ list_id, updated_at: new Date().toISOString() })
    .eq('id', id)
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
