// The newsletter goes out every other Monday. The issue date is stored in
// activities.desk_settings (key below) so every device sees the same value,
// and it rolls forward automatically once the stored date has passed. It can
// still be edited by hand for the rare off-schedule issue.
export const ISSUE_DATE_KEY = 'newsletter_issue_date'
export const ISSUE_INTERVAL_DAYS = 14
// Anchor used when nothing has been stored yet: a known publish Monday.
export const DEFAULT_ISSUE_DATE = '2026-11-16'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const isIsoDate = (s: unknown): s is string =>
  typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s))

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

// Today's date in Amsterdam, so "Monday" flips at local midnight.
export function amsterdamToday(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' })
}

// Keeps the stored date on the biweekly cadence: if it's already in the past,
// advance it by whole intervals until it is today or later.
export function rollIssueDate(stored: string | null, today: string): string {
  let date = isIsoDate(stored) ? stored : DEFAULT_ISSUE_DATE
  while (date < today) date = addDays(date, ISSUE_INTERVAL_DAYS)
  return date
}
