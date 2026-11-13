// Converting an activity between the two tables (events <-> resources).
// Pure row transformation; the server action in app/actions/activities.ts
// does the insert + delete. Nothing here touches the database.

type Row = Record<string, unknown>
export type ActivityKind = 'event' | 'resource'

// Columns that only exist on events.
const EVENT_ONLY = [
  'start_date',
  'end_date',
  'start_time',
  'end_time',
  'day_of_week',
  'duration_minutes',
  'repeat_rrule',
  'repeat_frequency',
  'repeat_next_date',
  'tagline',
  'calendar_skip',
  'calendar_sent',
] as const

const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null

// One line that keeps the old schedule visible after an event becomes a
// resource, so converting never silently destroys information.
export function describeSchedule(row: Row): string | null {
  const start = asString(row.start_date)
  if (!start) return null
  const end = asString(row.end_date)
  const from = asString(row.start_time)?.slice(0, 5)
  const to = asString(row.end_time)?.slice(0, 5)
  const rrule = asString(row.repeat_rrule)
  let text = `Was an event: ${start}`
  if (end && end !== start) text += ` to ${end}`
  if (from) text += ` ${from}${to ? `–${to}` : ''}`
  if (rrule) text += ` (repeats: ${rrule})`
  return text
}

export function convertRow(
  row: Row,
  to: ActivityKind,
  today: string,
  now: string = new Date().toISOString()
): { insert: Row; patch: Row } {
  const listId = row.list_id as string

  if (to === 'resource') {
    const services = (
      Array.isArray(row.services) ? (row.services as string[]) : []
    ).filter((s) => s !== 'postpartum_post')
    const note = describeSchedule(row)
    const existingNotes = asString(row.triage_notes)
    const patch: Row = {
      list_id: listId === 'upcoming_events' ? 'new_resources' : listId,
      // Post never takes resources (013_resources_never_in_post.sql).
      services: services.length > 0 ? services : ['newsletter'],
      postpartum_post: false,
      triage_notes: [existingNotes, note].filter(Boolean).join('\n') || null,
      updated_at: now,
    }
    const insert: Row = { ...row, ...patch }
    for (const col of EVENT_ONLY) delete insert[col]
    return { insert, patch }
  }

  const patch: Row = {
    list_id: listId === 'new_resources' ? 'upcoming_events' : listId,
    // Placeholder so the NOT NULL column is satisfied; the card is flagged so
    // the real date gets set.
    start_date: today,
    updated_at: now,
  }
  const insert: Row = { ...row, ...patch }
  if (Array.isArray(row.parse_warnings)) {
    const warnings = [
      ...(row.parse_warnings as string[]),
      'Converted from a resource. Set the real date and time.',
    ]
    insert.parse_warnings = warnings
    patch.parse_warnings = warnings
  }
  return { insert, patch }
}
