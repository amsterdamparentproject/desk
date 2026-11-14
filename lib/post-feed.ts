// Feed of Post-eligible activities for Postpartum Post (GET /api/post/activities).
// Pure helpers: expand each event into one row per occurrence inside a window.
import type { DeskActivity } from '@/app/types/activity'
import { parseRrule, parsePositionalDay } from '@/app/utils/rrule'
import { addDays } from '@/lib/issue-date'
import { hasOccurrences } from '@/lib/occurrences'

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const
const ABBR = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const MAX_WINDOW_DAYS = 100

export interface FeedSlot {
  date: string
  start_time: string | null
  end_time: string | null
}

// Weekday name for a YYYY-MM-DD date (calendar math, no time zone involved).
export function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

const dowOf = (date: string) => WEEKDAYS.indexOf(weekdayOf(date) as never)

// Day-of-month index (1-based) of this weekday within its month; -1 = last.
function nthInMonth(date: string): { nth: number; last: boolean } {
  const day = Number(date.slice(8, 10))
  const [y, m] = date.split('-').map(Number)
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { nth: Math.floor((day - 1) / 7) + 1, last: day + 7 > dim }
}

// Does an rrule series (anchored at startDate) occur on `date`?
function rruleOccursOn(
  rrule: string,
  startDate: string,
  date: string
): boolean {
  const { frequency, days, untilDate } = parseRrule(rrule)
  if (!frequency || date < startDate) return false
  if (untilDate && date > untilDate) return false
  const dow = dowOf(date)
  const wanted = days.length
    ? days.map((d) => ABBR.indexOf(d)).filter((n) => n >= 0)
    : [dowOf(startDate)]
  if (frequency === 'daily') return true
  if (frequency === 'weekly') return wanted.includes(dow)
  if (frequency === 'biweekly') {
    // Keep the 14-day phase: same week parity as the start date's week (Mon-first).
    const weekIdx = (d: string) => {
      const [y, m, dd] = d.split('-').map(Number)
      const t = Date.UTC(y, m - 1, dd)
      const mondayOffset = (new Date(t).getUTCDay() + 6) % 7
      return Math.floor((t - mondayOffset * 86400000) / (7 * 86400000))
    }
    return (
      wanted.includes(dow) && (weekIdx(date) - weekIdx(startDate)) % 2 === 0
    )
  }
  if (frequency === 'monthly') {
    const pos = days.length ? parsePositionalDay(days[0]) : null
    if (pos) {
      if (ABBR.indexOf(pos.abbr) !== dow) return false
      const { nth, last } = nthInMonth(date)
      return pos.pos === -1 ? last : pos.pos === nth
    }
    return date.slice(8, 10) === startDate.slice(8, 10)
  }
  return false
}

// Every occurrence of `a` with from <= date <= to (inclusive), never before
// `today`. Specific dates and recurring series expand to one slot each; a
// plain range event is one slot starting at the first day inside the window.
export function expandEvent(
  a: Pick<
    DeskActivity,
    | 'start_date'
    | 'end_date'
    | 'start_time'
    | 'end_time'
    | 'repeat_rrule'
    | 'occurrences'
  >,
  from: string,
  to: string,
  today: string
): FeedSlot[] {
  const lo = from > today ? from : today
  if (lo > to) return []

  if (a.repeat_rrule && a.start_date) {
    const out: FeedSlot[] = []
    let d = lo > a.start_date ? lo : a.start_date
    for (let i = 0; d <= to && i <= MAX_WINDOW_DAYS; i++, d = addDays(d, 1)) {
      if (rruleOccursOn(a.repeat_rrule, a.start_date, d)) {
        out.push({
          date: d,
          start_time: a.start_time ?? null,
          end_time: a.end_time ?? null,
        })
      }
    }
    return out
  }
  if (hasOccurrences(a)) {
    return a
      .occurrences!.filter((o) => o.date >= lo && o.date <= to)
      .map((o) => ({
        date: o.date,
        start_time: o.start_time,
        end_time: o.end_time,
      }))
  }
  if (!a.start_date) return []
  const end = a.end_date ?? a.start_date
  if (end < lo || a.start_date > to) return []
  return [
    {
      date: a.start_date > lo ? a.start_date : lo,
      start_time: a.start_time ?? null,
      end_time: a.end_time ?? null,
    },
  ]
}

export const parseDays = (v: string | null): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .filter((s) => (WEEKDAYS as readonly string[]).includes(s))

// Empty list = availability not set = free every day.
export const freeOn = (days: string[], weekday: string): boolean =>
  days.length === 0 || days.includes(weekday)
