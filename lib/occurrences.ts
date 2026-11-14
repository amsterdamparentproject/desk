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

// Validates, de-duplicates and sorts by date, then start time. A date can
// appear several times with different start times (same day, several
// sessions); an identical date + start time is a duplicate (a later entry wins).
export function normalizeOccurrences(input: unknown): Occurrence[] {
  if (!Array.isArray(input)) return []
  const byKey = new Map<string, Occurrence>()
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) continue
    const start_time = cleanTime(r.start_time)
    byKey.set(`${r.date}|${start_time ?? ''}`, {
      date: r.date,
      start_time,
      end_time: cleanTime(r.end_time),
    })
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.start_time ?? '').localeCompare(b.start_time ?? '')
  )
}

// The distinct dates of an occurrence list, in order.
export const distinctDates = (occ: Occurrence[]): string[] => [
  ...new Set(occ.map((o) => o.date)),
]

// "10:00–11:30 & 14:00" for the sessions of one day (shared by card and drawer).
export function formatDayTimes(
  occ: Pick<Occurrence, 'start_time' | 'end_time'>[]
): string {
  return occ
    .filter((o) => o.start_time)
    .map((o) => `${o.start_time}${o.end_time ? `–${o.end_time}` : ''}`)
    .join(' & ')
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
  for (const date of distinctDates(occ)) {
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

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayOfWeek = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()
const dayNum = (date: string) => Number(date.slice(8, 10))
const monthName = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1]
const fullDate = (date: string) =>
  `${WEEKDAY_SHORT[dayOfWeek(date)]} ${dayNum(date)} ${monthName(date)}`

// "3-5 Dec" / "28 Nov-2 Dec" for a run of consecutive days.
function rangeText(from: string, to: string): string {
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${dayNum(from)}-${dayNum(to)} ${monthName(to)}`
    : `${dayNum(from)} ${monthName(from)}-${dayNum(to)} ${monthName(to)}`
}

// "Sat 5, 12 & 19 Dec" (all the same weekday) or "Sat 5 Dec, Wed 9 Dec".
function listText(dates: string[]): string {
  if (dates.length === 1) return fullDate(dates[0])
  const sameWeekday = dates.every((d) => dayOfWeek(d) === dayOfWeek(dates[0]))
  if (!sameWeekday) return dates.map(fullDate).join(', ')
  const groups: { month: string; days: number[] }[] = []
  for (const d of dates) {
    const month = monthName(d)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.days.push(dayNum(d))
    else groups.push({ month, days: [dayNum(d)] })
  }
  const text = groups
    .map(({ month, days }) => {
      const head = days.length > 1 ? `${days.slice(0, -1).join(', ')} & ` : ''
      return `${head}${days[days.length - 1]} ${month}`
    })
    .join(', ')
  return `${WEEKDAY_SHORT[dayOfWeek(dates[0])]} ${text}`
}

// Newsletter wording for specific dates. Days that share the same times are
// grouped so the times are written once:
//   3, 4, 5 Dec at 10:00-16:00  -> "3-5 Dec @ 10:00-16:00"
//   5, 12, 19 Dec at 10:00      -> "Sat 5, 12 & 19 Dec @ 10:00"
//   5 Dec (10:00 & 14:00)       -> "Sat 5 Dec @ 10:00 & 14:00"
// Groups with different times are joined with commas, in order of first date.
export function formatNewsletterDates(occ: Occurrence[]): string {
  const sessionsByDate = new Map<string, Occurrence[]>()
  for (const o of occ) {
    sessionsByDate.set(o.date, [...(sessionsByDate.get(o.date) ?? []), o])
  }
  const bySignature = new Map<string, string[]>()
  for (const [date, sessions] of sessionsByDate) {
    const sig = formatDayTimes(sessions).replaceAll('–', '-')
    bySignature.set(sig, [...(bySignature.get(sig) ?? []), date])
  }
  return [...bySignature]
    .map(([sig, dates]) => {
      const runs: string[][] = []
      for (const d of dates) {
        const run = runs[runs.length - 1]
        if (run && addDays(run[run.length - 1], 1) === d) run.push(d)
        else runs.push([d])
      }
      const ranges = runs.filter((r) => r.length > 1)
      const singles = runs.filter((r) => r.length === 1).map((r) => r[0])
      const parts = [
        ...ranges.map((r) => rangeText(r[0], r[r.length - 1])),
        ...(singles.length ? [listText(singles)] : []),
      ]
      return parts.join(', ') + (sig ? ` @ ${sig}` : '')
    })
    .join(', ')
}
