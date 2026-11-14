// Pure helpers for the Desk table (Triage tab). No React, no database.
import type { DeskActivity } from '@/app/types/activity'
import type { ListId } from '@/app/types/list'
import { computeNextDate, parseRrule } from '@/app/utils/rrule'

// The Triage table shows everything still in the inbox: captured, parsed,
// waiting until its date is relevant.
export const HELD_LISTS: readonly ListId[] = ['inbox']

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
    a.status === 'failed' ||
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

// Post matches events only. Only refined events reach Post; inbox rows stay in
// Desk until "Done refining".
export function isPostEligible(a: DeskActivity): boolean {
  return (
    a.type === 'event' &&
    a.services.includes('postpartum_post') &&
    a.list_id === 'refined' &&
    a.status !== 'archived'
  )
}

export type PostGroup = 'this' | 'future' | 'recurring'

// Last day of the current month (YYYY-MM-DD) in Amsterdam time. Pure UTC math
// after the zone lookup so server and browser agree (avoids hydration drift).
export function matchMonthEnd(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  return new Date(Date.UTC(y, m, 0)).toISOString().split('T')[0]
}

// Every Post event lands in exactly one group: recurring events live in
// "recurring"; single events are "this" match (due by month end, including
// anything overdue) or "future" (everything later, or undated).
export function postGroup(
  a: {
    repeat_rrule?: string | null
    repeat_next_date?: string | null
    start_date?: string | null
  },
  monthEnd: string
): PostGroup {
  if (a.repeat_rrule) return 'recurring'
  const d = a.repeat_next_date ?? a.start_date ?? null
  return d && d <= monthEnd ? 'this' : 'future'
}
