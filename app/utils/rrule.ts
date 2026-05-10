// RRULE format: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260601"
// Monthly positional: "RRULE:FREQ=MONTHLY;BYDAY=1MO" (1st Monday), "-1FR" (last Friday)

export type RruleFrequency = 'daily' | 'weekly' | 'monthly'

export interface ParsedRrule {
  frequency: RruleFrequency | null
  days: string[]       // RRULE day abbreviations, possibly positional: "MO", "1MO", "-1FR"
  untilDate: string    // YYYY-MM-DD or ''
}

// Parse 'YYYY-MM-DD' as local midnight (avoids UTC-offset date shifting)
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Format a local Date to 'YYYY-MM-DD'
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Maps JS getDay() (0=Sun) to RRULE abbreviations
const ABBR_TO_JS_DAY: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
}
const FREQ_MAP: Record<string, RruleFrequency> = {
  DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly',
}

// Parses a positional BYDAY token like "1MO" or "-1FR" into { pos, abbr }.
// Returns null for plain day abbreviations like "MO".
export function parsePositionalDay(day: string): { pos: number; abbr: string } | null {
  const match = day.match(/^(-?\d+)([A-Z]{2})$/)
  if (!match) return null
  return { pos: parseInt(match[1], 10), abbr: match[2] }
}

export function parseRrule(rrule: string | null | undefined): ParsedRrule {
  const empty: ParsedRrule = { frequency: null, days: [], untilDate: '' }
  if (!rrule) return empty

  const body = rrule.replace(/^RRULE:/i, '')
  const parts = Object.fromEntries(
    body.split(';').map(p => p.split('=') as [string, string])
  )

  const frequency = parts['FREQ'] ? (FREQ_MAP[parts['FREQ']] ?? null) : null
  const days = parts['BYDAY'] ? parts['BYDAY'].split(',').map(d => d.trim()) : []
  const untilDate = parts['UNTIL']
    ? `${parts['UNTIL'].slice(0, 4)}-${parts['UNTIL'].slice(4, 6)}-${parts['UNTIL'].slice(6, 8)}`
    : ''

  return { frequency, days, untilDate }
}

export function buildRrule({
  frequency,
  days,
  untilDate,
}: {
  frequency: string
  days: string[]
  untilDate: string
}): string {
  if (!frequency) return ''

  const parts: string[] = [`FREQ=${frequency.toUpperCase()}`]

  if ((frequency === 'weekly' || frequency === 'monthly') && days.length > 0) {
    parts.push(`BYDAY=${days.join(',')}`)
  }

  if (untilDate) {
    parts.push(`UNTIL=${untilDate.replace(/-/g, '')}`)
  }

  return `RRULE:${parts.join(';')}`
}

// Returns the nth (pos > 0) or nth-from-last (pos < 0) occurrence of weekday `dow`
// in the given month. Returns null if the occurrence falls outside the month (e.g. 5th Monday).
function nthWeekdayOfMonth(year: number, month: number, pos: number, dow: number): Date | null {
  let day: number
  if (pos > 0) {
    const firstOfMonth = new Date(year, month, 1)
    const diff = (dow - firstOfMonth.getDay() + 7) % 7
    day = 1 + diff + (pos - 1) * 7
  } else {
    const lastOfMonth = new Date(year, month + 1, 0)
    const diff = (lastOfMonth.getDay() - dow + 7) % 7
    day = lastOfMonth.getDate() - diff + (pos + 1) * 7
  }
  const result = new Date(year, month, day)
  return result.getMonth() === month ? result : null
}

// Returns the next occurrence of the nth weekday pattern strictly after `after`.
function findNthWeekdayAfter(after: Date, pos: number, dow: number): Date | null {
  const year = after.getFullYear()
  const month = after.getMonth()
  const thisMonth = nthWeekdayOfMonth(year, month, pos, dow)
  if (thisMonth && thisMonth > after) return thisMonth

  // Walk forward month by month (pos=5 may not exist in every month)
  for (let i = 1; i <= 12; i++) {
    const m = (month + i) % 12
    const y = year + Math.floor((month + i) / 12)
    const next = nthWeekdayOfMonth(y, m, pos, dow)
    if (next) return next
  }
  return null
}

// Returns YYYY-MM-DD of the next occurrence after today, or null if series has ended / no frequency.
export function computeNextDate(
  frequency: string | null | undefined,
  days: string[],
  untilDate: string,
  startDate: string | null | undefined,
): string | null {
  if (!frequency) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Use startDate as the reference point (the known current occurrence);
  // fall back to today if not provided.
  const after = startDate ? parseLocalDate(startDate) : today

  // If UNTIL has already passed relative to today, the series is globally over
  if (untilDate) {
    const until = parseLocalDate(untilDate)
    if (until < today) return null
  }

  const candidate = new Date(after)

  if (frequency === 'daily') {
    candidate.setDate(candidate.getDate() + 1)
  } else if (frequency === 'weekly') {
    const targetDays = days.length > 0
      ? days.map(d => ABBR_TO_JS_DAY[d]).filter(n => n !== undefined)
      : [after.getDay()]

    if (targetDays.length === 0) return null

    // Walk forward up to 7 days to find the next matching weekday
    for (let i = 1; i <= 7; i++) {
      candidate.setDate(after.getDate() + i)
      if (targetDays.includes(candidate.getDay())) break
    }
  } else if (frequency === 'monthly') {
    const positional = days.length > 0 ? parsePositionalDay(days[0]) : null
    if (positional) {
      const dow = ABBR_TO_JS_DAY[positional.abbr]
      if (dow === undefined) return null
      const found = findNthWeekdayAfter(after, positional.pos, dow)
      if (!found) return null
      candidate.setFullYear(found.getFullYear(), found.getMonth(), found.getDate())
    } else {
      const dayOfMonth = after.getDate()
      candidate.setDate(dayOfMonth)
      if (candidate <= after) {
        candidate.setMonth(candidate.getMonth() + 1)
        candidate.setDate(dayOfMonth)
      }
    }
  } else {
    return null
  }

  // Cap at UNTIL
  if (untilDate) {
    const until = parseLocalDate(untilDate)
    if (candidate > until) return null
  }

  return toLocalDateStr(candidate)
}
