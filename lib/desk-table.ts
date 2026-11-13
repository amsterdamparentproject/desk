// Pure helpers for the Desk table (Triage tab). No React, no database.
import type { DeskActivity } from '@/app/types/activity'
import type { ListId } from '@/app/types/list'
import { computeNextDate, parseRrule } from '@/app/utils/rrule'

// Everything that used to be split across Capture / To review / Refine /
// Errors is one "held" pool now: captured, parsed, waiting until its date is
// relevant. list_ids stay as they are in the database; only the UI merges them.
export const HELD_LISTS: readonly ListId[] = [
  'ideas',
  'capture',
  'review',
  'error',
  'refine',
]

export type SortKey = 'created' | 'start' | 'title'
export type SortDir = 'asc' | 'desc'
export type TypeFilter = 'all' | 'event' | 'resource'

export const isHeld = (a: Pick<DeskActivity, 'list_id' | 'status'>): boolean =>
  HELD_LISTS.includes(a.list_id) &&
  a.status !== 'archived' &&
  a.status !== 'published'

// A one-off event whose last day is before `today`. Recurring events never
// count as past.
export function isPastEvent(
  a: Pick<
    DeskActivity,
    'type' | 'start_date' | 'end_date' | 'repeat_rrule' | 'repeat_frequency'
  >,
  today: string
): boolean {
  if (a.type !== 'event' || a.repeat_rrule || a.repeat_frequency) return false
  const last = a.end_date || a.start_date
  return !!last && last < today
}

// The date a row sorts and displays by: the next occurrence for recurring
// events, otherwise the start date. Resources have none.
export function effectiveStart(
  a: Pick<
    DeskActivity,
    'type' | 'start_date' | 'repeat_next_date' | 'repeat_rrule'
  >,
  today?: string
): string | null {
  if (a.type === 'resource') return null
  const stored = a.repeat_next_date?.slice(0, 10) || null
  if (a.repeat_rrule) {
    // The stored next date can be missing or stale (the refresh cron hasn't
    // run yet), so recompute rather than fall back to the original date.
    const ref = today ?? new Date().toLocaleDateString('en-CA')
    if (stored && stored >= ref) return stored
    const { frequency, days, untilDate } = parseRrule(a.repeat_rrule)
    const next = computeNextDate(frequency, days, untilDate, a.start_date)
    if (next) return next
  }
  return stored || a.start_date || null
}

export function sortRows(
  rows: DeskActivity[],
  key: SortKey,
  dir: SortDir
): DeskActivity[] {
  const sign = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'title') {
      return (
        sign *
        (a.title || '').localeCompare(b.title || '', undefined, {
          sensitivity: 'base',
        })
      )
    }
    if (key === 'start') {
      const sa = effectiveStart(a)
      const sb = effectiveStart(b)
      // Rows without a date (resources) always sit at the bottom, whatever the
      // direction, so sorting by date never buries the dated rows.
      if (!sa && !sb) return a.created_at < b.created_at ? 1 : -1
      if (!sa) return 1
      if (!sb) return -1
      return sa === sb ? 0 : sign * (sa < sb ? -1 : 1)
    }
    return a.created_at === b.created_at
      ? 0
      : sign * (a.created_at < b.created_at ? -1 : 1)
  })
}

// Anything that needs a look: a failed parse, or an event whose date has passed.
export function needsAttention(a: DeskActivity, today?: string): boolean {
  return (
    a.list_id === 'error' ||
    !!a.parse_error ||
    (today !== undefined && isPastEvent(a, today))
  )
}

export function filterRows(
  rows: DeskActivity[],
  opts: {
    type: TypeFilter
    query: string
    onlyProblems: boolean
    today?: string
  }
): DeskActivity[] {
  const q = opts.query.trim().toLowerCase()
  return rows.filter((a) => {
    if (opts.type !== 'all' && a.type !== opts.type) return false
    if (opts.onlyProblems && !needsAttention(a, opts.today)) return false
    if (!q) return true
    return [a.title, a.organization, a.description, a.url, a.neighborhood]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  })
}

// Post matches events only. Held events count as soon as they are parsed
// (not still processing, not failed), so nothing has to be "promoted" first.
export function isPostEligible(a: DeskActivity): boolean {
  if (a.type !== 'event' || !a.services.includes('postpartum_post')) {
    return false
  }
  if (a.status === 'archived') return false
  // Only refined events reach Post. Held rows stay in Desk until "Done refining".
  return a.list_id === 'upcoming_events' || a.list_id === 'next_newsletter'
}
