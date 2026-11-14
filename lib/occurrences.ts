// Multiple dates per event, each with its own optional start/end time.
//
// An event with a non-empty `occurrences` list is a "specific dates" event:
// start_date / end_date / start_time / end_time are kept in sync (first date,
// last date, first date's times) so consumers that only know the single-range
// model keep working. An empty list means the legacy model: start_date through
// end_date with one set of times.
import { addDays } from '@/lib/issue-date'

export interface Occurrence {
  date: string // YYYY-MM-DD
  start_time: string | null // HH:MM
  end_time: string | null // HH:MM
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}/

const cleanTime = (v: unknown): string | null =>
  typeof v === 'string' && TIME_RE.test(v) ? v.slice(0, 5) : null

// Validates, de-duplicates by date (a later entry wins) and sorts by date.
export function normalizeOccurrences(input: unknown): Occurrence[] {
  if (!Array.isArray(input)) return []
  const byDate = new Map<string, Occurrence>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) continue
    byDate.set(r.date, {
      date: r.date,
      start_time: cleanTime(r.start_time),
      end_time: cleanTime(r.end_time),
    })
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

// The single-range columns implied by an occurrence list.
export function rangeFromOccurrences(occ: Occurrence[]): {
  start_date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
} | null {
  if (occ.length === 0) return null
  const first = occ[0]
  const last = occ[occ.length - 1]
  return {
    start_date: first.date,
    end_date: last.date === first.date ? null : last.date,
    start_time: first.start_time,
    end_time: first.end_time,
  }
}

// Every day from start to end inclusive, capped so a typo can't create hundreds.
export function expandRange(start: string, end: string, max = 31): string[] {
  const out: string[] = []
  let d = start
  while (d <= end && out.length < max) {
    out.push(d)
    d = addDays(d, 1)
  }
  return out
}

// Seeds an occurrence list from the legacy range (every day gets the same times).
export function occurrencesFromRange(a: {
  start_date?: string | null
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
}): Occurrence[] {
  if (!a.start_date) return []
  const dates = expandRange(a.start_date, a.end_date || a.start_date)
  return dates.map((date) => ({
    date,
    start_time: cleanTime(a.start_time),
    end_time: cleanTime(a.end_time),
  }))
}

export const hasOccurrences = (a: { occurrences?: unknown }): boolean =>
  Array.isArray(a.occurrences) && a.occurrences.length > 0

// First occurrence on or after `from`, or null if they've all passed.
export function nextOccurrence(
  occ: Occurrence[],
  from: string
): Occurrence | null {
  return occ.find((o) => o.date >= from) ?? null
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

// "3, 10 & 17 Dec" / "28 Nov, 3 & 10 Dec" — compact list of dates.
export function formatOccurrenceDates(occ: Occurrence[]): string {
  const groups: { month: number; days: number[] }[] = []
  for (const { date } of occ) {
    const month = Number(date.slice(5, 7)) - 1
    const day = Number(date.slice(8, 10))
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.days.push(day)
    else groups.push({ month, days: [day] })
  }
  return groups
    .map(({ month, days }) => {
      const head = days.length > 1 ? `${days.slice(0, -1).join(', ')} & ` : ''
      return `${head}${days[days.length - 1]} ${MONTHS[month]}`
    })
    .join(', ')
}
