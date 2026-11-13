import { z } from 'zod'

/**
 * Validation for what n8n's AI parser sends back to /api/desk/callback.
 *
 * Principles:
 *  - The AI may only supply content fields. It can never set list_id, status,
 *    services or file_url — those belong to Desk. Unknown keys are dropped.
 *  - A bad *field* is dropped with a warning (shown on the card) rather than
 *    failing the whole parse; only output with no usable title/description
 *    is rejected outright.
 *  - Nothing here touches the database, so it is easy to test.
 */

export const AREAS = [
  'West',
  'East',
  'North',
  'South',
  'Center',
  'Everywhere',
  'Online',
] as const

export const REPEAT_FREQUENCIES = [
  'daily',
  'weekly',
  'biweekly',
  'monthly',
] as const

export type ActivityType = 'event' | 'resource'

export interface ParsedActivity {
  title?: string
  description?: string
  newsletter_description?: string
  url?: string | null
  organization?: string | null
  age_range?: string | null
  location?: string | null
  neighborhood?: string | null
  area?: (typeof AREAS)[number] | null
  tagline?: string | null
  start_date?: string
  end_date?: string | null
  start_time?: string | null
  end_time?: string | null
  duration_minutes?: number | null
  repeat_rrule?: string | null
  repeat_frequency?: (typeof REPEAT_FREQUENCIES)[number] | null
}

export type ValidationResult =
  | {
      ok: true
      data: ParsedActivity
      warnings: string[]
      /** What the AI called it; may differ from the record's real type. */
      aiType: ActivityType | null
    }
  | { ok: false; reason: string }

// ---- Field schemas -------------------------------------------------------

const text = z.string().trim().min(1)

function isRealDate(s: string): boolean {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine(isRealDate, 'not a real calendar date')

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:MM (24h)')

const FIELD_SCHEMAS = {
  title: text,
  description: text,
  newsletter_description: text,
  url: text.nullable(),
  organization: text.nullable(),
  age_range: text.nullable(),
  location: text.nullable(),
  neighborhood: text.nullable(),
  area: z.enum(AREAS).nullable(),
  tagline: text.nullable(),
  start_date: isoDate,
  end_date: isoDate.nullable(),
  start_time: clockTime.nullable(),
  end_time: clockTime.nullable(),
  duration_minutes: z
    .number()
    .int()
    .min(0)
    .max(60 * 24 * 14)
    .nullable(),
  repeat_rrule: z
    .string()
    .regex(/^(RRULE:)?FREQ=(DAILY|WEEKLY|MONTHLY)\b/i, 'unsupported recurrence')
    .nullable(),
  repeat_frequency: z.enum(REPEAT_FREQUENCIES).nullable(),
} as const

type FieldName = keyof typeof FIELD_SCHEMAS

// ---- Coercion: LLMs say "null", "N/A", "Centre", "9:00:00" ---------------

const NULLISH_STRINGS = new Set(['null', 'none', 'n/a', 'na', 'undefined', '-'])

function coerce(field: FieldName, value: unknown): unknown {
  if (value === undefined) return undefined
  if (typeof value === 'string') {
    let v = value.trim()
    if (v === '' || NULLISH_STRINGS.has(v.toLowerCase())) return null
    if (field === 'repeat_frequency') return v.toLowerCase()
    if (field === 'area') {
      const key = v.toLowerCase()
      if (key === 'centre' || key === 'centrum') v = 'Center'
      else {
        const hit = AREAS.find((a) => a.toLowerCase() === key)
        if (hit) v = hit
      }
      return v
    }
    if (field === 'start_time' || field === 'end_time') {
      const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
      if (m) return `${m[1].padStart(2, '0')}:${m[2]}`
    }
    if (field === 'duration_minutes' && /^\d+$/.test(v)) return Number(v)
    return v
  }
  return value
}

// ---- Date helpers --------------------------------------------------------

/** Today's date (YYYY-MM-DD) in Amsterdam, where the events happen. */
export function todayInAmsterdam(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
  }).format(now)
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000
  )
}

// ---- Main entry ----------------------------------------------------------

export interface ValidateOptions {
  /** YYYY-MM-DD, injectable for tests. Defaults to today in Amsterdam. */
  today?: string
  /** The type of the record in the database, when known. */
  seedType?: ActivityType | null
}

export function validateParsed(
  raw: unknown,
  options: ValidateOptions = {}
): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'AI returned something that is not an object' }
  }
  const input = raw as Record<string, unknown>
  const today = options.today ?? todayInAmsterdam()
  const warnings: string[] = []
  const data: Record<string, unknown> = {}

  for (const field of Object.keys(FIELD_SCHEMAS) as FieldName[]) {
    if (!(field in input)) continue
    const value = coerce(field, input[field])
    if (value === undefined) continue

    const result = FIELD_SCHEMAS[field].safeParse(value)
    if (result.success) {
      data[field] = result.data
    } else if (value === null) {
      // null for a required-text field (title/description/start_date): omit it.
      continue
    } else {
      const why = result.error.issues[0]?.message ?? 'invalid'
      warnings.push(`Ignored ${field} from AI (${why}): ${preview(value)}`)
    }
  }

  const d = data as ParsedActivity

  // Need *something* to show for the card.
  if (!d.title && !d.description) {
    return { ok: false, reason: 'AI returned no title or description' }
  }
  if (!d.title) {
    d.title = (d.description as string).slice(0, 80)
    warnings.push('AI gave no title — used the start of the description')
  }

  let aiType: ActivityType | null = null
  if (input.type === 'event' || input.type === 'resource') {
    aiType = input.type
  }

  // end_date only makes sense after start_date.
  if (d.end_date && d.start_date && d.end_date <= d.start_date) {
    if (d.end_date < d.start_date) {
      warnings.push('Dropped end_date because it is before start_date')
    }
    d.end_date = null
  }

  const effectiveType = options.seedType ?? aiType
  if (effectiveType === 'event') {
    if (!d.start_date) {
      warnings.push('No usable date found — check the start date')
    } else if (!d.repeat_rrule) {
      // Recurring series legitimately carry an old start date.
      const diff = daysBetween(today, d.start_date)
      if (diff < -1) warnings.push(`Date ${d.start_date} is in the past`)
      else if (diff > 548)
        warnings.push(`Date ${d.start_date} is over 18 months away`)
    }
  }

  if (options.seedType && aiType && aiType !== options.seedType) {
    warnings.push(
      options.seedType === 'event'
        ? 'AI treated this as a resource (no date) but it was captured as an event — check the date'
        : `AI treated this as an event${d.start_date ? ` on ${d.start_date}` : ''} but it was captured as a resource — convert it if it has a date`
    )
  }

  return { ok: true, data: d, warnings, aiType }
}

function preview(value: unknown): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  return s.length > 60 ? `${s.slice(0, 57)}...` : s
}

// ---- Failure payloads ----------------------------------------------------

export interface ParseFailure {
  id: string | null
  message: string
}

/**
 * Recognises the "this step failed" payloads n8n can send to the callback:
 *   { id, failed: true, error }                    (explicit, preferred)
 *   { error: ..., submissionData: { id } }         (raw n8n error output)
 * A real parse result has a title, so an `error` next to a title is just
 * n8n noise and is not treated as a failure.
 */
export function extractFailure(item: unknown): ParseFailure | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const hasError = o.error !== undefined && o.error !== null && o.error !== ''
  const explicit = o.failed === true
  if (!explicit && !(hasError && !o.title)) return null

  const nested = (k: string) =>
    o[k] && typeof o[k] === 'object'
      ? (o[k] as Record<string, unknown>).id
      : undefined
  const idCandidate = o.id ?? nested('submissionData') ?? nested('body')
  const id = typeof idCandidate === 'string' && idCandidate ? idCandidate : null

  let message = 'AI step failed'
  const err = o.error
  if (typeof err === 'string' && err) message = err
  else if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    message =
      (typeof e.message === 'string' && e.message) ||
      (typeof e.description === 'string' && e.description) ||
      JSON.stringify(err)
  }
  return { id, message: message.slice(0, 300) }
}
